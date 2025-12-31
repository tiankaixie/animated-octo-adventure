# Input: HTTP requests from frontend, image files
# Output: JSON responses, PLY files for 3D Gaussian Splatting
# Pos: Main FastAPI application handling image upload, ml-sharp processing, and file serving
# If this file is updated, you must update this header and the parent folder's README.md.

import asyncio
import uuid
from pathlib import Path
from typing import Dict, Optional

import aiofiles
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
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


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "tasks_count": len(tasks)}


# Mount frontend static files
frontend_path = BASE_DIR.parent / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
