# AI 智能组卷与教学辅助平台（后端原型）

## 功能概览
- FastAPI 后端：教师/学生/认证/审核路由占位。
- 题目与试卷：创建、分页查询，试卷导出。
- 导出：生成 LaTeX；若本机有 `pdflatex` 可导出 PDF，安装 `python-docx` 可导出 DOCX。
- AI 解析：Gemini 调用占位（未配 API 时返回 stub）。
- 审核：题目审核记录（QuestionReview）。
- 运行方式：直接运行 uvicorn（默认 SQLite）或 Docker Compose（Postgres）。

## 快速开始

### 依赖
- Python 3.11+
- 可选：`pdflatex`（PDF 导出）、`python-docx`（Word 导出，已在 requirements）、`google-generativeai`（Gemini）
- 可选：`cairosvg`（将 SVG 转为 PNG 以便导出 PDF/DOCX）

### 本地运行（默认 SQLite）
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
接口示例：
- 健康检查：GET http://localhost:8000/health
- 用户注册：POST /api/auth/register
- 用户登录：POST /api/auth/login
- 题目入库：POST /api/teacher/questions
- 试卷入库：POST /api/teacher/papers
- 试卷导出：GET /api/teacher/papers/{id}/export?format=pdf|docx&include_answer=true

### Docker Compose（Postgres）
```bash
# 根目录
docker-compose up --build
# API 使用 env DATABASE_URL=postgresql+psycopg2://zujuan:zujuan@db:5432/zujuan
```

### 迁移
- 自动建表：运行 uvicorn 时会直接创建表
- Alembic：`alembic upgrade head`（默认 SQLite，可在 alembic.ini 或 env 配置 DATABASE_URL）

## 项目结构（关键部分）
```
backend/
  main.py               # FastAPI 入口，路由注册，启动建表
  config.py             # 环境配置（DATABASE_URL、Gemini）
  db.py                 # SQLAlchemy Engine/Session/Init
  models/
    orm.py              # User/Question/Paper/PaperQuestion
    review.py           # QuestionReview
    schemas.py          # Pydantic 模型
  routers/
    auth.py, teacher.py, student.py, review.py
  services/
    gemini_service.py   # Gemini 占位解析
    export_service.py   # LaTeX 生成，PDF/DOCX 导出
docs/
  notes/reference-insights.md
  export-spec.md
scripts/
  gemini_smoketest.py   # Gemini 图片解析烟囱脚本
docker-compose.yml      # api + Postgres + Redis 占位
alembic/                # 迁移脚手架
```

## 已知限制
- 导出：LaTeX 基本可用，PDF 需安装 `pdflatex`；Word 未内嵌 SVG，需后续转换或前端处理。
- 安全与权限：未接入真实认证/JWT。
- RAG/搜索：未实现，接口占位。
- 前端：尚未初始化。
