from fastapi import APIRouter

from models.schemas import StudentAskRequest, StudentAskResponse
from services.rag_service import RAGService


router = APIRouter(tags=["student"])
rag_service = RAGService()


@router.post("/ask", response_model=StudentAskResponse)
async def student_ask(body: StudentAskRequest):
    """
    学生端 RAG 问答占位接口，返回固定示例。
    后续接入向量检索与 LLM。
    """
    return await rag_service.ask(body.question)
