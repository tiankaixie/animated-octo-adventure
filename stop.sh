#!/bin/bash

# ML-SHARP Web Demo - 停止脚本
# 使用方法: ./stop.sh

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo "=================================================="
echo "  ML-SHARP Web Demo - 停止服务"
echo "=================================================="
echo ""

# 查找并终止占用端口 8000 的进程
PORT=8000

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_info "发现运行在端口 $PORT 的进程..."

    # 获取进程信息
    PID=$(lsof -ti:$PORT)
    PROCESS_INFO=$(ps -p $PID -o comm=)

    print_info "进程信息: $PROCESS_INFO (PID: $PID)"
    print_info "终止进程..."

    # 终止进程
    kill $PID 2>/dev/null

    # 等待进程结束
    sleep 2

    # 检查是否还在运行
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "进程未响应，强制终止..."
        kill -9 $PID 2>/dev/null
    fi

    print_success "服务已停止"
else
    print_warning "没有发现运行在端口 $PORT 的服务"
fi

echo ""
echo "完成！"
