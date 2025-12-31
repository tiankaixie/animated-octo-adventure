#!/bin/bash

# ML-SHARP Web Demo - 启动脚本
# 使用方法: ./start.sh

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=================================================="
echo "  ML-SHARP Web Demo - 启动程序"
echo "=================================================="
echo ""

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    print_error "虚拟环境不存在！"
    print_info "请先运行安装命令创建虚拟环境"
    exit 1
fi

print_success "找到虚拟环境 (.venv)"

# 激活虚拟环境
print_info "激活虚拟环境..."
source .venv/bin/activate

# 检查 sharp 命令
if ! command -v sharp &> /dev/null; then
    print_error "ml-sharp 未安装！"
    print_info "请运行安装脚本或手动安装依赖"
    exit 1
fi

print_success "ml-sharp 已安装 ($(sharp --help | head -n 1))"

# 检查 Python 依赖
print_info "检查 Python 依赖..."
python -c "import fastapi, uvicorn" 2>/dev/null
if [ $? -ne 0 ]; then
    print_error "后端依赖未安装！"
    print_info "请运行: uv pip install -r backend/requirements.txt"
    exit 1
fi

print_success "后端依赖检查通过"

# 检查 PyTorch MPS 支持
print_info "检查 GPU 支持..."
MPS_STATUS=$(python -c "import torch; print(torch.backends.mps.is_available())" 2>/dev/null)
if [ "$MPS_STATUS" = "True" ]; then
    print_success "MPS (Apple Silicon GPU) 已启用"
else
    print_warning "MPS 不可用，将使用 CPU（速度较慢）"
fi

# 创建必要的目录
print_info "检查目录结构..."
mkdir -p backend/uploads/outputs
print_success "目录结构正常"

# 检查端口占用
PORT=8000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "端口 $PORT 已被占用"
    print_info "尝试终止占用进程..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# 启动服务器
print_info "启动 FastAPI 服务器..."
echo ""
echo "=================================================="
echo "  服务器信息"
echo "=================================================="
echo "  访问地址: http://localhost:$PORT"
echo "  API 文档: http://localhost:$PORT/docs"
echo "  健康检查: http://localhost:$PORT/api/health"
echo ""
echo "  按 Ctrl+C 停止服务器"
echo "=================================================="
echo ""

# 启动服务器
cd backend
exec uvicorn app:app --host 0.0.0.0 --port $PORT --reload
