#!/bin/bash

# ML-SHARP Web Demo - 智能环境设置脚本
# 优先使用共享环境，没有则创建本地环境
#
# Input: None
# Output: Activated Python virtual environment
# Pos: Project setup utility for quick environment activation
# If this file is updated, you must update this header and the parent folder's README.md.

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 配置
SHARED_VENV_DIR="$HOME/.venvs"
SHARED_VENV_NAME="ml-sharp-demo"
SHARED_VENV_PATH="$SHARED_VENV_DIR/$SHARED_VENV_NAME"
LOCAL_VENV_PATH="$SCRIPT_DIR/.venv"
PYTHON_VERSION="3.13"

echo "=================================================="
echo "  ML-SHARP Web Demo - 环境设置"
echo "=================================================="
echo ""

# 检查 uv 是否安装
if ! command -v uv &> /dev/null; then
    print_error "uv 未安装！请先安装: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# 函数：安装依赖
install_deps() {
    local venv_path=$1
    print_info "安装后端依赖..."
    source "$venv_path/bin/activate"
    uv pip install -r "$SCRIPT_DIR/backend/requirements.txt"
    print_success "依赖安装完成"
}

# 函数：创建共享环境
create_shared_venv() {
    print_info "创建共享虚拟环境: $SHARED_VENV_PATH"
    mkdir -p "$SHARED_VENV_DIR"
    uv venv --python "$PYTHON_VERSION" "$SHARED_VENV_PATH"
    install_deps "$SHARED_VENV_PATH"

    # 创建本地符号链接
    ln -sf "$SHARED_VENV_PATH" "$LOCAL_VENV_PATH"
    print_success "共享环境创建完成，已创建本地链接"
}

# 函数：创建本地环境
create_local_venv() {
    print_info "创建本地虚拟环境: $LOCAL_VENV_PATH"
    uv venv --python "$PYTHON_VERSION" "$LOCAL_VENV_PATH"
    install_deps "$LOCAL_VENV_PATH"
    print_success "本地环境创建完成"
}

# 主逻辑
if [ -d "$LOCAL_VENV_PATH" ] || [ -L "$LOCAL_VENV_PATH" ]; then
    # 本地已有 .venv (可能是符号链接或实际目录)
    if [ -L "$LOCAL_VENV_PATH" ]; then
        # 是符号链接，检查目标是否存在
        if [ -d "$(readlink "$LOCAL_VENV_PATH")" ]; then
            print_success "使用已链接的共享环境: $(readlink "$LOCAL_VENV_PATH")"
        else
            print_warning "符号链接目标不存在，重新创建..."
            rm "$LOCAL_VENV_PATH"
            if [ -d "$SHARED_VENV_PATH" ]; then
                ln -sf "$SHARED_VENV_PATH" "$LOCAL_VENV_PATH"
                print_success "已重新链接到共享环境"
            else
                create_shared_venv
            fi
        fi
    else
        print_success "使用本地虚拟环境"
    fi
elif [ -d "$SHARED_VENV_PATH" ]; then
    # 共享环境存在，创建符号链接
    print_info "发现共享环境，创建本地链接..."
    ln -sf "$SHARED_VENV_PATH" "$LOCAL_VENV_PATH"
    print_success "已链接到共享环境: $SHARED_VENV_PATH"
else
    # 都不存在，创建共享环境
    print_info "未发现现有环境，创建新的共享环境..."
    create_shared_venv
fi

# 验证环境
source "$LOCAL_VENV_PATH/bin/activate"

# 检查依赖是否完整
if ! python -c "import fastapi, uvicorn" 2>/dev/null; then
    print_warning "依赖不完整，正在安装..."
    install_deps "$LOCAL_VENV_PATH"
fi

echo ""
echo "=================================================="
print_success "环境设置完成！"
echo "=================================================="
echo ""
echo "  虚拟环境: $LOCAL_VENV_PATH"
if [ -L "$LOCAL_VENV_PATH" ]; then
    echo "  (链接到: $(readlink "$LOCAL_VENV_PATH"))"
fi
echo ""
echo "  激活环境: source .venv/bin/activate"
echo "  启动服务: ./start.sh"
echo ""
