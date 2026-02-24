#!/bin/bash
# 前后端联调快速启动脚本
# 用法: bash start-dev.sh

echo "=========================================="
echo "🚀 牌局计分系统 - 前后端联调启动"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}【步骤 1/3】检查后端${NC}"
echo ""

# 检查后端是否运行
BACKEND_URL="http://localhost:3000/api/health"
echo "检查后端健康状态: $BACKEND_URL"

if command -v curl &> /dev/null; then
    if curl -s "$BACKEND_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 后端已启动${NC}"
        BACKEND_RUNNING=1
    else
        echo -e "${YELLOW}⚠️ 后端未响应（可能未启动）${NC}"
        BACKEND_RUNNING=0
    fi
else
    echo -e "${YELLOW}⚠️ 无法检查后端（curl 未安装）${NC}"
    BACKEND_RUNNING=0
fi

if [ $BACKEND_RUNNING -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}需要启动后端。请在另一个终端执行：${NC}"
    echo ""
    echo "  cd F:\\代码\\计分系统\\后端\\poker-scorekeeper"
    echo "  npm install  # 首次运行"
    echo "  npm run dev"
    echo ""
    read -p "后端启动后，按 Enter 继续..."
fi

echo ""
echo -e "${BLUE}【步骤 2/3】安装前端依赖${NC}"
echo ""

cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
    echo "node_modules 不存在，正在安装依赖..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 依赖安装成功${NC}"
    else
        echo -e "${RED}❌ 依赖安装失败${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi

echo ""
echo -e "${BLUE}【步骤 3/3】启动前端开发服务器${NC}"
echo ""

echo "启动信息："
echo "  前端地址: http://localhost:5173"
echo "  后端地址: http://localhost:3000/api"
echo ""

echo "按 Ctrl+C 停止服务器"
echo ""

npm run dev

