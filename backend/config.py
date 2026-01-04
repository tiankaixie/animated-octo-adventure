# Input: None (standalone configuration)
# Output: Configuration constants for the FastAPI application
# Pos: Centralized configuration for upload paths, file limits, and ml-sharp settings
# If this file is updated, you must update this header and the parent folder's README.md.

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = UPLOAD_DIR / "outputs"

# File upload settings
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

# ml-sharp settings
SHARP_CHECKPOINT = None  # Use default checkpoint
SHARP_TIMEOUT = 300  # 5 minutes timeout for processing

# Create directories if they don't exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
