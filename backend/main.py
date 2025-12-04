from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, teacher, student, review
from db import init_db


app = FastAPI(
    title="Zujuan API",
    version="0.1.0",
    description="AI 驱动的智能组卷与教学辅助平台后端骨架",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(teacher.router, prefix="/api/teacher")
app.include_router(student.router, prefix="/api/student")
app.include_router(review.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    # 简单同步建表，后续可替换为 Alembic 迁移
    init_db()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
