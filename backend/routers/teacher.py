from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
from sqlalchemy import or_

from models.schemas import (
    QuestionAnalysisResponse,
    QuestionCreateRequest,
    QuestionCreateResponse,
    QuestionListResponse,
    QuestionView,
    PaperCreateRequest,
    PaperCreateResponse,
    PaperListResponse,
    PaperView,
    PaperQuestionView,
)
from models import orm
from db import get_db
from services.ai_service import AIService, get_ai_service
from services.export_service import ExportService
from services.rag_service import RAGService
from utils.deps import get_current_user, require_role
from templates import get_template


router = APIRouter(tags=["teacher"])
export_service = ExportService()
rag_service = RAGService()

# 默认提示词（可被前端修改）
DEFAULT_PROMPT = """重要：questionText 只包含题干和选项，不要包含任何答案或解析；答案与解题步骤只放在 answer 字段。
SVG 生成要求：
- 使用 <line>, <circle>, <ellipse>, <path>, <text> 标签
- 虚线用 stroke-dasharray="5,5"
- 文本标注用 <text> 标签，内容为数学符号
- viewBox="0 0 400 400"，坐标准确"""


@router.get("/prompt/default")
async def get_default_prompt():
    """获取默认的提示词"""
    return {"prompt": DEFAULT_PROMPT}

