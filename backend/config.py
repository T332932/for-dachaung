from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    
    # AI Provider选择: "gemini" 或 "openai"
    ai_provider: str = "gemini"
    
    # Gemini配置
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-pro"
    
    # OpenAI配置（或OpenAI兼容的API）
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"
    openai_base_url: Optional[str] = None  # 如 http://localhost:3000/v1 用于代理
    
    # 硅基流动 Embedding 配置
    siliconflow_api_key: Optional[str] = None
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    siliconflow_embed_model: str = "BAAI/bge-m3"  # 效果好的中文 embedding 模型
    
    # 安全配置
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # 注册邀请码（为空则不需要邀请码）
    invite_code: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
