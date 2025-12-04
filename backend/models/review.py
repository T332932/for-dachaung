import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from db import Base


def _uuid():
    return str(uuid.uuid4())


class QuestionReview(Base):
    __tablename__ = "question_reviews"

    id = Column(String(36), primary_key=True, default=_uuid)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False)
    reviewer_id = Column(String(36), nullable=True)
    status = Column(String(32), default="pending")  # pending/approved/rejected
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    question = relationship("Question", back_populates="reviews")