@router.post("/questions/analyze", response_model=QuestionAnalysisResponse)
async def analyze_question(
    file: UploadFile = File(...),
    ai_service: AIService = Depends(get_ai_service),
    # 临时移除认证，方便测试
    # current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    题目图片/文件解析：OCR + 结构化 + SVG（若有几何）。
    支持 Gemini 或 OpenAI（通过配置选择）。
    """
    return await ai_service.analyze(file)


@router.post("/questions/preview")
async def preview_question(
    file: UploadFile = File(...),
    format: str = Query("json", pattern="^(json|pdf)$"),
    include_answer: bool = Query(True),
    include_explanation: bool = Query(False),
    custom_prompt: str = Query(None, description="自定义提示词（可选）"),
    ai_service: AIService = Depends(get_ai_service),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
):
    """
    单题预览：上传图片 → AI 解析 → 生成 LaTeX，并可选编译 PDF。
    - format=json: 返回解析结果 + latex 文本 + svg 的 PNG base64 预览 + 相似题列表。
    - format=pdf: 返回编译好的 PDF 文件。
    - custom_prompt: 自定义提示词（可选）
    """
    analysis = await ai_service.analyze(file, custom_prompt=custom_prompt)
    latex, attachments = export_service.build_single_question_latex(
        analysis, include_answer=include_answer, include_explanation=include_explanation
    )

    if format == "pdf":
        ok, out, log = export_service.compile_pdf(latex, attachments=attachments)
        if ok:
            file_path = Path(out)
            bg = background_tasks or BackgroundTasks()
            bg.add_task(export_service.cleanup_file, file_path)
            return FileResponse(
                file_path,
                media_type="application/pdf",
                filename="question_preview.pdf",
                background=bg,
            )
        raise HTTPException(status_code=500, detail={"error": "pdf_preview_failed", "detail": out, "log": log, "latex": latex})

    # 默认 json：返回结构化数据 + latex + PNG 预览（如可用）
    svg_png = export_service.svg_to_png_base64(analysis.get("geometrySvg")) if analysis.get("hasGeometry") else None
    
    # 查重：用题目+答案进行语义搜索，找出相似题
    similar_questions = []
    question_text = analysis.get("questionText") or ""
    answer_text = analysis.get("answer") or ""
    if question_text and rag_service.client:
        # 拼接题目和答案进行搜索
        search_text = f"{question_text}\n{answer_text}"
        try:
            similar_results = await rag_service.search_similar(db, search_text, top_k=3)
            # 只返回相似度 > 0.85 的题目
            similar_questions = [
                {
                    "id": r["id"],
                    "questionText": (r["questionText"] or "")[:200] + "..." if len(r.get("questionText") or "") > 200 else r.get("questionText"),
                    "similarity": r["similarity"],
                    "difficulty": r.get("difficulty"),
                }
                for r in similar_results if r.get("similarity", 0) > 0.85
            ]
        except Exception:
            pass  # 查重失败不影响主流程
    
    return {
        "analysis": analysis,
        "latex": latex,
        "svgPng": svg_png,
        "similarQuestions": similar_questions,  # 相似题列表
    }



@router.post("/questions/ingest", response_model=QuestionCreateResponse)
async def ingest_and_create_question(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    一步完成：上传图片 → AI 解析 → 清洗 → 入库。
    返回入库后的题目 ID 和入库时的 payload。
    """
    analysis = await ai_service.analyze(file)
    payload = QuestionCreateRequest(
        questionText=analysis.get("questionText") or "",
        options=analysis.get("options"),
        answer=analysis.get("answer") or "",
        explanation=None,
        hasGeometry=bool(analysis.get("hasGeometry")),
        geometrySvg=analysis.get("geometrySvg"),
        geometryTikz=None,
        knowledgePoints=analysis.get("knowledgePoints") or [],
        difficulty=analysis.get("difficulty") or "medium",
        questionType=analysis.get("questionType") or "solve",
        source=analysis.get("source") or "ai_upload",
        year=analysis.get("year"),
        aiGenerated=True,
    )
    try:
        q = orm.Question(
            question_text=payload.questionText,
            options=payload.options,
            answer=payload.answer,
            explanation=payload.explanation,
            has_geometry=payload.hasGeometry,
            geometry_svg=payload.geometrySvg,
            geometry_tikz=payload.geometryTikz,
            knowledge_points=payload.knowledgePoints,
            difficulty=payload.difficulty,
            question_type=payload.questionType,
            source=payload.source,
            year=payload.year,
            ai_generated=payload.aiGenerated,
            created_by=current_user.id if current_user else None,
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        return QuestionCreateResponse(id=q.id, created=True, payload=payload)
    except Exception:
        db.rollback()
        raise


@router.post("/questions", response_model=QuestionCreateResponse)
async def create_question(
    payload: QuestionCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    教师审核后提交题目入库。
    创建成功后会在后台异步生成 embedding 索引。
    """
    try:
        q = orm.Question(
            question_text=payload.questionText,
            options=payload.options,
            answer=payload.answer,
            explanation=payload.explanation,
            has_geometry=payload.hasGeometry,
            geometry_svg=payload.geometrySvg,
            geometry_tikz=payload.geometryTikz,
            knowledge_points=payload.knowledgePoints,
            difficulty=payload.difficulty,
            question_type=payload.questionType,
            source=payload.source,
            year=payload.year,
            ai_generated=payload.aiGenerated,
            is_public=payload.isPublic,
            created_by=current_user.id if current_user else None,
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        
        # 后台异步生成 embedding 索引
        async def index_in_background(question_id: str):
            from db import session_scope
            with session_scope() as bg_db:
                await rag_service.index_question(bg_db, question_id)
        
        background_tasks.add_task(index_in_background, q.id)
        
        return QuestionCreateResponse(id=q.id, created=True, payload=payload)
    except Exception:
        db.rollback()
        raise


@router.get("/questions", response_model=QuestionListResponse)
async def list_questions(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
    search: str = Query(None, description="按题干/答案模糊搜索"),
    includePublic: bool = Query(False, description="是否包含公共题目"),
):
    """
    简单分页列出题目。
    """
    offset = (page - 1) * limit
    query = db.query(orm.Question)
    if includePublic:
        query = query.filter(or_(orm.Question.created_by == current_user.id, orm.Question.is_public == True))
    else:
        query = query.filter(orm.Question.created_by == current_user.id)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(orm.Question.question_text.ilike(like), orm.Question.answer.ilike(like))
        )
    total = query.count()
    items = query.order_by(orm.Question.created_at.desc()).offset(offset).limit(limit).all()
    view_items = [
        QuestionView(
            id=item.id,
            questionText=item.question_text,
            options=item.options,
            answer=item.answer,
            explanation=item.explanation,
            hasGeometry=item.has_geometry,
            geometrySvg=item.geometry_svg,
            geometryTikz=item.geometry_tikz,
            knowledgePoints=item.knowledge_points or [],
            difficulty=item.difficulty,
            questionType=item.question_type,
            source=item.source,
            year=item.year,
            aiGenerated=item.ai_generated,
            isPublic=item.is_public,
        )
        for item in items
    ]
    return QuestionListResponse(total=total, items=view_items)


@router.get("/questions/{question_id}", response_model=QuestionView)
async def get_question_detail(
    question_id: str,
    db: Session = Depends(get_db),
    _: orm.User = Depends(require_role(["teacher", "admin"])),
):
    q = db.query(orm.Question).filter(orm.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="question not found")
    return QuestionView(
        id=q.id,
        questionText=q.question_text,
        options=q.options,
        answer=q.answer,
        explanation=q.explanation,
        hasGeometry=q.has_geometry,
        geometrySvg=q.geometry_svg,
        geometryTikz=q.geometry_tikz,
        knowledgePoints=q.knowledge_points or [],
        difficulty=q.difficulty,
        questionType=q.question_type,
        source=q.source,
        year=q.year,
        aiGenerated=q.ai_generated,
        isPublic=q.is_public,
    )


@router.put("/questions/{question_id}", response_model=QuestionView)
async def update_question(
    question_id: str,
    payload: QuestionCreateRequest,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    更新题目信息。只能更新自己创建的题目。
    """
    q = db.query(orm.Question).filter(orm.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="question not found")
    
    # 权限检查：只能更新自己的题目
    if q.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限修改此题目")
    
    # 更新字段
    q.question_text = payload.questionText
    q.options = payload.options
    q.answer = payload.answer
    q.explanation = payload.explanation
    q.has_geometry = payload.hasGeometry
    q.geometry_svg = payload.geometrySvg
    q.geometry_tikz = payload.geometryTikz
    q.knowledge_points = payload.knowledgePoints
    q.difficulty = payload.difficulty
    q.question_type = payload.questionType
    q.source = payload.source
    q.year = payload.year
    q.is_public = payload.isPublic
    
    try:
        db.commit()
        db.refresh(q)
    except Exception:
        db.rollback()
        raise
    
    return QuestionView(
        id=q.id,
        questionText=q.question_text,
        options=q.options,
        answer=q.answer,
        explanation=q.explanation,
        hasGeometry=q.has_geometry,
        geometrySvg=q.geometry_svg,
        geometryTikz=q.geometry_tikz,
        knowledgePoints=q.knowledge_points or [],
        difficulty=q.difficulty,
        questionType=q.question_type,
        source=q.source,
        year=q.year,
        aiGenerated=q.ai_generated,
        isPublic=q.is_public,
    )


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    删除题目。只能删除自己创建的题目。
    """
    q = db.query(orm.Question).filter(orm.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="question not found")
    
    # 权限检查：只能删除自己的题目
    if q.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限删除此题目")
    
    try:
        # 同时删除 embedding
        db.query(orm.QuestionEmbedding).filter(orm.QuestionEmbedding.question_id == question_id).delete()
        db.delete(q)
        db.commit()
    except Exception:
        db.rollback()
        raise
    
    return {"success": True, "message": "题目已删除"}


@router.get("/papers/{paper_id}/export")
async def export_paper(
    paper_id: str,
    format: str = Query("pdf", pattern="^(pdf|docx)$"),
    include_answer: bool = Query(True),
    include_explanation: bool = Query(True),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
):
    """
    试卷导出：
    - pdf: 调用 pdflatex（如果可用），否则返回错误和 latex 文本。
    - docx: 使用 python-docx（如果已安装）。
    """
    paper = db.query(orm.Paper).filter(orm.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="paper not found")
    qlist = paper.questions
    question_ids = [pq.question_id for pq in qlist]
    questions = db.query(orm.Question).filter(orm.Question.id.in_(question_ids)).all()
    qmap = {q.id: q for q in questions}

    pq_view = [
        PaperQuestionView(
            questionId=pq.question_id,
            order=pq.order,
            score=pq.score,
            customLabel=pq.custom_label,
        )
        for pq in qlist
    ]
    tpl = get_template(paper.template_type) if paper.template_type else None
    if tpl:
        latex, attachments = export_service.build_latex_from_template(
            paper,
            qlist,
            qmap,
            tpl,
            include_answer=include_answer,
            include_explanation=include_explanation,
        )
    else:
        latex, attachments = export_service.build_latex(
            paper,
            qlist,
            qmap,
            include_answer=include_answer,
            include_explanation=include_explanation,
        )

    payload = PaperView(
        id=paper.id,
        title=paper.title,
        description=paper.description,
        templateType=paper.template_type,
        totalScore=paper.total_score,
        timeLimit=paper.time_limit,
        tags=paper.tags or [],
        subject=paper.subject,
        gradeLevel=paper.grade_level,
        questions=pq_view,
    ).model_dump()
    payload["latex"] = latex

    if format == "pdf":
        ok, out, log = export_service.compile_pdf(latex, attachments=attachments)
        if ok:
            file_path = Path(out)
            bg = background_tasks or BackgroundTasks()
            bg.add_task(export_service.cleanup_file, file_path)
            return FileResponse(
                file_path,
                media_type="application/pdf",
                filename=f"{paper.title or 'paper'}.pdf",
                background=bg,
            )
        raise HTTPException(status_code=500, detail={"error": "pdf_export_failed", "detail": out, "latex": latex, "log": log})
    elif format == "docx":
        ok, out, log = export_service.build_docx(
            paper, qlist, qmap, include_answer=include_answer, include_explanation=include_explanation
        )
        if ok:
            file_path = Path(out)
            bg = background_tasks or BackgroundTasks()
            bg.add_task(export_service.cleanup_file, file_path)
            return FileResponse(
                file_path,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                filename=f"{paper.title or 'paper'}.docx",
                background=bg,
            )
        raise HTTPException(status_code=500, detail={"error": "docx_export_failed", "detail": out, "log": log, "latex": latex})
    # fallback
    return await export_service.export_stub(paper_id, format, payload)


@router.post("/papers", response_model=PaperCreateResponse)
async def create_paper(
    payload: PaperCreateRequest,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    创建试卷（基础数据 + 题目顺序/分值）。
    """
    # 校验题目是否存在
    qids = [pq.questionId for pq in payload.questions]
    if not qids:
        raise HTTPException(status_code=400, detail="questions list cannot be empty")
    exist_map = {q.id: q for q in db.query(orm.Question).filter(orm.Question.id.in_(qids)).all()}
    missing = [qid for qid in qids if qid not in exist_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"question ids not found: {missing}")

    computed_total = sum(pq.score for pq in payload.questions)

    # 模板校验与分值填充
    tpl = get_template(payload.templateType) if payload.templateType else None
    if tpl:
        if len(payload.questions) != len(tpl.slots):
            raise HTTPException(status_code=400, detail=f"template {payload.templateType} requires {len(tpl.slots)} questions")
        sorted_slots = sorted(tpl.slots, key=lambda s: s.order)
        sorted_pq = sorted(payload.questions, key=lambda s: s.order)
        for idx, (slot, pq) in enumerate(zip(sorted_slots, sorted_pq)):
            q = exist_map.get(pq.questionId)
            if not q:
                continue
            if (q.question_type or "").lower() != slot.question_type:
                raise HTTPException(status_code=400, detail=f"question {pq.questionId} type {q.question_type} does not match template {slot.question_type} at slot {slot.order}")
            if pq.score is None or pq.score <= 0:
                sorted_pq[idx].score = slot.default_score
        payload.questions = sorted_pq
        computed_total = sum(pq.score for pq in payload.questions)

    try:
        paper = orm.Paper(
            title=payload.title,
            description=payload.description,
            template_type=payload.templateType,
            total_score=payload.totalScore or computed_total,
            time_limit=payload.timeLimit,
            tags=payload.tags,
            subject=payload.subject,
            grade_level=payload.gradeLevel,
            created_by=current_user.id if current_user else None,
        )
        db.add(paper)
        db.flush()  # 拿到 paper.id

        for pq in payload.questions:
            db.add(
                orm.PaperQuestion(
                    paper_id=paper.id,
                    question_id=pq.questionId,
                    order=pq.order,
                    score=pq.score,
                    custom_label=pq.customLabel,
                )
            )
        db.commit()
        return PaperCreateResponse(id=paper.id, created=True)
    except Exception:
        db.rollback()
        raise


@router.get("/papers/{paper_id}", response_model=PaperView)
async def get_paper_detail(
    paper_id: str,
    db: Session = Depends(get_db),
    _: orm.User = Depends(require_role(["teacher", "admin"])),
):
    paper = db.query(orm.Paper).filter(orm.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="paper not found")
    pq_view = [
        PaperQuestionView(
            questionId=pq.question_id,
            order=pq.order,
            score=pq.score,
            customLabel=pq.custom_label,
        )
        for pq in paper.questions
    ]
    return PaperView(
        id=paper.id,
        title=paper.title,
        description=paper.description,
        templateType=paper.template_type,
        totalScore=paper.total_score,
        timeLimit=paper.time_limit,
        tags=paper.tags or [],
        subject=paper.subject,
        gradeLevel=paper.grade_level,
        questions=pq_view,
    )


@router.get("/papers", response_model=PaperListResponse)
async def list_papers(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """
    简单分页列出试卷。
    """
    offset = (page - 1) * limit
    total = db.query(orm.Paper).count()
    papers = (
        db.query(orm.Paper)
        .order_by(orm.Paper.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = []
    for p in papers:
        qlist = [
            PaperQuestionView(
                questionId=pq.question_id,
                order=pq.order,
                score=pq.score,
                customLabel=pq.custom_label,
            )
            for pq in p.questions
        ]
        items.append(
            PaperView(
                id=p.id,
                title=p.title,
                description=p.description,
                templateType=p.template_type,
                totalScore=p.total_score,
                timeLimit=p.time_limit,
                tags=p.tags or [],
                subject=p.subject,
                gradeLevel=p.grade_level,
                questions=qlist,
            )
        )
    return PaperListResponse(total=total, items=items)
