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
    _ensure_extra_columns()


def _ensure_extra_columns():
    """
    简单迁移：如 questions 表缺少新增列，则自动添加。
    仅做轻量防护，真正生产环境应使用 Alembic。
    """
    def _ensure_column_sqlite(conn, col_name, col_type):
        res = conn.execute(text("PRAGMA table_info(questions);"))
        cols = [row[1] for row in res.fetchall()]
        if col_name not in cols:
            conn.execute(text(f"ALTER TABLE questions ADD COLUMN {col_name} {col_type};"))

    def _ensure_column_pg(conn, col_name, col_type, default_sql=""):
        res = conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='questions';")
        )
        cols = [row[0] for row in res.fetchall()]
        if col_name not in cols:
            conn.execute(text(f"ALTER TABLE questions ADD COLUMN {col_name} {col_type} {default_sql};"))

    try:
        with engine.begin() as conn:
            if _is_sqlite:
                _ensure_column_sqlite(conn, "is_public", "BOOLEAN DEFAULT 0")
                _ensure_column_sqlite(conn, "status", "VARCHAR(32) DEFAULT 'pending'")
                _ensure_column_sqlite(conn, "is_high_school", "BOOLEAN DEFAULT 1")
            elif DATABASE_URL.startswith("postgres"):
                _ensure_column_pg(conn, "is_public", "BOOLEAN", "DEFAULT FALSE")
                _ensure_column_pg(conn, "status", "VARCHAR(32)", "DEFAULT 'pending'")
                _ensure_column_pg(conn, "is_high_school", "BOOLEAN", "DEFAULT TRUE")
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
