// Input: PLY file URL from backend
// Output: Interactive 3D point cloud visualization with TSL particle effects (Revelium Milkmaid style)
// Pos: Enhanced 3D viewer using Three.js WebGPU/WebGL with animated particles
// If this file is updated, you must update this header and the parent folder's README.md.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let pointCloud = null;
let clock = null;
let uniforms = null;
let raycaster = null;
let mouse = null;
let mouseWorldPos = null;
let animationId = null;
let gui = null;

// GUI parameters object
const params = {
    pointSize: 0.2,
    noiseStrength: 0.008,
    noiseScale: 2.0,
    mouseRadius: 0.5,
    opacity: 0.7,
    animationSpeed: 1.0,
    autoRotate: true,
    autoRotateSpeed: 0.3
};

// Vertex shader for animated point cloud (Revelium Milkmaid style)
const vertexShader = `
    uniform float uTime;
    uniform float uPointSize;
    uniform vec3 uMousePos;
    uniform float uMouseRadius;
    uniform float uNoiseScale;
    uniform float uNoiseStrength;
    uniform float uOpacity;
    uniform float uAnimationSpeed;

    attribute vec3 color;
    attribute float randomOffset;

    varying vec3 vColor;
    varying float vAlpha;
    varying float vDistanceToMouse;

    // Simplex noise functions
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
        vColor = color;

        // Calculate distance to mouse for interaction
        float distToMouse = distance(position, uMousePos);
        vDistanceToMouse = distToMouse;

        // Animated noise displacement (breathing effect)
        float noiseTime = uTime * 0.3 * uAnimationSpeed + randomOffset * 6.28;
        vec3 noisePos = position * uNoiseScale + noiseTime;
        float noiseX = snoise(noisePos);
        float noiseY = snoise(noisePos + vec3(100.0));
        float noiseZ = snoise(noisePos + vec3(200.0));

        vec3 displacement = vec3(noiseX, noiseY, noiseZ) * uNoiseStrength;

        // Mouse repulsion effect
        float mouseInfluence = 1.0 - smoothstep(0.0, uMouseRadius, distToMouse);
        vec3 mouseDir = normalize(position - uMousePos + vec3(0.001));
        displacement += mouseDir * mouseInfluence * 0.15;

        vec3 animatedPosition = position + displacement;

        vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Dynamic point size based on distance and mouse proximity
        float sizeVariation = 1.0 + sin(uTime * 2.0 * uAnimationSpeed + randomOffset * 6.28) * 0.2;
        float mouseSizeBoost = 1.0 + mouseInfluence * 0.5;
        float baseSize = uPointSize * sizeVariation * mouseSizeBoost;

        // Size attenuation
        gl_PointSize = baseSize * (300.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 50.0);

        // Alpha based on distance and animation - more subtle variation
        float alphaBase = uOpacity + sin(uTime * 1.0 * uAnimationSpeed + randomOffset * 3.14) * 0.1;
        float alphaMouseBoost = mouseInfluence * 0.2;
        vAlpha = clamp(alphaBase + alphaMouseBoost, 0.0, 0.95);
    }
`;

// Fragment shader for soft, natural-looking particles
const fragmentShader = `
    uniform float uTime;

    varying vec3 vColor;
    varying float vAlpha;
    varying float vDistanceToMouse;

    void main() {
        // Create circular soft particle
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);

        // Discard pixels outside circle
        if (dist > 0.5) discard;

        // Soft edge falloff - more gradual for natural look
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha = pow(alpha, 2.0); // Softer, more natural falloff

        // Use original color without additive glow
        vec3 finalColor = vColor;

        // Very subtle color shimmer
        float shimmer = sin(uTime * 0.5 + vDistanceToMouse * 2.0) * 0.03;
        finalColor = finalColor * (1.0 + shimmer);

        // Final alpha - reduced overall opacity for less brightness
        float finalAlpha = alpha * vAlpha * 0.85;

        if (finalAlpha < 0.02) discard;

        gl_FragColor = vec4(finalColor, finalAlpha);
    }
`;

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
    const randomOffsets = new Float32Array(vertexCount);

    const SH_C0 = 0.28209479177387814; // Spherical harmonics constant

    for (let i = 0; i < vertexCount; i++) {
        const offset = i * 56; // 14 floats * 4 bytes

        // Position (with coordinate system conversion)
        const x = dataView.getFloat32(offset, true);
        const y = dataView.getFloat32(offset + 4, true);
        const z = dataView.getFloat32(offset + 8, true);

        positions[i * 3] = x;
        positions[i * 3 + 1] = -y;
        positions[i * 3 + 2] = -z;

        // Color (from spherical harmonics)
        const f_dc_0 = dataView.getFloat32(offset + 12, true);
        const f_dc_1 = dataView.getFloat32(offset + 16, true);
        const f_dc_2 = dataView.getFloat32(offset + 20, true);

        colors[i * 3] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f_dc_0));
        colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f_dc_1));
        colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f_dc_2));

        // Random offset for particle animation variation
        randomOffsets[i] = Math.random();
    }

    return { positions, colors, randomOffsets, count: vertexCount };
}

