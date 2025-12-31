// Input: PLY file URL from backend
// Output: Interactive 3D point cloud visualization
// Pos: 3D viewer implementation using Three.js for point cloud rendering
// If this file is updated, you must update this header and the parent folder's README.md.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let pointCloud = null;

/**
 * Parse PLY file binary data
 */
function parsePLY(arrayBuffer) {
    const decoder = new TextDecoder('ascii');
    const uint8Array = new Uint8Array(arrayBuffer);

    // Find end of header
    let headerEndIndex = 0;
    const headerText = decoder.decode(uint8Array.slice(0, 2000));
    const headerEndMatch = headerText.match(/end_header\n/);
    if (headerEndMatch) {
        headerEndIndex = headerText.indexOf('end_header\n') + 11;
    }

    // Parse header
    const header = decoder.decode(uint8Array.slice(0, headerEndIndex));
    const lines = header.split('\n');

    let vertexCount = 0;
    for (const line of lines) {
        if (line.startsWith('element vertex')) {
            vertexCount = parseInt(line.split(' ')[2]);
            break;
        }
    }

    console.log(`Parsing PLY: ${vertexCount} vertices`);

    // Parse binary data (14 floats per vertex)
    const dataView = new DataView(arrayBuffer, headerEndIndex);
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    const SH_C0 = 0.28209479177387814; // Spherical harmonics constant

    for (let i = 0; i < vertexCount; i++) {
        const offset = i * 56; // 14 floats * 4 bytes

        // Position (with coordinate system conversion)
        // ml-sharp: x-right, y-down, z-forward
        // Three.js: x-right, y-up, z-out
        const x = dataView.getFloat32(offset, true);
        const y = dataView.getFloat32(offset + 4, true);
        const z = dataView.getFloat32(offset + 8, true);

        positions[i * 3] = x;      // x stays the same
        positions[i * 3 + 1] = -y;  // flip y (up/down)
        positions[i * 3 + 2] = -z;  // flip z (front/back)

        // Color (from spherical harmonics f_dc_0, f_dc_1, f_dc_2)
        const f_dc_0 = dataView.getFloat32(offset + 12, true);
        const f_dc_1 = dataView.getFloat32(offset + 16, true);
        const f_dc_2 = dataView.getFloat32(offset + 20, true);

        // Convert from SH to RGB (0-1 range)
        colors[i * 3] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f_dc_0));
        colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f_dc_1));
        colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f_dc_2));
    }

    return { positions, colors, count: vertexCount };
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);

    if (controls) {
        controls.update();
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * Handle window resize
 */
function handleResize() {
    if (camera && renderer) {
        const container = document.getElementById('viewer-container');
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
    }
}

/**
 * Initialize the 3D point cloud viewer
 * @param {string} containerId - ID of the container element
 * @param {string} plyUrl - URL to the PLY file
 */
export async function initViewer(containerId, plyUrl) {
    try {
        console.log('Initializing point cloud viewer');
        console.log('Loading PLY from:', plyUrl);

        // Clean up existing viewer if any
        cleanupViewer();

        // Get container element
        const container = document.getElementById('viewer-container');
        if (!container) {
            throw new Error('Viewer container not found');
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        // Create Three.js scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);

        // Create camera
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 2, 5);

        // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // Add orbit controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 0.001;  // Very close zoom
        controls.maxDistance = Infinity;  // Unlimited zoom out

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        console.log('Three.js scene created, loading PLY...');

        // Load PLY file
        const response = await fetch(plyUrl);
        if (!response.ok) {
            throw new Error(`Failed to load PLY: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`Downloaded ${arrayBuffer.byteLength} bytes`);

        // Parse PLY
        const { positions, colors, count } = parsePLY(arrayBuffer);
        console.log(`Parsed ${count} points`);

        // Create point cloud geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Compute bounding sphere for camera positioning
        geometry.computeBoundingSphere();
        const boundingSphere = geometry.boundingSphere;
        console.log('Bounding sphere:', boundingSphere);

        // Create point cloud material
        const material = new THREE.PointsMaterial({
            size: 0.015,
            vertexColors: true,
            sizeAttenuation: true
        });

        // Create point cloud
        pointCloud = new THREE.Points(geometry, material);
        scene.add(pointCloud);

        // Position camera based on bounding sphere
        if (boundingSphere) {
            const radius = boundingSphere.radius;
            const distance = radius * 3;
            camera.position.set(
                boundingSphere.center.x,
                boundingSphere.center.y + distance * 0.3,
                boundingSphere.center.z + distance
            );
            controls.target.copy(boundingSphere.center);
            controls.update();

            console.log(`Camera positioned at distance ${distance.toFixed(2)}`);
        }

        console.log('Point cloud created, starting render loop...');

        // Start animation loop
        animate();

        // Handle window resize
        window.addEventListener('resize', handleResize);

        console.log('Viewer initialized successfully!');

    } catch (error) {
        console.error('Failed to initialize viewer:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

/**
 * Cleanup viewer resources
 */
export function cleanupViewer() {
    // Stop animation by not calling requestAnimationFrame anymore
    // (handled by replacing the scene/renderer/camera references)

    if (renderer) {
        const canvas = renderer.domElement;
        if (canvas && canvas.parentElement) {
            canvas.parentElement.removeChild(canvas);
        }
        renderer.dispose();
        renderer = null;
    }

    if (pointCloud && pointCloud.geometry) {
        pointCloud.geometry.dispose();
    }

    if (pointCloud && pointCloud.material) {
        pointCloud.material.dispose();
    }

    if (controls) {
        controls.dispose();
        controls = null;
    }

    scene = null;
    camera = null;
    pointCloud = null;

    // Remove resize listener
    window.removeEventListener('resize', handleResize);

    console.log('Viewer cleaned up successfully');
}

/**
 * Get current viewer instance
 */
export function getViewer() {
    return { scene, camera, renderer, controls, pointCloud };
}
