# ML-SHARP Web Demo

一个基于 Apple ML-SHARP 的 Web 应用，将单张图片转换为可交互的 3D Gaussian Splatting 场景。

## 项目简介

本项目集成了 Apple 的 [ml-sharp](https://github.com/apple/ml-sharp) 技术，提供一个简洁的 Web 界面，让用户可以：

1. 上传单张图片（JPG/PNG）
2. 自动处理生成 3D Gaussian Splatting 表示
3. 在浏览器中实时查看和交互 3D 场景

## 技术栈

### 后端
- Python 3.13
- FastAPI 0.115.0
- ml-sharp（Apple 单目视图合成）
- PyTorch + CUDA

### 前端
- 原生 HTML/CSS/JavaScript
- Three.js 0.170.0
- GaussianSplats3D 0.5.20

## 系统要求

### 必需
- Python 3.13
- uv（Python 包管理器）- [安装指南](https://docs.astral.sh/uv/getting-started/installation/)
- NVIDIA GPU（支持 CUDA）
- CUDA Toolkit（推荐 12.1+）
- 现代浏览器（Chrome/Edge/Firefox 最新版）

### 推荐配置
- GPU 显存：8GB+
- 内存：16GB+
- 存储空间：10GB+（包括模型文件）

## 安装步骤

### 1. 克隆项目

```bash
cd ml-sharp-demo
```

### 2. 安装 ml-sharp

#### 创建 Python 虚拟环境（使用 uv）

```bash
# 创建虚拟环境
uv venv --python 3.13

# 激活虚拟环境
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate  # Windows
```

#### 安装 PyTorch（CUDA 版本）

```bash
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

#### 安装 ml-sharp

```bash
# 克隆 ml-sharp 仓库到临时目录
git clone https://github.com/apple/ml-sharp.git /tmp/ml-sharp
cd /tmp/ml-sharp

# 安装依赖
uv pip install -r requirements.txt

# 以开发模式安装
uv pip install -e .

# 返回项目目录
cd -
```

#### 验证安装

```bash
sharp --help
```

应该看到 ml-sharp 的帮助信息。

### 3. 安装后端依赖

```bash
cd backend
uv pip install -r requirements.txt
```

### 4. 下载预训练模型（可选）

首次运行时，ml-sharp 会自动下载预训练模型到 `~/.cache/torch/hub/checkpoints/`。

如需手动下载：

```bash
# 模型会自动下载，或访问：
# https://huggingface.co/apple/ml-sharp
```

## 运行应用

### 方法 1: 一键启动（推荐）

项目提供了启动和停止脚本，可以快速启动应用：

```bash
# 启动服务
./start.sh

# 停止服务（在另一个终端运行）
./stop.sh
```

**启动脚本会自动：**
- ✅ 检查虚拟环境和依赖
- ✅ 激活虚拟环境
- ✅ 检查 GPU 支持（MPS/CUDA）
- ✅ 创建必要的目录
- ✅ 启动 FastAPI 服务器
- ✅ 显示访问地址和状态信息

### 方法 2: 手动启动

如果你想手动控制启动过程：

```bash
# 1. 激活虚拟环境
source .venv/bin/activate

# 2. 启动后端服务
cd backend
python app.py
```

或使用 uvicorn：

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

服务将在 `http://localhost:8000` 启动。

### 访问 Web 界面

启动成功后，在浏览器中打开：

- **主页面**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/api/health

## 使用说明

### 1. 上传图片

- 点击上传区域选择图片，或直接拖拽图片到上传区
- 支持格式：JPG, PNG
- 文件大小限制：10MB

### 2. 生成 3D 场景

- 点击"生成 3D 场景"按钮
- 等待处理完成（通常 10-60 秒，取决于 GPU 性能）
- 处理过程中会显示进度提示

### 3. 查看和交互

生成完成后，会自动进入 3D 查看器：

- **旋转**：鼠标左键拖拽
- **平移**：鼠标右键拖拽
- **缩放**：鼠标滚轮

### 4. 返回上传

点击右上角"返回上传"按钮可以返回首页上传新图片。

## 项目结构

```
ml-sharp-demo/
├── backend/
│   ├── app.py                 # FastAPI 主应用
│   ├── config.py             # 配置文件
│   ├── requirements.txt      # Python 依赖
│   └── uploads/              # 上传和输出目录
│       └── outputs/          # ml-sharp 生成的 PLY 文件
├── frontend/
│   ├── index.html            # 主页面
│   ├── css/
│   │   └── style.css        # 样式文件
│   └── js/
│       ├── main.js          # 主逻辑
│       └── viewer.js        # 3D 渲染器
├── start.sh                  # 一键启动脚本
├── stop.sh                   # 停止服务脚本
├── pyproject.toml            # Python 项目配置
├── README.md                 # 本文件
└── .gitignore               # Git 忽略配置
```

## API 文档

### POST /api/upload

上传图片文件。

**请求**：
- Content-Type: `multipart/form-data`
- Body: `file` (图片文件)

**响应**：
```json
{
    "task_id": "uuid-string",
    "filename": "image.jpg"
}
```

### POST /api/process/{task_id}

触发 ml-sharp 处理。

**响应**：
```json
{
    "status": "processing",
    "task_id": "uuid-string"
}
```

### GET /api/status/{task_id}

查询处理状态。

**响应**：
```json
{
    "status": "completed|processing|failed|uploaded",
    "error": null,
    "has_output": true
}
```

### GET /api/result/{task_id}

下载生成的 PLY 文件。

**响应**：PLY 文件（application/octet-stream）

### GET /api/health

健康检查。

**响应**：
```json
{
    "status": "healthy",
    "tasks_count": 5
}
```

## 故障排除

### ml-sharp 命令未找到

确保已激活正确的 Python 环境：

```bash
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate  # Windows
```

### CUDA 相关错误

检查 PyTorch CUDA 是否正确安装：

```python
import torch
print(torch.cuda.is_available())  # 应该返回 True
print(torch.cuda.get_device_name(0))  # 显示 GPU 名称
```

### 处理超时

如果图片处理时间过长，可以在 `backend/config.py` 中调整超时设置：

```python
SHARP_TIMEOUT = 600  # 增加到 10 分钟
```

### 内存不足

如果遇到 CUDA 内存不足错误：

1. 减小输入图片尺寸
2. 关闭其他占用 GPU 的程序
3. 使用更大显存的 GPU

### 浏览器加载 3D 场景失败

确保使用现代浏览器（Chrome/Edge/Firefox 最新版），并检查：

1. 浏览器控制台是否有错误信息
2. PLY 文件是否正确生成（检查 `backend/uploads/{task_id}/output/`）
3. 网络连接是否正常（CDN 资源加载）

## 性能优化

### 后端优化

1. **图片预处理**：可以在上传时自动调整图片大小以加快处理速度
2. **任务队列**：使用 Celery 或 RQ 处理并发请求
3. **缓存**：缓存已处理的图片结果

### 前端优化

1. **渐进式加载**：已启用 `progressiveLoad` 选项
2. **WebWorker**：将 PLY 解析移至 Web Worker
3. **压缩传输**：启用 gzip 压缩 PLY 文件

## 已知限制

1. **处理时间**：单张图片处理时间约 10-60 秒（取决于 GPU）
2. **文件大小**：上传限制 10MB
3. **并发处理**：默认不支持多任务并发（可通过任务队列解决）
4. **浏览器兼容性**：需要支持 WebGL 2.0 和 ES6 Modules

## 参考资源

- [ml-sharp GitHub](https://github.com/apple/ml-sharp)
- [ml-sharp 论文](https://machinelearning.apple.com/research/sharp-monocular-view)
- [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D)
- [Three.js 文档](https://threejs.org/docs/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)

## 许可证

本项目仅用于演示和学习目的。ml-sharp 遵循其原始许可证。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请在 GitHub 上创建 Issue。
