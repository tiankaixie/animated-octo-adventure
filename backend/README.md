Once the contents of this folder change, update this document.

## Architecture

FastAPI backend serving image uploads, ml-sharp processing via subprocess, and PLY file delivery. Stateless task tracking with in-memory dictionary. Static file mounting for frontend serving.

## File Registry

| Name | Status/Importance | Core Function |
|------|------------------|---------------|
| app.py | Core | FastAPI application with upload, processing, status, and result endpoints |
| config.py | Core | Centralized configuration for paths, limits, and ml-sharp settings |
| convert_ply.py | Utility | Converter to clean ml-sharp PLY output for GaussianSplats3D compatibility |
| ply_to_splat.py | Utility | Converter from PLY to binary .splat format |
| batch_convert.py | CLI | Batch processing script to convert images to PLY files using ml-sharp |
| requirements.txt | Core | Python package dependencies for FastAPI and file handling |
| uploads/ | Runtime | Directory for uploaded images and ml-sharp output PLY files |

## CLI Usage

### Batch Convert Images to PLY

```bash
# Basic usage - process all images in a directory
python batch_convert.py ./images

# Specify output directory
python batch_convert.py ./images --output_dir ./output

# Skip PLY cleaning step
python batch_convert.py ./images --no-clean

# Custom timeout (in seconds)
python batch_convert.py ./images --timeout 600
```

Supported image formats: `.jpg`, `.jpeg`, `.png`
