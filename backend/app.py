# Input: HTTP requests from frontend, image files (single or batch)
# Output: JSON responses, PLY files for 3D Gaussian Splatting
# Pos: Main FastAPI application handling image upload, ml-sharp processing, and file serving
# If this file is updated, you must update this header and the parent folder's README.md.

import asyncio
import shutil
import uuid
import zipfile
import io
from pathlib import Path
from typing import Dict, List, Optional

import aiofiles
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from config import (
    UPLOAD_DIR,
    OUTPUT_DIR,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    SHARP_TIMEOUT,
    BASE_DIR
)

app = FastAPI(title="ML-SHARP Web Demo")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Task status tracking
tasks: Dict[str, Dict] = {}
# Batch task tracking
batch_tasks: Dict[str, Dict] = {}


def validate_file(filename: str, file_size: int) -> None:
    """Validate uploaded file"""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {MAX_FILE_SIZE / 1024 / 1024}MB"
        )


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file"""
    # Generate unique task ID
    task_id = str(uuid.uuid4())

    # Create task directory
    task_dir = UPLOAD_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)

    # Read file content
    content = await file.read()

    # Validate file
    validate_file(file.filename, len(content))

    # Save file
    input_path = task_dir / f"input{Path(file.filename).suffix}"
    async with aiofiles.open(input_path, 'wb') as f:
        await f.write(content)

    # Initialize task status
    tasks[task_id] = {
        "status": "uploaded",
        "input_path": str(input_path),
        "output_path": None,
        "error": None
    }

    return {"task_id": task_id, "filename": file.filename}


@app.post("/api/process/{task_id}")
async def process_image(task_id: str):
    """Process uploaded image with ml-sharp"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    if tasks[task_id]["status"] == "processing":
        return {"status": "already_processing"}

    # Update status
    tasks[task_id]["status"] = "processing"

    # Start processing in background
    asyncio.create_task(run_sharp_processing(task_id))

    return {"status": "processing", "task_id": task_id}


async def run_sharp_processing(task_id: str):
    """Run ml-sharp processing asynchronously"""
    try:
        task_dir = UPLOAD_DIR / task_id
        input_path = Path(tasks[task_id]["input_path"])
        output_dir = task_dir / "output"

        # Run sharp predict command
        process = await asyncio.create_subprocess_exec(
            "sharp", "predict",
            "-i", str(input_path.parent),
            "-o", str(output_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=SHARP_TIMEOUT
            )

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                tasks[task_id]["status"] = "failed"
                tasks[task_id]["error"] = error_msg
                return

            # Find generated PLY file
            ply_files = list(output_dir.glob("*.ply"))
            if not ply_files:
                tasks[task_id]["status"] = "failed"
                tasks[task_id]["error"] = "No PLY file generated"
                return

            # Convert PLY file to clean format for GaussianSplats3D
            # GaussianSplats3D v0.4.7 may not support .splat, use cleaned PLY instead
            original_ply = ply_files[0]
            cleaned_ply = output_dir / "cleaned.ply"

            try:
                import sys
                sys.path.insert(0, str(BASE_DIR))
                from convert_ply import convert_mlsharp_ply

                convert_mlsharp_ply(original_ply, cleaned_ply)

                # Update task status with cleaned PLY file
                tasks[task_id]["status"] = "completed"
                tasks[task_id]["output_path"] = str(cleaned_ply)
            except Exception as convert_error:
                # If conversion fails, use original PLY file
                print(f"PLY cleaning failed: {convert_error}")
                import traceback
                traceback.print_exc()
                tasks[task_id]["status"] = "completed"
                tasks[task_id]["output_path"] = str(original_ply)

        except asyncio.TimeoutError:
            process.kill()
            tasks[task_id]["status"] = "failed"
            tasks[task_id]["error"] = "Processing timeout"

    except Exception as e:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)


