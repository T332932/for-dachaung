#!/bin/bash
# 服务器一键部署脚本
# 使用方式：
#   1. SSH连接到服务器
#   2. 下载并运行此脚本：curl -sSL https://raw.githubusercontent.com/T332932/for-dachaung/main/quick-deploy.sh | bash

set -e

echo "=========================================="
echo "AI智能组卷平台 - 快速部署"
echo "=========================================="
echo ""

# 1. 检查并安装Docker
echo "📦 检查Docker..."
if ! command -v docker &> /dev/null; then
    echo "正在安装Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
else
    echo "✅ Docker已安装"
fi

# 2. 检查Docker Compose
echo "📦 检查Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "正在安装Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "✅ Docker Compose已安装"
fi

# 3. 克隆代码
echo ""
echo "📥 克隆代码..."
if [ -d "for-dachaung" ]; then
    echo "目录已存在，更新代码..."
    cd for-dachaung
    git pull
else
    git clone https://github.com/T332932/for-dachaung.git
    cd for-dachaung
fi

# 4. 配置环境变量
echo ""
echo "⚙️  配置环境变量..."
if [ ! -f .env ]; then
    echo "请输入您的Gemini API Key（如果没有，留空使用stub模式）:"
    read -p "GEMINI_API_KEY=" GEMINI_KEY
    
    cat > .env << EOF
# AI Provider配置
AI_PROVIDER=gemini
GEMINI_API_KEY=${GEMINI_KEY}
GEMINI_MODEL=gemini-2.5-pro

# 数据库配置
DATABASE_URL=postgresql+psycopg2://zujuan:zujuan@db:5432/zujuan
POSTGRES_USER=zujuan
POSTGRES_PASSWORD=zujuan_$(openssl rand -hex 16)
POSTGRES_DB=zujuan

# 安全配置
SECRET_KEY=$(openssl rand -hex 32)
PYTHONUNBUFFERED=1
EOF
    echo "✅ 配置文件已创建"
else
    echo "✅ 配置文件已存在"
fi

# 5. 启动服务
echo ""
echo "🚀 启动服务..."
docker-compose down -v 2>/dev/null || true
docker-compose up -d --build

# 6. 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 15

# 7. 初始化数据库
echo ""
echo "🗄️  初始化数据库..."
docker-compose exec -T api alembic upgrade head || echo "数据库迁移可能已完成"

# 8. 健康检查
echo ""
echo "🏥 健康检查..."
if curl -s -f http://localhost:8000/health > /dev/null; then
    echo "✅ API服务正常"
else
    echo "⚠️  API服务可能未完全启动，查看日志："
    echo "   docker-compose logs api"
fi

# 9. 显示信息
echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "📝 服务信息："
echo "  - API地址: http://$(curl -s ifconfig.me):8000"
echo "  - 本地API: http://localhost:8000"
echo "  - API文档: http://localhost:8000/docs"
echo "  - 健康检查: http://localhost:8000/health"
echo ""
echo "📋 常用命令："
echo "  - 查看日志: docker-compose logs -f"
echo "  - 重启服务: docker-compose restart"
echo "  - 停止服务: docker-compose down"
echo "  - 查看状态: docker-compose ps"
echo ""
echo "🧪 测试命令："
echo "  curl http://localhost:8000/health"
echo ""
