// Input: User interactions (file upload, button clicks)
// Output: API calls to backend, UI state updates
// Pos: Main application logic coordinating file upload, processing, and viewer initialization
// If this file is updated, you must update this header and the parent folder's README.md.

import { initViewer, cleanupViewer } from './viewer.js';

class MLSharpApp {
    constructor() {
        console.log('MLSharpApp: Initializing...');
        this.taskId = null;
        this.selectedFile = null;

        // DOM elements
        this.imageInput = document.getElementById('imageInput');
        this.processBtn = document.getElementById('processBtn');
        this.statusDiv = document.getElementById('status');
        this.uploadSection = document.getElementById('upload-section');
        this.viewerSection = document.getElementById('viewer-section');
        this.backBtn = document.getElementById('backBtn');
        this.progressContainer = document.getElementById('progress-container');
        this.previewContainer = document.getElementById('preview-container');
        this.imagePreview = document.getElementById('imagePreview');
        this.changeImageBtn = document.getElementById('changeImageBtn');

        // 检查关键元素是否存在
        if (!this.imageInput) {
            console.error('MLSharpApp: imageInput not found!');
        }
        if (!this.processBtn) {
            console.error('MLSharpApp: processBtn not found!');
        }

        console.log('MLSharpApp: DOM elements loaded', {
            imageInput: !!this.imageInput,
            processBtn: !!this.processBtn,
            uploadArea: !!document.querySelector('.upload-area')
        });

        this.init();
    }

