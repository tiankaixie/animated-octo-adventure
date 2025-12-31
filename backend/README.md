Once the contents of this folder change, update this document.

## Architecture

FastAPI backend serving image uploads, ml-sharp processing via subprocess, and PLY file delivery. Stateless task tracking with in-memory dictionary. Static file mounting for frontend serving.

## File Registry

| Name | Status/Importance | Core Function |
|------|------------------|---------------|
| app.py | Core | FastAPI application with upload, processing, status, and result endpoints |
| config.py | Core | Centralized configuration for paths, limits, and ml-sharp settings |
| requirements.txt | Core | Python package dependencies for FastAPI and file handling |
| uploads/ | Runtime | Directory for uploaded images and ml-sharp output PLY files |
