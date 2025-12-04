# 部署指南

## 推送代码到GitHub

### 方式一：使用GitHub CLI（推荐）

```bash
# 如果没有安装gh，先安装
brew install gh

# 登录GitHub（会打开浏览器授权）
gh auth login

# 推送代码
cd /Users/siyu/Applications/zujuan
git push -u origin main
```

### 方式二：使用Personal Access Token

1. 访问：https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 复制生成的token
5. 推送时使用token作为密码：

```bash
cd /Users/siyu/Applications/zujuan
git remote set-url origin https://T332932:<TOKEN>@github.com/T332932/for-dachaung.git
git push -u origin main
```

### 方式三：使用SSH

```bash
# 配置SSH key（如果还没有）
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub  # 复制公钥到GitHub Settings > SSH Keys

# 更改remote URL
git remote set-url origin git@github.com:T332932/for-dachaung.git
git push -u origin main
```

---

## 服务器部署

### 前置要求

服务器需要安装：
- Docker
- Docker Compose
- Git

### 部署步骤

#### 1. 克隆代码到服务器

```bash
# SSH连接到服务器
ssh user@your-server-ip

# 克隆仓库
git clone https://github.com/T332932/for-dachaung.git
cd for-dachaung
```

#### 2. 配置环境变量

```bash
# 创建 .env 文件
cat > .env << 'EOF'
# Gemini API配置
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro

# 数据库配置
DATABASE_URL=postgresql+psycopg2://zujuan:zujuan@db:5432/zujuan

# 安全配置（生产环境请修改）
SECRET_KEY=your-secret-key-here
POSTGRES_PASSWORD=your_secure_password
EOF
```

#### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 检查服务状态
docker-compose ps
```

#### 4. 初始化数据库

```bash
# 运行数据库迁移
docker-compose exec api alembic upgrade head

# 或者手动进入容器
docker-compose exec api bash
alembic upgrade head
exit
```

#### 5. 验证服务

```bash
# 测试API健康检查
curl http://localhost:8000/health

# 应该返回：{"status":"ok"}
```

---

## 测试Gemini API

### 运行测试脚本

```bash
# 在服务器上
docker-compose exec api python /app/scripts/gemini_smoketest.py

# 或本地测试（需要安装依赖）
cd /Users/siyu/Applications/zujuan
pip install google-generativeai pillow
export GEMINI_API_KEY="your_key_here"
python scripts/gemini_smoketest.py
```

### 测试题目上传

准备一张数学题图片（如 `test_question.jpg`），然后：

```bash
# 上传图片并分析
curl -X POST http://localhost:8000/api/teacher/questions/analyze \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_question.jpg"
```

---

## 常见问题

### 1. 端口冲突

如果8000端口被占用，修改 `docker-compose.yml`:

```yaml
services:
  api:
    ports:
      - "8080:8000"  # 改为8080
```

### 2. Gemini API配额限制

免费版有速率限制，测试时注意：
- 每分钟最多15次请求
- 每天最多1500次请求

### 3. 数据库连接失败

```bash
# 检查数据库容器状态
docker-compose logs db

# 重启数据库
docker-compose restart db
```

### 4. 查看详细日志

```bash
# 查看API日志
docker-compose logs -f api

# 查看所有服务日志
docker-compose logs -f
```

---

## 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（会清空数据库）
docker-compose down -v
```

---

## 下一步

1. **推送代码到GitHub**（使用上述方式一）
2. **在服务器上克隆代码**
3. **配置Gemini API Key**
4. **启动服务并测试**
5. **准备20张测试图片，验证识别效果**

## 生产环境建议

- 使用Nginx作为反向代理
- 配置HTTPS证书（Let's Encrypt）
- 修改默认密码
- 配置防火墙规则
- 定期备份数据库
- 配置日志轮转
