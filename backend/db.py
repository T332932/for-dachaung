import os
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import get_settings


settings = get_settings()
DATABASE_URL = settings.database_url
_is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    from models import orm  # noqa: F401  # ensure models are imported
    from models import review  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_is_public_column()


def _ensure_is_public_column():
    """
    简单迁移：如 questions 表缺少 is_public 列，则自动添加。
    仅做轻量防护，真正生产环境应使用 Alembic。
    """
    try:
        with engine.begin() as conn:
            if _is_sqlite:
                res = conn.execute(text("PRAGMA table_info(questions);"))
                cols = [row[1] for row in res.fetchall()]
                if "is_public" not in cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN is_public BOOLEAN DEFAULT 0;"))
            elif DATABASE_URL.startswith("postgres"):
                res = conn.execute(
                    text("SELECT column_name FROM information_schema.columns WHERE table_name='questions';")
                )
                cols = [row[0] for row in res.fetchall()]
                if "is_public" not in cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN is_public BOOLEAN DEFAULT FALSE;"))
        else:
            # 其他数据库不做自动迁移
            pass
    except Exception:
        # 若迁移失败，不影响应用启动，但后续查询可能报错，建议使用 Alembic 正式迁移
        pass


@contextmanager
def session_scope():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
