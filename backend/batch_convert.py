# Input: Directory path containing image files
# Output: PLY files for each image using ml-sharp
# Pos: CLI script for batch processing images to 3D Gaussian Splatting PLY files
# If this file is updated, you must update this header and the parent folder's README.md.

"""
Batch convert images to PLY files using ml-sharp.

Usage:
    python batch_convert.py <input_dir> [--output_dir <output_dir>] [--clean]

Examples:
    python batch_convert.py ./images
    python batch_convert.py ./images --output_dir ./output
    python batch_convert.py ./images --output_dir ./output --clean
"""

import argparse
import subprocess
import sys
import shutil
from pathlib import Path
from typing import List, Optional
import time

from config import ALLOWED_EXTENSIONS, SHARP_TIMEOUT

try:
    from convert_ply import convert_mlsharp_ply
except ImportError:
    convert_mlsharp_ply = None


def find_images(input_dir: Path) -> List[Path]:
    """Find all image files in the input directory."""
    images = []
    for ext in ALLOWED_EXTENSIONS:
        images.extend(input_dir.glob(f"*{ext}"))
        images.extend(input_dir.glob(f"*{ext.upper()}"))
    return sorted(images)


def run_sharp(image_path: Path, output_dir: Path, timeout: int = SHARP_TIMEOUT) -> bool:
    """Run ml-sharp predict on a single image.

    Args:
        image_path: Path to the input image
        output_dir: Directory to save the output PLY file
        timeout: Timeout in seconds

    Returns:
        True if successful, False otherwise
    """
    # Create a temporary directory for the single image
    # sharp expects a directory as input, so we need to copy the image
    temp_input_dir = output_dir / "_temp_input"
    temp_input_dir.mkdir(parents=True, exist_ok=True)

    # Copy image to temp directory
    temp_image = temp_input_dir / image_path.name
    shutil.copy2(image_path, temp_image)

    try:
        # Run sharp predict
        cmd = [
            "sharp", "predict",
            "-i", str(temp_input_dir),
            "-o", str(output_dir)
        ]

        print(f"  Running: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode != 0:
            print(f"  Error: {result.stderr}")
            return False

        return True

    except subprocess.TimeoutExpired:
        print(f"  Timeout: Processing took longer than {timeout} seconds")
        return False
    except FileNotFoundError:
        print("  Error: 'sharp' command not found. Make sure ml-sharp is installed and in PATH.")
        return False
    finally:
        # Cleanup temp directory
        if temp_input_dir.exists():
            shutil.rmtree(temp_input_dir)


def clean_ply(output_dir: Path) -> Optional[Path]:
    """Find and clean the PLY file in output directory.

    Returns:
        Path to cleaned PLY file, or None if failed
    """
    ply_files = list(output_dir.glob("*.ply"))
    if not ply_files:
        return None

    original_ply = ply_files[0]
    cleaned_ply = output_dir / "cleaned.ply"

    if convert_mlsharp_ply is not None:
        try:
            convert_mlsharp_ply(original_ply, cleaned_ply)
            return cleaned_ply
        except Exception as e:
            print(f"  Warning: PLY cleaning failed: {e}")
            return original_ply
    else:
        print("  Warning: convert_ply module not available, using original PLY")
        return original_ply


def batch_convert(
    input_dir: Path,
    output_dir: Optional[Path] = None,
    clean: bool = True,
    timeout: int = SHARP_TIMEOUT
) -> dict:
    """Batch convert all images in a directory to PLY files.

    Args:
        input_dir: Directory containing input images
        output_dir: Directory to save output PLY files (default: input_dir/output)
        clean: Whether to clean the PLY files for compatibility
        timeout: Timeout in seconds for each image

    Returns:
        Dictionary with success/failure counts and file mappings
    """
    input_dir = Path(input_dir).resolve()

    if not input_dir.exists():
        raise ValueError(f"Input directory does not exist: {input_dir}")

    if not input_dir.is_dir():
        raise ValueError(f"Input path is not a directory: {input_dir}")

    # Set default output directory
    if output_dir is None:
        output_dir = input_dir / "output"
    else:
        output_dir = Path(output_dir).resolve()

    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all images
    images = find_images(input_dir)

    if not images:
        print(f"No images found in {input_dir}")
        print(f"Supported formats: {', '.join(ALLOWED_EXTENSIONS)}")
        return {"success": 0, "failed": 0, "total": 0, "results": []}

    print(f"Found {len(images)} images in {input_dir}")
    print(f"Output directory: {output_dir}")
    print("-" * 50)

    results = {
        "success": 0,
        "failed": 0,
        "total": len(images),
        "results": []
    }

    for i, image in enumerate(images, 1):
        print(f"\n[{i}/{len(images)}] Processing: {image.name}")
        start_time = time.time()

        # Create output subdirectory for this image
        image_output_dir = output_dir / image.stem
        image_output_dir.mkdir(parents=True, exist_ok=True)

        # Run sharp predict
        success = run_sharp(image, image_output_dir, timeout)

        if success:
            # Find and optionally clean the output PLY
            if clean:
                ply_path = clean_ply(image_output_dir)
            else:
                ply_files = list(image_output_dir.glob("*.ply"))
                ply_path = ply_files[0] if ply_files else None

            if ply_path and ply_path.exists():
                # Rename to match input image name
                final_ply = output_dir / f"{image.stem}.ply"
                shutil.copy2(ply_path, final_ply)

                elapsed = time.time() - start_time
                print(f"  Success! Output: {final_ply} ({elapsed:.1f}s)")
                results["success"] += 1
                results["results"].append({
                    "input": str(image),
                    "output": str(final_ply),
                    "status": "success",
                    "time": elapsed
                })
            else:
                print(f"  Failed: No PLY file generated")
                results["failed"] += 1
                results["results"].append({
                    "input": str(image),
                    "output": None,
                    "status": "failed",
                    "error": "No PLY file generated"
                })
        else:
            results["failed"] += 1
            results["results"].append({
                "input": str(image),
                "output": None,
                "status": "failed",
                "error": "Processing failed"
            })

        # Cleanup intermediate directory
        if image_output_dir.exists():
            shutil.rmtree(image_output_dir)

    print("\n" + "=" * 50)
    print(f"Batch processing complete!")
    print(f"  Success: {results['success']}/{results['total']}")
    print(f"  Failed:  {results['failed']}/{results['total']}")
    print(f"  Output:  {output_dir}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Batch convert images to PLY files using ml-sharp"
    )
    parser.add_argument(
        "input_dir",
        type=str,
        help="Directory containing input images"
    )
    parser.add_argument(
        "--output_dir", "-o",
        type=str,
        default=None,
        help="Output directory for PLY files (default: <input_dir>/output)"
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        default=True,
        help="Clean PLY files for compatibility (default: True)"
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Skip PLY cleaning step"
    )
    parser.add_argument(
        "--timeout", "-t",
        type=int,
        default=SHARP_TIMEOUT,
        help=f"Timeout per image in seconds (default: {SHARP_TIMEOUT})"
    )

    args = parser.parse_args()

    clean = not args.no_clean

    try:
        results = batch_convert(
            input_dir=args.input_dir,
            output_dir=args.output_dir,
            clean=clean,
            timeout=args.timeout
        )

        # Exit with error code if any failed
        sys.exit(0 if results["failed"] == 0 else 1)

    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(130)


if __name__ == "__main__":
    main()