/**
 * Animation loop
 */
function animate() {
    animationId = requestAnimationFrame(animate);

    if (clock && uniforms) {
        uniforms.uTime.value = clock.getElapsedTime();
    }

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
 * Handle mouse movement for interaction
 */
function handleMouseMove(event) {
    if (!raycaster || !camera || !uniforms || !pointCloud) return;

    const container = document.getElementById('viewer-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Cast ray from camera through mouse position
    raycaster.setFromCamera(mouse, camera);

    // Find intersection with an invisible plane at the center of the point cloud
    const boundingSphere = pointCloud.geometry.boundingSphere;
    if (boundingSphere) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), 0);
        plane.translate(boundingSphere.center);

        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);

        if (intersectPoint) {
            uniforms.uMousePos.value.copy(intersectPoint);
        }
    }
}

/**
 * Initialize the 3D point cloud viewer with enhanced particle effects
 * @param {string} containerId - ID of the container element
 * @param {string} plyUrl - URL to the PLY file
 */
export async function initViewer(containerId, plyUrl) {
    try {
        console.log('Initializing enhanced point cloud viewer (Revelium style)');
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

        // Initialize clock for animation
        clock = new THREE.Clock();

        // Initialize raycaster for mouse interaction
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        mouseWorldPos = new THREE.Vector3();

        // Create Three.js scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a); // Darker background

        // Create camera with extended far plane for large scenes
        camera = new THREE.PerspectiveCamera(60, width / height, 0.001, 10000);
        camera.position.set(0, 0, 3);

        // Create renderer with better settings
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        // Add orbit controls with smooth damping
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;       // Explicitly enable zoom
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 1.2;
        controls.minDistance = 0;         // Allow getting very close
        controls.maxDistance = Infinity;  // Allow unlimited zoom out
        controls.enablePan = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
        controls.screenSpacePanning = true; // Better panning behavior

        console.log('Three.js scene created, loading PLY...');

        // Load PLY file
        const response = await fetch(plyUrl);
        if (!response.ok) {
            throw new Error(`Failed to load PLY: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`Downloaded ${arrayBuffer.byteLength} bytes`);

        // Parse PLY
        const { positions, colors, randomOffsets, count } = parsePLY(arrayBuffer);
        console.log(`Parsed ${count} points`);

        // Create point cloud geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('randomOffset', new THREE.BufferAttribute(randomOffsets, 1));

        // Compute bounding sphere for camera positioning
        geometry.computeBoundingSphere();
        const boundingSphere = geometry.boundingSphere;
        console.log('Bounding sphere:', boundingSphere);

        // Create shader material with custom uniforms
        uniforms = {
            uTime: { value: 0 },
            uPointSize: { value: params.pointSize },
            uMousePos: { value: new THREE.Vector3(1000, 1000, 1000) }, // Start far away
            uMouseRadius: { value: params.mouseRadius },
            uNoiseScale: { value: params.noiseScale },
            uNoiseStrength: { value: params.noiseStrength },
            uOpacity: { value: params.opacity },
            uAnimationSpeed: { value: params.animationSpeed }
        };

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending // Natural color blending
        });

        // Create point cloud
        pointCloud = new THREE.Points(geometry, material);
        scene.add(pointCloud);

        // Analyze point cloud to find optimal camera position
        // Camera should be positioned in front of the point cloud (max Z direction)
        if (boundingSphere) {
            const radius = boundingSphere.radius;

            // Find the bounding box and Z range of the point cloud
            geometry.computeBoundingBox();
            const boundingBox = geometry.boundingBox;

            // Calculate center of the point cloud
            const center = new THREE.Vector3();
            boundingBox.getCenter(center);

            // Find the maximum Z value (front of the point cloud)
            const maxZ = boundingBox.max.z;
            const minZ = boundingBox.min.z;
            const zRange = maxZ - minZ;

            // Position camera in front of the point cloud
            // Distance based on the larger of radius or diagonal
            const diagonal = new THREE.Vector3().subVectors(boundingBox.max, boundingBox.min).length();
            const distance = Math.max(radius, diagonal) * 1.5;

            camera.position.set(
                center.x,
                center.y,
                maxZ + distance  // Position camera in front (max Z + distance)
            );
            controls.target.copy(center);
            controls.update();

            // Adjust uniform values based on scene scale
            uniforms.uNoiseScale.value = 3.0 / radius;
            uniforms.uNoiseStrength.value = radius * 0.01;
            uniforms.uMouseRadius.value = radius * 0.3;

            console.log(`Point cloud bounds: Z range [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);
            console.log(`Camera positioned at Z=${(maxZ + distance).toFixed(2)}, looking at center`);
        }

        console.log('Enhanced point cloud created, starting render loop...');

        // Start animation loop
        animate();

        // Handle window resize
        window.addEventListener('resize', handleResize);

        // Handle mouse movement for interaction
        container.addEventListener('mousemove', handleMouseMove);

        // Stop auto-rotate when user interacts
        controls.addEventListener('start', () => {
            controls.autoRotate = false;
            params.autoRotate = false;
        });

        // Create GUI for parameter adjustment
        createGUI();

        console.log('Enhanced viewer initialized successfully!');

    } catch (error) {
        console.error('Failed to initialize viewer:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

/**
 * Create GUI for parameter adjustment
 */
function createGUI() {
    // Cleanup existing GUI
    if (gui) {
        gui.destroy();
    }

    // Hide the original control panel
    const controlPanel = document.getElementById('viewer-controls');
    if (controlPanel) {
        controlPanel.style.display = 'none';
    }

    gui = new GUI({ title: 'Particle Cloud' });

    // Controls info folder (replaces right panel)
    const controlsFolder = gui.addFolder('Controls');
    const controlsInfo = {
        rotate: 'Left mouse drag',
        pan: 'Right mouse drag',
        zoom: 'Mouse wheel',
        interact: 'Move mouse near particles'
    };
    controlsFolder.add(controlsInfo, 'rotate').name('Rotate').disable();
    controlsFolder.add(controlsInfo, 'pan').name('Pan').disable();
    controlsFolder.add(controlsInfo, 'zoom').name('Zoom').disable();
    controlsFolder.add(controlsInfo, 'interact').name('Interact').disable();

    // Particle folder
    const particleFolder = gui.addFolder('Particles');
    particleFolder.add(params, 'pointSize', 0.1, 5.0, 0.1)
        .name('Size')
        .onChange((value) => {
            if (uniforms) uniforms.uPointSize.value = value;
        });
    particleFolder.add(params, 'opacity', 0.1, 1.0, 0.05)
        .name('Opacity')
        .onChange((value) => {
            if (uniforms) uniforms.uOpacity.value = value;
        });
    particleFolder.open();

    // Animation folder
    const animFolder = gui.addFolder('Animation');
    animFolder.add(params, 'noiseStrength', 0, 0.05, 0.001)
        .name('Noise Strength')
        .onChange((value) => {
            if (uniforms) uniforms.uNoiseStrength.value = value;
        });
    animFolder.add(params, 'noiseScale', 0.5, 10.0, 0.5)
        .name('Noise Scale')
        .onChange((value) => {
            if (uniforms) uniforms.uNoiseScale.value = value;
        });
    animFolder.add(params, 'animationSpeed', 0, 3.0, 0.1)
        .name('Speed')
        .onChange((value) => {
            if (uniforms) uniforms.uAnimationSpeed.value = value;
        });
    animFolder.open();

    // Interaction folder
    const interactionFolder = gui.addFolder('Interaction');
    interactionFolder.add(params, 'mouseRadius', 0.1, 2.0, 0.1)
        .name('Mouse Radius')
        .onChange((value) => {
            if (uniforms) uniforms.uMouseRadius.value = value;
        });
    interactionFolder.add(params, 'autoRotate')
        .name('Auto Rotate')
        .onChange((value) => {
            if (controls) controls.autoRotate = value;
        });
    interactionFolder.add(params, 'autoRotateSpeed', 0.1, 2.0, 0.1)
        .name('Rotate Speed')
        .onChange((value) => {
            if (controls) controls.autoRotateSpeed = value;
        });

    // Actions folder with back button
    const actionsFolder = gui.addFolder('Actions');
    const actions = {
        backToUpload: () => {
            // Trigger back button click
            const backBtn = document.getElementById('backBtn');
            if (backBtn) backBtn.click();
        }
    };
    actionsFolder.add(actions, 'backToUpload').name('← Back to Upload');
    actionsFolder.open();

    // Position GUI on right side
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '20px';
    gui.domElement.style.right = '20px';

    // Append to viewer container
    const container = document.getElementById('viewer-container');
    if (container) {
        container.appendChild(gui.domElement);
    }
}

/**
 * Cleanup viewer resources
 */
export function cleanupViewer() {
    // Cleanup GUI
    if (gui) {
        gui.destroy();
        gui = null;
    }

    // Restore original control panel visibility (for next time)
    const controlPanel = document.getElementById('viewer-controls');
    if (controlPanel) {
        controlPanel.style.display = '';
    }

    // Cancel animation frame
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

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
    clock = null;
    uniforms = null;
    raycaster = null;
    mouse = null;
    mouseWorldPos = null;

    // Remove event listeners
    window.removeEventListener('resize', handleResize);
    const container = document.getElementById('viewer-container');
    if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
    }

    console.log('Enhanced viewer cleaned up successfully');
}

/**
 * Get current viewer instance
 */
export function getViewer() {
    return { scene, camera, renderer, controls, pointCloud, uniforms };
}

/**
 * Update viewer settings
 */
export function updateSettings(settings) {
    if (!uniforms) return;

    if (settings.pointSize !== undefined) {
        uniforms.uPointSize.value = settings.pointSize;
    }
    if (settings.noiseStrength !== undefined) {
        uniforms.uNoiseStrength.value = settings.noiseStrength;
    }
    if (settings.noiseScale !== undefined) {
        uniforms.uNoiseScale.value = settings.noiseScale;
    }
    if (settings.mouseRadius !== undefined) {
        uniforms.uMouseRadius.value = settings.mouseRadius;
    }
}
