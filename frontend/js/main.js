// Input: User interactions (file upload, button clicks)
// Output: API calls to backend, triggers PLY file download (single or batch ZIP)
// Pos: Main application logic coordinating file upload, processing, and auto-download
// If this file is updated, you must update this header and the parent folder's README.md.

class MLSharpApp {
    constructor() {
        console.log('MLSharpApp: Initializing...');
        this.taskId = null;
        this.selectedFile = null;
        this.batchFiles = [];
        this.batchId = null;
        this.currentMode = 'single'; // 'single' or 'batch'

        // DOM elements - Single mode
        this.imageInput = document.getElementById('imageInput');
        this.processBtn = document.getElementById('processBtn');
        this.statusDiv = document.getElementById('status');
        this.uploadSection = document.getElementById('upload-section');
        this.progressContainer = document.getElementById('progress-container');
        this.previewContainer = document.getElementById('preview-container');
        this.imagePreview = document.getElementById('imagePreview');
        this.changeImageBtn = document.getElementById('changeImageBtn');

        // DOM elements - Batch mode
        this.folderInput = document.getElementById('folderInput');
        this.multiFileInput = document.getElementById('multiFileInput');
        this.batchProcessBtn = document.getElementById('batchProcessBtn');
        this.batchPreviewContainer = document.getElementById('batch-preview-container');
        this.batchFileList = document.getElementById('batch-file-list');
        this.batchFileCount = document.getElementById('batchFileCount');
        this.changeFolderBtn = document.getElementById('changeFolderBtn');
        this.selectFilesLink = document.getElementById('selectFilesLink');
        this.batchUploadLabel = document.getElementById('batchUploadLabel');

        // DOM elements - Mode toggle
        this.singleModeBtn = document.getElementById('singleModeBtn');
        this.batchModeBtn = document.getElementById('batchModeBtn');
        this.singleUpload = document.getElementById('single-upload');
        this.batchUpload = document.getElementById('batch-upload');

        // DOM elements - Batch progress
        this.batchProgress = document.getElementById('batch-progress');
        this.batchProgressCount = document.getElementById('batchProgressCount');
        this.batchStatusList = document.getElementById('batch-status-list');

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
            folderInput: !!this.folderInput,
            uploadArea: !!document.querySelector('.upload-area')
        });

        this.init();
    }

    init() {
        console.log('MLSharpApp: Setting up event listeners...');

        // Mode toggle handlers
        this.singleModeBtn.addEventListener('click', () => this.switchMode('single'));
        this.batchModeBtn.addEventListener('click', () => this.switchMode('batch'));

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

        // Change image button handler
        this.changeImageBtn.addEventListener('click', () => {
            console.log('Change image button clicked');
            this.imageInput.click();
        });

        // Batch mode handlers
        this.folderInput.addEventListener('change', (e) => {
            console.log('Folder input changed:', e.target.files);
            this.handleBatchFileSelect(e.target.files);
        });

        this.multiFileInput.addEventListener('change', (e) => {
            console.log('Multi file input changed:', e.target.files);
            this.handleBatchFileSelect(e.target.files);
        });

        this.selectFilesLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.multiFileInput.click();
        });

        this.changeFolderBtn.addEventListener('click', () => {
            this.resetBatchUpload();
        });

        this.batchProcessBtn.addEventListener('click', () => {
            console.log('Batch process button clicked');
            this.handleBatchProcess();
        });

        // Setup drag and drop for single mode
        this.setupDragDrop('#single-upload .upload-area', 'single');

        // Setup drag and drop for batch mode
        this.setupDragDrop('#batch-upload .upload-area', 'batch');

        console.log('MLSharpApp: Event listeners setup complete!');
    }

    switchMode(mode) {
        this.currentMode = mode;

        // Update button states
        this.singleModeBtn.classList.toggle('active', mode === 'single');
        this.batchModeBtn.classList.toggle('active', mode === 'batch');

        // Show/hide upload sections
        this.singleUpload.classList.toggle('active', mode === 'single');
        this.batchUpload.classList.toggle('active', mode === 'batch');

        // Hide progress indicators
        this.showProgress(false);
        this.batchProgress.style.display = 'none';
        this.showStatus('');
    }

    setupDragDrop(selector, mode) {
        const uploadArea = document.querySelector(selector);
        if (!uploadArea) {
            console.error(`Upload area not found: ${selector}`);
            return;
        }

        const uploadLabel = uploadArea.querySelector('.upload-label');

        // 阻止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // 拖拽进入
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
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
            const files = e.dataTransfer.files;
            const items = e.dataTransfer.items;

            if (mode === 'single') {
                if (files.length > 0) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(files[0]);
                    this.imageInput.files = dataTransfer.files;
                    this.handleFileSelect({ target: this.imageInput });
                }
            } else {
                // Batch mode - handle folder or multiple files
                if (items && items.length > 0) {
                    const fileList = [];
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i].webkitGetAsEntry?.();
                        if (item && item.isDirectory) {
                            this.readDirectory(item).then(files => {
                                this.handleBatchFileSelect(files);
                            });
                            return;
                        }
                    }
                }
                // Regular files
                this.handleBatchFileSelect(files);
            }
        }, false);
    }

    async readDirectory(directoryEntry) {
        const files = [];
        const reader = directoryEntry.createReader();

        return new Promise((resolve) => {
            const readEntries = () => {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve(files);
                        return;
                    }

                    for (const entry of entries) {
                        if (entry.isFile) {
                            const file = await new Promise(res => entry.file(res));
                            files.push(file);
                        }
                    }

                    readEntries();
                });
            };
            readEntries();
        });
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

        // Validate file size (100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            console.error('File too large:', file.size);
            this.showStatus('图片大小不能超过 100MB', 'error');
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

            // Step 4: Download PLY file
            this.showStatus('正在下载 PLY 文件...', 'info');
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

        // Trigger automatic download
        const link = document.createElement('a');
        link.href = plyUrl;
        link.download = `gaussian_splat_${taskId}.ply`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset to initial state
        this.resetToInitialState();
    }

    resetToInitialState() {
        // Clear selected file
        this.selectedFile = null;
        this.imageInput.value = '';

        // Hide preview, show upload label
        this.previewContainer.style.display = 'none';
        const uploadLabel = document.querySelector('.upload-label');
        if (uploadLabel) {
            uploadLabel.style.display = 'flex';
        }

        // Reset button and status
        this.processBtn.disabled = true;
        this.processBtn.textContent = '生成 3D 场景';
        this.showProgress(false);
        this.showStatus('PLY 文件已下载完成', 'success');
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

    // ==================== Batch Processing Methods ====================

    handleBatchFileSelect(files) {
        console.log('handleBatchFileSelect called', files);

        // Filter valid image files
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        const validFiles = [];

        for (const file of files) {
            if (validTypes.includes(file.type)) {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0) {
            this.showStatus('没有找到有效的图片文件 (JPG/PNG)', 'error');
            return;
        }

        this.batchFiles = validFiles;

        // Update UI
        this.batchFileCount.textContent = validFiles.length;
        this.batchFileList.innerHTML = '';

        validFiles.forEach(file => {
            const item = document.createElement('div');
            item.className = 'batch-file-item';
            item.innerHTML = `
                <span class="batch-file-name">${file.name}</span>
                <span class="batch-file-status pending">待处理</span>
            `;
            this.batchFileList.appendChild(item);
        });

        // Show preview, hide label
        this.batchPreviewContainer.style.display = 'block';
        this.batchUploadLabel.style.display = 'none';

        // Enable process button
        this.batchProcessBtn.disabled = false;
        this.showStatus('');
    }

    resetBatchUpload() {
        this.batchFiles = [];
        this.batchId = null;
        this.folderInput.value = '';
        this.multiFileInput.value = '';

        // Reset UI
        this.batchPreviewContainer.style.display = 'none';
        this.batchUploadLabel.style.display = 'flex';
        this.batchProcessBtn.disabled = true;
        this.batchProcessBtn.textContent = '批量生成 3D 场景';
        this.batchProgress.style.display = 'none';
        this.showProgress(false);
        this.showStatus('');
    }

    async handleBatchProcess() {
        if (this.batchFiles.length === 0) {
            this.showStatus('请先选择文件', 'error');
            return;
        }

        try {
            this.batchProcessBtn.disabled = true;
            this.batchProcessBtn.textContent = '处理中...';
            this.showProgress(true);

            // Step 1: Upload files
            this.showStatus('正在上传文件...', 'info');
            const batchId = await this.uploadBatchFiles();

            // Step 2: Start processing
            this.showStatus('正在批量生成 3D 场景...', 'info');
            await this.startBatchProcessing(batchId);

            // Step 3: Poll for completion
            this.batchProgress.style.display = 'block';
            await this.pollBatchStatus(batchId);

            // Step 4: Download ZIP
            this.showStatus('正在下载 ZIP 文件...', 'info');
            await this.downloadBatchResult(batchId);

        } catch (error) {
            console.error('Batch processing error:', error);
            this.showStatus(`错误: ${error.message}`, 'error');
            this.batchProcessBtn.disabled = false;
            this.batchProcessBtn.textContent = '批量生成 3D 场景';
            this.showProgress(false);
        }
    }

    async uploadBatchFiles() {
        const formData = new FormData();
        this.batchFiles.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch('/api/batch/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '上传失败');
        }

        const data = await response.json();
        this.batchId = data.batch_id;
        return data.batch_id;
    }

    async startBatchProcessing(batchId) {
        const response = await fetch(`/api/batch/process/${batchId}`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('启动批量处理失败');
        }

        return response.json();
    }

    async pollBatchStatus(batchId) {
        const maxAttempts = 600; // 10 minutes max for batch (600 * 1 second)
        let attempts = 0;

        while (attempts < maxAttempts) {
            const response = await fetch(`/api/batch/status/${batchId}`);

            if (!response.ok) {
                throw new Error('状态查询失败');
            }

            const data = await response.json();

            // Update progress UI
            this.batchProgressCount.textContent = `${data.completed}/${data.total}`;
            this.updateBatchStatusList(data.files);

            if (data.status === 'completed' || data.status === 'partial') {
                return;
            }

            if (data.status === 'failed') {
                throw new Error(data.error || '批量处理失败');
            }

            // Wait 1 second before next poll
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        throw new Error('处理超时');
    }

    updateBatchStatusList(files) {
        // Update file list in preview
        const items = this.batchFileList.querySelectorAll('.batch-file-item');
        items.forEach((item, index) => {
            if (files[index]) {
                const statusSpan = item.querySelector('.batch-file-status');
                statusSpan.className = `batch-file-status ${files[index].status}`;
                statusSpan.textContent = this.getStatusText(files[index].status);
            }
        });

        // Update batch status list
        this.batchStatusList.innerHTML = '';
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'batch-file-item';
            item.innerHTML = `
                <span class="batch-file-name">${file.filename}</span>
                <span class="batch-file-status ${file.status}">${this.getStatusText(file.status)}</span>
            `;
            this.batchStatusList.appendChild(item);
        });
    }

    getStatusText(status) {
        const statusMap = {
            'pending': '待处理',
            'processing': '处理中',
            'completed': '完成',
            'failed': '失败'
        };
        return statusMap[status] || status;
    }

    async downloadBatchResult(batchId) {
        const link = document.createElement('a');
        link.href = `/api/batch/result/${batchId}`;
        link.download = `batch_${batchId}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset to initial state
        this.resetBatchUpload();
        this.showStatus('ZIP 文件已下载完成', 'success');
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
