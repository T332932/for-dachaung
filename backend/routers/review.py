from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models import orm
from models.schemas import ReviewCreateRequest, ReviewView
from utils.deps import require_role


router = APIRouter(tags=["review"])


@router.post("/reviews", response_model=ReviewView)
async def create_review(
    payload: ReviewCreateRequest,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    题目审核记录创建（简易占位）。
    """
    try:
        review = orm.QuestionReview(
            question_id=payload.questionId,
            reviewer_id=payload.reviewerId or (current_user.id if current_user else None),
            status=payload.status,
            comment=payload.comment,
        )
        db.add(review)
        db.commit()
        db.refresh(review)
    except Exception:
        db.rollback()
        raise
    return ReviewView(
        id=review.id,
        questionId=review.question_id,
        reviewerId=review.reviewer_id,
        status=review.status,
        comment=review.comment,
        createdAt=str(review.created_at),
        updatedAt=str(review.updated_at),
    )
