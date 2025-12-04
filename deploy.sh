#!/bin/bash
# 服务器部署脚本
# 使用方法：在服务器上运行 bash deploy.sh

set -e  # 遇到错误立即退出

echo "=========================================="
echo "AI智能组卷平台 - 服务器部署脚本"
echo "=========================================="
echo ""

# 检查环境
echo "🔍 检查环境..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker和Docker Compose已安装"
echo ""

# 检查Gemini API Key
echo "🔑 检查Gemini API Key..."
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  警告：GEMINI_API_KEY环境变量未设置"
    read -p "请输入您的Gemini API Key: " GEMINI_API_KEY
    export GEMINI_API_KEY
fi

# 创建.env文件
echo "📝 创建配置文件..."
cat > .env << EOF
# Gemini API配置
GEMINI_API_KEY=$GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-pro

# 数据库配置
DATABASE_URL=postgresql+psycopg2://zujuan:zujuan@db:5432/zujuan
POSTGRES_USER=zujuan
POSTGRES_PASSWORD=zujuan_secure_password_$(date +%s)
POSTGRES_DB=zujuan

# 应用配置
SECRET_KEY=secret_key_$(openssl rand -hex 32)
PYTHONUNBUFFERED=1
EOF

echo "✅ 配置文件已创建"
echo ""

# 构建和启动服务
echo "🚀 启动服务..."
docker-compose down -v  # 清理旧容器
docker-compose up -d --build

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 检查服务状态..."
docker-compose ps

# 运行数据库迁移
echo ""
echo "🗄️  初始化数据库..."
docker-compose exec -T api alembic upgrade head

# 健康检查
echo ""
echo "🏥 健康检查..."
if curl -s -f http://localhost:8000/health > /dev/null; then
    echo "✅ API服务正常"
else
    echo "❌ API服务异常，请检查日志"
    docker-compose logs api
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 部署成功！"
echo "=========================================="
echo ""
echo "📝 服务访问地址："
echo "  - API: http://localhost:8000"
echo "  - 健康检查: http://localhost:8000/health"
echo "  - API文档: http://localhost:8000/docs"
echo ""
echo "📋 常用命令："
echo "  - 查看日志: docker-compose logs -f"
echo "  - 重启服务: docker-compose restart"
echo "  - 停止服务: docker-compose down"
echo ""
echo "🧪 下一步："
echo "  1. 运行测试脚本: docker-compose exec api python scripts/gemini_smoketest.py"
echo "  2. 测试题目上传功能"
echo "  3. 准备20张测试图片进行批量测试"
echo ""
