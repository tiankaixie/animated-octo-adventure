Once the contents of this folder change, update this document.

## Architecture

Vanilla JavaScript frontend with Three.js-based point cloud viewer featuring animated particle effects (Revelium Milkmaid style). Event-driven file upload, polling-based status updates, and WebGL/WebGPU rendering with custom shaders. No build tools or bundlers required.

## File Registry

| Name | Status/Importance | Core Function |
|------|------------------|---------------|
| index.html | Core | Main HTML structure with upload UI and 3D viewer container |
| css/style.css | Core | Complete styling including gradients, animations, and responsive layout |
| js/main.js | Core | Application orchestration: file upload, API communication, UI state management |
| js/viewer.js | Legacy | Original simple point cloud viewer using THREE.PointsMaterial |
| js/viewer-enhanced.js | Core | Enhanced particle viewer with custom GLSL shaders, noise animation, and mouse interaction (Revelium style) |
