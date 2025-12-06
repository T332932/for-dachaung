import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from db import Base
from models import review


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    username = Column(String(128), unique=True, nullable=False)
    email = Column(String(256), unique=True, nullable=True)
    role = Column(String(32), default="teacher")
    password_hash = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=_uuid)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, nullable=True)
    answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    has_geometry = Column(Boolean, default=False)
    geometry_svg = Column(Text, nullable=True)
    geometry_tikz = Column(Text, nullable=True)
    knowledge_points = Column(JSON, default=list)
    difficulty = Column(String(16), default="medium")
    question_type = Column(String(16), default="solve")
    source = Column(String(256), nullable=True)
    year = Column(Integer, nullable=True)
    is_high_school = Column(Boolean, default=True)
    ai_generated = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)
    status = Column(String(32), default="pending")  # pending/approved/rejected
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    reviews = relationship("QuestionReview", back_populates="question", cascade="all, delete-orphan")


class QuestionEmbedding(Base):
    __tablename__ = "question_embeddings"

    question_id = Column(String(36), ForeignKey("questions.id"), primary_key=True)
    # 使用 JSON 存储向量，便于快速落地，无需 pgvector 依赖；后续可替换为向量类型
    embedding = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Paper(Base):
    __tablename__ = "papers"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    template_type = Column(String(64), default="custom")
    total_score = Column(Integer, default=0)
    time_limit = Column(Integer, nullable=True)  # minutes
    tags = Column(JSON, default=list)
    subject = Column(String(64), default="math")
    grade_level = Column(String(64), default="high")
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    published_at = Column(DateTime, nullable=True)

    questions = relationship("PaperQuestion", back_populates="paper", cascade="all, delete-orphan")


class PaperQuestion(Base):
    __tablename__ = "paper_questions"

    id = Column(String(36), primary_key=True, default=_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False)
    order = Column(Integer, nullable=False, default=1)
    score = Column(Integer, nullable=False, default=0)
    custom_label = Column(String(64), nullable=True)

    paper = relationship("Paper", back_populates="questions")


class PublishReview(Base):
    """
    发布到公开库的审核请求
    status: pending/approved/rejected
    review_type: duplicate(重题)/similar(相似)/suspicious(可疑坏题)
    """
    __tablename__ = "publish_reviews"

    id = Column(String(36), primary_key=True, default=_uuid)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False)
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(String(16), default="pending")  # pending/approved/rejected
    review_type = Column(String(16), nullable=False)  # similar/suspicious
    similarity_score = Column(Integer, nullable=True)  # 0-100 百分比
    similar_question_id = Column(String(36), nullable=True)  # 最相似题目ID
    admin_notes = Column(Text, nullable=True)
    reviewed_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)

    question = relationship("Question")
