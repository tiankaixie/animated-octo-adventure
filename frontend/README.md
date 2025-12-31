Once the contents of this folder change, update this document.

## Architecture

Vanilla JavaScript frontend with Three.js-based GaussianSplats3D viewer. Event-driven file upload, polling-based status updates, and WebGL rendering. No build tools or bundlers required.

## File Registry

| Name | Status/Importance | Core Function |
|------|------------------|---------------|
| index.html | Core | Main HTML structure with upload UI and 3D viewer container |
| css/style.css | Core | Complete styling including gradients, animations, and responsive layout |
| js/main.js | Core | Application orchestration: file upload, API communication, UI state management |
| js/viewer.js | Core | GaussianSplats3D initialization, PLY loading, and camera controls |
