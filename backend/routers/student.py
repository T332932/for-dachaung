from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.schemas import StudentAskRequest, StudentAskResponse
from services.rag_service import RAGService


router = APIRouter(tags=["student"])
rag_service = RAGService()


@router.post("/ask", response_model=StudentAskResponse)
async def student_ask(body: StudentAskRequest, db: Session = Depends(get_db)):
    """
    学生端 RAG 问答：基于题库向量相似度返回关联题目与参考解答摘要。
    支持硅基流动 Embedding（BGE-M3）或 OpenAI embedding。
    """
    return await rag_service.ask(db, body.question)


@router.get("/search")
async def semantic_search(
    q: str = Query(..., description="搜索关键词或问题描述"),
    top_k: int = Query(5, ge=1, le=20, description="返回的最大结果数"),
    db: Session = Depends(get_db),
) -> List[dict]:
    """
    语义搜索题目：根据文本描述找到相似的题目。
    使用 Embedding 向量相似度匹配，支持自然语言描述。
    """
    return await rag_service.search_similar(db, q, top_k=top_k)

