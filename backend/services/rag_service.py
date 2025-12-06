import json
from typing import List, Optional

from sqlalchemy.orm import Session

from config import get_settings
from models import orm
from models.schemas import StudentAskResponse
from sqlalchemy import or_

settings = get_settings()

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


class RAGService:
    """
    RAG 实现（硅基流动 Embedding 版）：
    - 使用硅基流动 BGE-M3 生成向量（兼容 OpenAI API 格式）
    - 将向量存入 question_embeddings 表（JSON）
    - 查询时对所有向量做余弦相似度，返回 topK 关联题目
    """

    def __init__(self):
        # 优先使用硅基流动，其次 OpenAI
        self.client = None
        self.embed_model = None
        
        # 尝试硅基流动
        if settings.siliconflow_api_key and OpenAI:
            try:
                self.client = OpenAI(
                    api_key=settings.siliconflow_api_key,
                    base_url=settings.siliconflow_base_url
                )
                self.embed_model = settings.siliconflow_embed_model
            except Exception:
                self.client = None
        
        # 降级到 OpenAI
        if not self.client and settings.openai_api_key and OpenAI:
            try:
                self.client = OpenAI(
                    api_key=settings.openai_api_key,
                    base_url=settings.openai_base_url
                )
                self.embed_model = "text-embedding-3-small"
            except Exception:
                self.client = None

    async def ask(self, db: Session, question: str, top_k: int = 5) -> StudentAskResponse:
        # 如果 embedding 不可用，返回占位
        if not self.client:
            return StudentAskResponse(
                answer="Embedding 服务未配置，返回占位回答。",
                relatedQuestions=[],
                sources=[],
            )

        query_vec = await self._get_embedding(question)
        if not query_vec:
            return StudentAskResponse(
                answer="Embedding 生成失败，无法检索。",
                relatedQuestions=[],
                sources=[],
            )

        # 确保已有题目都有向量
        all_questions: List[orm.Question] = db.query(orm.Question).filter(
            or_(orm.Question.is_public == True, orm.Question.created_by != None)
        ).all()
        existing = {emb.question_id: emb for emb in db.query(orm.QuestionEmbedding).all()}

        for q in all_questions:
            if q.id in existing:
                continue
            vec = await self._get_embedding(self._build_text(q))
            if vec:
                db.merge(orm.QuestionEmbedding(question_id=q.id, embedding=vec))
        db.commit()

        # 重新读取全部向量
        embeddings = {emb.question_id: emb.embedding for emb in db.query(orm.QuestionEmbedding).all()}

        scored = []
        for q in all_questions:
            vec = embeddings.get(q.id)
            if not vec:
                continue
            sim = self._cosine_similarity(query_vec, vec)
            scored.append((sim, q))

        scored.sort(key=lambda x: x[0] if x[0] else 0, reverse=True)
        top = scored[:top_k]

        related = [
            {
                "id": q.id,
                "questionText": (q.question_text or "")[:200],
                "similarity": float(sim) if sim else 0,
            }
            for sim, q in top if sim is not None
        ]
        sources = [item["id"] for item in related]

        # 简单回答模板：列出关联题目和答案
        answer_parts = ["基于相似题目生成的提示："]
        for idx, (_, q) in enumerate(top, 1):
            answer_parts.append(f"【例题{idx}】题干：{(q.question_text or '')[:100]} ...")
            if q.answer:
                answer_parts.append(f"参考解答：{(q.answer or '')[:200]} ...")
        answer = "\n".join(answer_parts)

        return StudentAskResponse(answer=answer, relatedQuestions=related, sources=sources)
    
    async def search_similar(self, db: Session, question_text: str, top_k: int = 5) -> List[dict]:
        """语义搜索题目"""
        if not self.client:
            return []
        
        query_vec = await self._get_embedding(question_text)
        if not query_vec:
            return []
        
        # 获取所有题目和向量
        all_questions = db.query(orm.Question).all()
        embeddings = {emb.question_id: emb.embedding for emb in db.query(orm.QuestionEmbedding).all()}
        
        scored = []
        for q in all_questions:
            vec = embeddings.get(q.id)
            if not vec:
                continue
            sim = self._cosine_similarity(query_vec, vec)
            if sim:
                scored.append((sim, q))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        
        return [
            {
                "id": q.id,
                "questionText": q.question_text,
                "answer": q.answer,
                "similarity": round(sim, 4),
                "difficulty": q.difficulty,
                "questionType": q.question_type,
                "knowledgePoints": q.knowledge_points or [],
            }
            for sim, q in scored[:top_k]
        ]
    
    async def check_publish_eligibility(self, db: Session, question_id: str) -> dict:
        """
        检测题目是否可以发布到公开库
        返回: {
            'eligible': bool,  # 是否直接通过
            'status': 'approved'/'pending_review'/'rejected',
            'reason': str,
            'max_similarity': float,
            'similar_question_id': str or None,
            'review_type': str or None  # 'duplicate'/'similar'/'suspicious'
        }
        阈值:
        - > 0.95: 重题，拒绝
        - 0.8-0.95: 相似题，需管理员审核
        - 0.4-0.8: 正常，自动通过
        - < 0.4: 可疑题目，需管理员审核
        """
        q = db.query(orm.Question).filter(orm.Question.id == question_id).first()
        if not q:
            return {'eligible': False, 'status': 'rejected', 'reason': '题目不存在'}
    
        # 基础校验
        if q.is_high_school is False:
            return {
                'eligible': False,
                'status': 'pending_review',
                'reason': '模型判定该题目不是高中数学题',
                'max_similarity': 0,
                'similar_question_id': None,
                'review_type': 'suspicious'
            }
        if not q.question_text or len(q.question_text.strip()) < 10:
            return {
                'eligible': False, 'status': 'rejected',
                'reason': '题干过短（少于10字符）',
                'max_similarity': 0, 'similar_question_id': None,
                'review_type': None
            }
        if not q.answer or len(q.answer.strip()) < 1:
            return {
                'eligible': False, 'status': 'rejected',
                'reason': '答案为空',
                'max_similarity': 0, 'similar_question_id': None,
                'review_type': None
            }
        
        # 非数学关键词检测
        bad_keywords = ['阅读理解', '完形填空', '古诗词', '作文', '听力', '翻译下列句子']
        for kw in bad_keywords:
            if kw in q.question_text:
                return {
                    'eligible': False, 'status': 'pending_review',
                    'reason': f'检测到非数学关键词: {kw}',
                    'max_similarity': 0, 'similar_question_id': None,
                    'review_type': 'suspicious'
                }
        
        # 没有 embedding 客户端时，自动通过
        if not self.client:
            return {
                'eligible': True, 'status': 'approved',
                'reason': 'Embedding服务未配置，自动通过',
                'max_similarity': 0, 'similar_question_id': None,
                'review_type': None
            }
        
        # 获取当前题目向量
        text = self._build_text(q)
        query_vec = await self._get_embedding(text)
        if not query_vec:
            return {
                'eligible': True, 'status': 'approved',
                'reason': 'Embedding生成失败，自动通过',
                'max_similarity': 0, 'similar_question_id': None,
                'review_type': None
            }
        
        # 只与已公开题目比较
        public_questions = db.query(orm.Question).filter(
            orm.Question.is_public == True,
            orm.Question.id != question_id
        ).all()
        embeddings = {emb.question_id: emb.embedding for emb in db.query(orm.QuestionEmbedding).all()}
        
        max_sim = 0.0
        most_similar_id = None
        
        for pq in public_questions:
            vec = embeddings.get(pq.id)
            if not vec:
                continue
            sim = self._cosine_similarity(query_vec, vec)
            if sim and sim > max_sim:
                max_sim = sim
                most_similar_id = pq.id
        
        # 根据阈值判定
        if max_sim > 0.95:
            return {
                'eligible': False, 'status': 'rejected',
                'reason': f'检测到重复题目（相似度{max_sim:.0%}）',
                'max_similarity': max_sim,
                'similar_question_id': most_similar_id,
                'review_type': 'duplicate'
            }
        elif max_sim >= 0.8:
            return {
                'eligible': False, 'status': 'pending_review',
                'reason': f'存在高度相似题目（相似度{max_sim:.0%}），需管理员审核',
                'max_similarity': max_sim,
                'similar_question_id': most_similar_id,
                'review_type': 'similar'
            }
        elif max_sim >= 0.4:
            return {
                'eligible': True, 'status': 'approved',
                'reason': '通过相似度检测',
                'max_similarity': max_sim,
                'similar_question_id': most_similar_id,
                'review_type': None
            }
        else:
            # 相似度过低，可能是非数学题目
            return {
                'eligible': False, 'status': 'pending_review',
                'reason': f'相似度过低（{max_sim:.0%}），可能不是数学题目',
                'max_similarity': max_sim,
                'similar_question_id': most_similar_id,
                'review_type': 'suspicious'
            }
    
    async def index_question(self, db: Session, question_id: str) -> bool:
        """为单个题目生成 embedding 并存储"""
        if not self.client:
            return False
        
        q = db.query(orm.Question).filter(orm.Question.id == question_id).first()
        if not q:
            return False
        
        text = self._build_text(q)
        vec = await self._get_embedding(text)
        if not vec:
            return False
        
        db.merge(orm.QuestionEmbedding(question_id=q.id, embedding=vec))
        db.commit()
        return True

    def _cosine_similarity(self, a: List[float], b: List[float]) -> Optional[float]:
        if not a or not b or len(a) != len(b):
            return None
        import math

        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        if na == 0 or nb == 0:
            return None
        return dot / (na * nb)

    async def _get_embedding(self, text: str) -> Optional[List[float]]:
        if not self.client or not self.embed_model:
            return None
        try:
            # 截断过长文本
            text = text[:8000] if len(text) > 8000 else text
            resp = self.client.embeddings.create(model=self.embed_model, input=text)
            return resp.data[0].embedding  # type: ignore
        except Exception as e:
            print(f"Embedding error: {e}")
            return None

    def _build_text(self, q: orm.Question) -> str:
        parts = [q.question_text or ""]
        if q.answer:
            parts.append(q.answer)
        if q.knowledge_points:
            parts.append(" ".join(q.knowledge_points))
        return "\n".join(parts)