    init() {
        console.log('MLSharpApp: Setting up event listeners...');

        // File input change handler
        this.imageInput.addEventListener('change', (e) => {
            console.log('File input changed:', e.target.files);
            this.handleFileSelect(e);
        });

        // Process button click handler
        this.processBtn.addEventListener('click', () => {
            console.log('Process button clicked');
            this.handleProcess();
        });

        // Back button click handler
        this.backBtn.addEventListener('click', () => this.handleBack());

        // Change image button handler
        this.changeImageBtn.addEventListener('click', () => {
            console.log('Change image button clicked');
            this.imageInput.click();
        });

        // Drag and drop support - 整个上传区域
        const uploadArea = document.querySelector('.upload-area');
        const uploadLabel = document.querySelector('.upload-label');

        console.log('MLSharpApp: Upload area elements', {
            uploadArea: !!uploadArea,
            uploadLabel: !!uploadLabel
        });

        if (!uploadArea) {
            console.error('MLSharpApp: Upload area not found! Drag and drop will not work.');
            return;
        }

        // 阻止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);

            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // 拖拽进入
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                console.log('Drag over detected');
                uploadArea.classList.add('drag-over');
                if (uploadLabel) {
                    uploadLabel.classList.add('drag-over');
                }
            }, false);
        });

        // 拖拽离开
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
                if (uploadLabel) {
                    uploadLabel.classList.remove('drag-over');
                }
            }, false);
        });

        // 放下文件
        uploadArea.addEventListener('drop', (e) => {
            console.log('File dropped:', e.dataTransfer.files);
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // 创建一个新的 FileList
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(files[0]);
                this.imageInput.files = dataTransfer.files;
                this.handleFileSelect({ target: this.imageInput });
            }
        }, false);

        console.log('MLSharpApp: Event listeners setup complete!');
    }

    handleFileSelect(event) {
        console.log('handleFileSelect called', event);
        const file = event.target.files[0];

        if (!file) {
            console.log('No file selected');
            return;
        }

        console.log('File selected:', file.name, file.type, file.size);

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            console.error('Invalid file type:', file.type);
            this.showStatus('请选择 JPG 或 PNG 格式的图片', 'error');
            return;
        }

        // Validate file size (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            console.error('File too large:', file.size);
            this.showStatus('图片大小不能超过 10MB', 'error');
            return;
        }

        this.selectedFile = file;
        console.log('File validation passed, showing preview...');

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('FileReader loaded, updating preview');
            this.imagePreview.src = e.target.result;
            this.previewContainer.style.display = 'block';
            const uploadLabel = document.querySelector('.upload-label');
            if (uploadLabel) {
                uploadLabel.style.display = 'none';
            }
        };
        reader.onerror = (e) => {
            console.error('FileReader error:', e);
        };
        reader.readAsDataURL(file);

        // Enable process button
        this.processBtn.disabled = false;
        this.showStatus('');
        console.log('Process button enabled');
    }

    async handleProcess() {
        if (!this.selectedFile) {
            this.showStatus('请先选择图片', 'error');
            return;
        }

        try {
            this.processBtn.disabled = true;
            this.processBtn.textContent = '处理中...';
            this.showProgress(true);

            // Step 1: Upload image
            this.showStatus('正在上传图片...', 'info');
            const taskId = await this.uploadImage();

            // Step 2: Start processing
            this.showStatus('正在生成 3D 场景...', 'info');
            await this.startProcessing(taskId);

            // Step 3: Poll for completion
            await this.pollStatus(taskId);

            // Step 4: Load and display result
            this.showStatus('正在加载 3D 场景...', 'info');
            await this.loadResult(taskId);

        } catch (error) {
            console.error('Processing error:', error);
            this.showStatus(`错误: ${error.message}`, 'error');
            this.processBtn.disabled = false;
            this.processBtn.textContent = '生成 3D 场景';
            this.showProgress(false);
        }
    }

    async uploadImage() {
        const formData = new FormData();
        formData.append('file', this.selectedFile);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '上传失败');
        }

        const data = await response.json();
        this.taskId = data.task_id;
        return data.task_id;
    }

    async startProcessing(taskId) {
        const response = await fetch(`/api/process/${taskId}`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('启动处理失败');
        }

        return response.json();
    }

    async pollStatus(taskId) {
        const maxAttempts = 120; // 2 minutes max (120 * 1 second)
        let attempts = 0;

        while (attempts < maxAttempts) {
            const response = await fetch(`/api/status/${taskId}`);

            if (!response.ok) {
                throw new Error('状态查询失败');
            }

            const data = await response.json();

            if (data.status === 'completed') {
                return;
            }

            if (data.status === 'failed') {
                throw new Error(data.error || '处理失败');
            }

            // Wait 1 second before next poll
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        throw new Error('处理超时');
    }

    async loadResult(taskId) {
        // Backend serves cleaned PLY files
        const plyUrl = `/api/result/${taskId}.ply`;

        // Switch to viewer section
        this.uploadSection.classList.remove('active');
        this.viewerSection.classList.add('active');

        // Show loading overlay
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.style.display = 'flex';

        try {
            // Initialize 3D viewer
            await initViewer('canvas', plyUrl);

            // Hide loading overlay
            loadingOverlay.style.display = 'none';

        } catch (error) {
            loadingOverlay.style.display = 'none';
            throw new Error(`加载 3D 场景失败: ${error.message}`);
        }
    }

    handleBack() {
        // Cleanup viewer
        cleanupViewer();

        // Switch back to upload section
        this.viewerSection.classList.remove('active');
        this.uploadSection.classList.add('active');

        // Reset UI
        this.processBtn.disabled = false;
        this.processBtn.textContent = '生成 3D 场景';
        this.showProgress(false);
        this.showStatus('');
    }

    showStatus(message, type = '') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = 'status-message';

        if (type) {
            this.statusDiv.classList.add(`status-${type}`);
        }
    }

    showProgress(show) {
        this.progressContainer.style.display = show ? 'block' : 'none';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, initializing MLSharpApp...');
    try {
        const app = new MLSharpApp();
        console.log('MLSharpApp initialized successfully!', app);
    } catch (error) {
        console.error('Failed to initialize MLSharpApp:', error);
    }
});
