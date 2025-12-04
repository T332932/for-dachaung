from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, Query
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
from utils.deps import get_current_user, require_role


router = APIRouter(tags=["teacher"])
export_service = ExportService()


@router.post("/questions/analyze", response_model=QuestionAnalysisResponse)
async def analyze_question(
    file: UploadFile = File(...),
    ai_service: AIService = Depends(get_ai_service),
    # 临时移除认证要求，方便测试
    # _: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    题目图片/文件解析：OCR + 结构化 + SVG（若有几何）。
    支持 Gemini 或 OpenAI（通过配置选择）。
    """
    return await ai_service.analyze(file)


@router.post("/questions", response_model=QuestionCreateResponse)
async def create_question(
    payload: QuestionCreateRequest,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    教师审核后提交题目入库的占位接口。
    当前写入数据库（questions 表），返回生成的 ID。
    """
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


@router.get("/questions", response_model=QuestionListResponse)
async def list_questions(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: orm.User = Depends(require_role(["teacher", "admin"])),
    search: str = Query(None, description="按题干/答案模糊搜索"),
):
    """
    简单分页列出题目。
    """
    offset = (page - 1) * limit
    query = db.query(orm.Question)
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
        return {"error": "question not found"}
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
    )


@router.get("/papers/{paper_id}/export")
async def export_paper(
    paper_id: str,
    format: str = Query("pdf", pattern="^(pdf|docx)$"),
    include_answer: bool = Query(True),
    include_explanation: bool = Query(True),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    """
    试卷导出：
    - pdf: 调用 pdflatex（如果可用），否则返回错误和 latex 文本。
    - docx: 使用 python-docx（如果已安装）。
    """
    paper = db.query(orm.Paper).filter(orm.Paper.id == paper_id).first()
    if not paper:
        return {"error": "paper not found"}
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
        return {"error": "pdf_export_failed", "detail": out, "latex": latex, "log": log}
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
        return {"error": "docx_export_failed", "detail": out, "log": log, "latex": latex}
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
    exist_map = {q.id: q for q in db.query(orm.Question).filter(orm.Question.id.in_(qids)).all()}
    missing = [qid for qid in qids if qid not in exist_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"question ids not found: {missing}")

    computed_total = sum(pq.score for pq in payload.questions)

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


@router.get("/papers/{paper_id}", response_model=PaperView)
async def get_paper_detail(
    paper_id: str,
    db: Session = Depends(get_db),
    _: orm.User = Depends(require_role(["teacher", "admin"])),
):
    paper = db.query(orm.Paper).filter(orm.Paper.id == paper_id).first()
    if not paper:
        return {"error": "paper not found"}
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