@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    """Get processing status"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_id]
    return {
        "status": task["status"],
        "error": task.get("error"),
        "has_output": task["output_path"] is not None
    }


@app.get("/api/result/{task_id:path}")
async def get_result(task_id: str):
    """Download generated splat/PLY file"""
    # Remove any file extension
    task_id = task_id.replace('.ply', '').replace('.splat', '')

    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_id]

    if task["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Task not completed. Status: {task['status']}"
        )

    if not task["output_path"]:
        raise HTTPException(status_code=404, detail="Output file not found")

    output_path = Path(task["output_path"])
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")

    # Always serve as PLY now
    media_type = "application/octet-stream"  # Use generic type to avoid browser issues
    filename = f"gaussian_splat_{task_id}.ply"

    return FileResponse(
        output_path,
        media_type=media_type,
        filename=filename,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Cache-Control": "public, max-age=3600"
        }
    )


@app.post("/api/batch/upload")
async def batch_upload(files: List[UploadFile] = File(...)):
    """Upload multiple image files for batch processing"""
    batch_id = str(uuid.uuid4())
    batch_dir = UPLOAD_DIR / batch_id
    batch_dir.mkdir(parents=True, exist_ok=True)

    file_list = []
    for file in files:
        # Read file content
        content = await file.read()

        # Validate file
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue  # Skip invalid files
        if len(content) > MAX_FILE_SIZE:
            continue  # Skip files that are too large

        # Save file with original name
        safe_filename = Path(file.filename).name
        input_path = batch_dir / safe_filename
        async with aiofiles.open(input_path, 'wb') as f:
            await f.write(content)

        file_list.append({
            "filename": safe_filename,
            "path": str(input_path),
            "status": "pending"
        })

    if not file_list:
        raise HTTPException(status_code=400, detail="No valid image files found")

    # Initialize batch task
    batch_tasks[batch_id] = {
        "status": "uploaded",
        "files": file_list,
        "completed": 0,
        "total": len(file_list),
        "output_dir": None,
        "error": None
    }

    return {
        "batch_id": batch_id,
        "file_count": len(file_list),
        "files": [f["filename"] for f in file_list]
    }


@app.post("/api/batch/process/{batch_id}")
async def batch_process(batch_id: str):
    """Start batch processing for uploaded files"""
    if batch_id not in batch_tasks:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch_tasks[batch_id]["status"] == "processing":
        return {"status": "already_processing"}

    batch_tasks[batch_id]["status"] = "processing"

    # Start processing in background
    asyncio.create_task(run_batch_processing(batch_id))

    return {"status": "processing", "batch_id": batch_id}


async def run_batch_processing(batch_id: str):
    """Run ml-sharp processing for all files in batch"""
    try:
        batch = batch_tasks[batch_id]
        batch_dir = UPLOAD_DIR / batch_id
        output_dir = batch_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        batch["output_dir"] = str(output_dir)

        for i, file_info in enumerate(batch["files"]):
            file_info["status"] = "processing"

            input_path = Path(file_info["path"])

            # Create a temporary directory for each file to isolate processing
            file_input_dir = batch_dir / f"input_{input_path.stem}"
            file_input_dir.mkdir(parents=True, exist_ok=True)

            # Copy file to isolated directory
            isolated_input = file_input_dir / input_path.name
            shutil.copy2(input_path, isolated_input)

            file_output_dir = output_dir / input_path.stem

            # Run sharp predict command (processes all files in input directory)
            process = await asyncio.create_subprocess_exec(
                "sharp", "predict",
                "-i", str(file_input_dir),
                "-o", str(file_output_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=SHARP_TIMEOUT
                )

                if process.returncode != 0:
                    file_info["status"] = "failed"
                    file_info["error"] = stderr.decode() if stderr else "Unknown error"
                else:
                    # Find and convert PLY file
                    ply_files = list(file_output_dir.glob("*.ply"))
                    if ply_files:
                        original_ply = ply_files[0]
                        cleaned_ply = file_output_dir / f"{input_path.stem}_cleaned.ply"

                        try:
                            import sys
                            sys.path.insert(0, str(BASE_DIR))
                            from convert_ply import convert_mlsharp_ply
                            convert_mlsharp_ply(original_ply, cleaned_ply)
                            file_info["output_path"] = str(cleaned_ply)
                        except Exception:
                            file_info["output_path"] = str(original_ply)

                        file_info["status"] = "completed"
                    else:
                        file_info["status"] = "failed"
                        file_info["error"] = "No PLY file generated"

            except asyncio.TimeoutError:
                process.kill()
                file_info["status"] = "failed"
                file_info["error"] = "Processing timeout"

            batch["completed"] = i + 1

        # Check if all completed
        completed_count = sum(1 for f in batch["files"] if f["status"] == "completed")
        if completed_count == len(batch["files"]):
            batch["status"] = "completed"
        elif completed_count > 0:
            batch["status"] = "partial"
        else:
            batch["status"] = "failed"

    except Exception as e:
        batch_tasks[batch_id]["status"] = "failed"
        batch_tasks[batch_id]["error"] = str(e)


@app.get("/api/batch/status/{batch_id}")
async def batch_status(batch_id: str):
    """Get batch processing status"""
    if batch_id not in batch_tasks:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch = batch_tasks[batch_id]
    return {
        "status": batch["status"],
        "completed": batch["completed"],
        "total": batch["total"],
        "files": [
            {
                "filename": f["filename"],
                "status": f["status"],
                "error": f.get("error")
            }
            for f in batch["files"]
        ],
        "error": batch.get("error")
    }


@app.get("/api/batch/result/{batch_id}")
async def batch_result(batch_id: str):
    """Download all completed PLY files as a ZIP"""
    if batch_id not in batch_tasks:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch = batch_tasks[batch_id]

    if batch["status"] not in ["completed", "partial"]:
        raise HTTPException(
            status_code=400,
            detail=f"Batch not ready. Status: {batch['status']}"
        )

    # Create ZIP file in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for file_info in batch["files"]:
            if file_info["status"] == "completed" and file_info.get("output_path"):
                output_path = Path(file_info["output_path"])
                if output_path.exists():
                    # Use original filename with .ply extension
                    arcname = f"{Path(file_info['filename']).stem}.ply"
                    zip_file.write(output_path, arcname)

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=batch_{batch_id}.zip",
            "Access-Control-Allow-Origin": "*"
        }
    )


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "tasks_count": len(tasks), "batch_count": len(batch_tasks)}


# Mount frontend static files
frontend_path = BASE_DIR.parent / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
