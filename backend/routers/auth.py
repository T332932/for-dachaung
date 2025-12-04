from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from models import orm
from models.schemas import LoginRequest, TokenResponse, UserCreateRequest, UserView
from utils.security import (
    authenticate_user,
    create_access_token,
    get_password_hash,
)


router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=UserView)
async def register_user(body: UserCreateRequest, db: Session = Depends(get_db)):
    """
    创建用户，密码使用 bcrypt 哈希。
    """
    existing = db.query(orm.User).filter(orm.User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    try:
        user = orm.User(
            username=body.username,
            email=body.email,
            role=body.role,
            password_hash=get_password_hash(body.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise
    return UserView.model_validate(user)


@router.post("/auth/login", response_model=TokenResponse)
async def login_for_access_token(
    body: LoginRequest, db: Session = Depends(get_db)
):
    """
    登录并获取 JWT。传入 username/password。
    """
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token)
