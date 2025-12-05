from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.schemas import StudentAskRequest, StudentAskResponse
from models import orm
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


@router.get("/embedding-status")
async def embedding_status(db: Session = Depends(get_db)) -> dict:
    """
    检查 Embedding 服务状态和索引覆盖情况。
    """
    total_questions = db.query(orm.Question).count()
    indexed_questions = db.query(orm.QuestionEmbedding).count()
    
    return {
        "embeddingAvailable": rag_service.client is not None,
        "embeddingModel": rag_service.embed_model,
        "totalQuestions": total_questions,
        "indexedQuestions": indexed_questions,
        "coverage": f"{indexed_questions}/{total_questions}",
    }


@router.post("/reindex")
async def reindex_all(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    """
    重建所有题目的 Embedding 索引（后台异步执行）。
    """
    if not rag_service.client:
        return {"success": False, "message": "Embedding 服务未配置"}
    
    # 获取所有未索引的题目ID
    all_question_ids = [q.id for q in db.query(orm.Question.id).all()]
    existing_ids = {e.question_id for e in db.query(orm.QuestionEmbedding.question_id).all()}
    pending_ids = [qid for qid in all_question_ids if qid not in existing_ids]
    
    async def reindex_in_background(question_ids: List[str]):
        from db import session_scope
        with session_scope() as bg_db:
            for qid in question_ids:
                await rag_service.index_question(bg_db, qid)
    
    if pending_ids:
        background_tasks.add_task(reindex_in_background, pending_ids)
    
    return {
        "success": True,
        "message": f"开始后台索引 {len(pending_ids)} 道题目",
        "pendingCount": len(pending_ids),
        "alreadyIndexed": len(existing_ids),
    }
