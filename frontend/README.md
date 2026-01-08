Once the contents of this folder change, update this document.

## Architecture

Vanilla JavaScript frontend for image upload and PLY file auto-download. Event-driven file upload, polling-based status updates, and automatic PLY download on completion. No build tools or bundlers required.

## File Registry

| Name | Status/Importance | Core Function |
|------|------------------|---------------|
| index.html | Core | Main HTML structure with upload UI |
| css/style.css | Core | Complete styling including gradients, animations, and responsive layout |
| js/main.js | Core | Application orchestration: file upload, API communication, auto-download PLY |
| js/viewer.js | Legacy | Original simple point cloud viewer (unused) |
| js/viewer-enhanced.js | Legacy | Enhanced particle viewer with custom GLSL shaders (unused) |
