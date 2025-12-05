from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from config import get_settings
from db import get_db
from models import orm
from models.schemas import LoginRequest, TokenResponse, UserCreateRequest, UserView
from utils.security import (
    authenticate_user,
    create_access_token,
    get_password_hash,
)
from services.captcha_service import create_captcha, verify_captcha


router = APIRouter(tags=["auth"])
settings = get_settings()


class CaptchaResponse(BaseModel):
    captchaId: str
    captchaImage: str  # base64 图片


@router.get("/auth/captcha", response_model=CaptchaResponse)
async def get_captcha():
    """
    获取图片验证码
    """
    captcha_id, captcha_image = create_captcha()
    return CaptchaResponse(captchaId=captcha_id, captchaImage=captcha_image)


@router.post("/auth/register", response_model=UserView)
async def register_user(body: UserCreateRequest, db: Session = Depends(get_db)):
    """
    创建用户，需要验证邀请码和验证码。
    """
    # 1. 验证邀请码（如果配置了）
    if settings.invite_code:
        if not body.inviteCode or body.inviteCode != settings.invite_code:
            raise HTTPException(status_code=400, detail="邀请码错误或缺失")
    
    # 2. 验证验证码
    if not body.captchaId or not body.captchaCode:
        raise HTTPException(status_code=400, detail="请输入验证码")
    
    if not verify_captcha(body.captchaId, body.captchaCode):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    
    # 3. 检查用户名是否已存在
    existing = db.query(orm.User).filter(orm.User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 4. 创建用户
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
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token)
