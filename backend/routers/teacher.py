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

# 导入任务管理器
from services.task_service import task_manager, TaskStatus

# 默认提示词（可被前端修改）
DEFAULT_PROMPT = """你是一个高考数学题目解析专家。请分析图片中的题目，返回严格的 JSON 格式。

## 输出 JSON 格式（必须严格遵守）

```json
{
  "questionText": "题干内容，数学公式用 $...$ 包裹",
  "options": ["A. 选项内容", "B. ...", "C. ...", "D. ..."],
  "answer": "【答案】...\n【分析】...\n【详解】...",
  "questionType": "choice/multi/fillblank/solve/proof",
  "difficulty": "easy/medium/hard",
  "knowledgePoints": ["知识点1", "知识点2"],
  "hasGeometry": true,
  "geometrySvg": "<svg>...</svg>",
  "isHighSchool": true
}
```

## 字段说明

### 1. questionText（题干）
- 只包含题目本身，不含答案
- 所有数学公式用 `$...$` 包裹，如 `$\\sin(\\omega x + \\phi)$`
- 分数用 `$\\frac{a}{b}$`，根号用 `$\\sqrt{x}$`

### 2. options（选项）
- 选择题必须返回，填空/解答题返回 null
- 每个选项格式：`"A. 内容"` 或 `"A. $公式$"`
- 示例：`["A. $\\sin(x+\\frac{\\pi}{3})$", "B. $\\cos(x-\\frac{\\pi}{6})$"]`

### 3. answer（答案）
- 必须包含【答案】【分析】【详解】三部分
- 所有公式用 `$...$` 包裹，**必须写在一行内，禁止拆分**
- 示例：
  ```
  【答案】A
  【分析】根据正弦函数图像特征确定参数
  【详解】由图可知周期为 $T=\\pi$，所以 $\\omega=\\frac{2\\pi}{T}=2$...
  ```

### 4. hasGeometry 和 geometrySvg（几何图形）
- **当题目包含以下内容时，必须设置 hasGeometry=true 并生成 SVG**：
  - 函数图像（如正弦曲线、抛物线）
  - 几何图形（三角形、圆、立体图形）
  - 坐标系、向量图示
- SVG 要求：
  - viewBox="0 0 400 400"
  - 只用 <line>, <circle>, <ellipse>, <path>, <text> 标签
  - 虚线用 stroke-dasharray="5,5"
  - 坐标轴用黑色，曲线用蓝色

### 5. questionType（题型）
- choice: 单选题
- multi: 多选题（答案可能是 AB, ABC, ACD 等多个字母）
- fillblank: 填空题
- solve: 解答题
- proof: 证明题

### 6. isHighSchool（学段）
- 高中数学题返回 true，其他返回 false

## 重要提醒
- 所有 LaTeX 命令必须有反斜杠：\\frac, \\sin, \\cos, \\pi, \\omega, \\sqrt
- JSON 字符串中反斜杠需要双写：\\\\frac, \\\\sin
- 如果图片模糊或无法识别，questionText 写"[无法识别]"并在 answer 中说明原因"""


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


# ===== 异步分析接口（解决 Cloudflare 100s 超时）=====

import tempfile
import shutil

@router.post("/questions/preview-async")
async def preview_question_async(
    file: UploadFile = File(...),
    format: str = Query("json", pattern="^(json|pdf)$"),
    include_answer: bool = Query(True),
    include_explanation: bool = Query(False),
    custom_prompt: str = Query(None, description="自定义提示词（可选）"),
):
    """
    异步版本的题目预览：立即返回 task_id，后台处理 AI 分析。
    前端通过 GET /tasks/{task_id}/status 轮询结果。
    """
    import asyncio
    
    # 1. 创建任务
    task_id = task_manager.create_task()
    
    # 2. 保存上传文件到临时目录（因为后台任务无法访问 UploadFile）
    temp_dir = tempfile.mkdtemp()
    temp_file_path = Path(temp_dir) / file.filename
    with open(temp_file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # 3. 使用 asyncio.create_task 启动后台任务（不阻塞主线程）
    asyncio.create_task(
        _process_preview_task(
            task_id=task_id,
            file_path=str(temp_file_path),
            format=format,
            include_answer=include_answer,
            include_explanation=include_explanation,
            custom_prompt=custom_prompt,
            temp_dir=temp_dir,
        )
    )
    
    # 4. 立即返回 task_id
    return {"taskId": task_id, "status": "pending"}


async def _process_preview_task(
    task_id: str,
    file_path: str,
    format: str,
    include_answer: bool,
    include_explanation: bool,
    custom_prompt: str,
    temp_dir: str,
):
    """后台任务：处理 AI 分析"""
    import asyncio
    from fastapi import UploadFile
    from io import BytesIO
    
    try:
        task_manager.update_status(task_id, TaskStatus.PROCESSING, progress=10)
        
        # 读取文件
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        # 创建模拟的 UploadFile 对象
        class FakeUploadFile:
            def __init__(self, content: bytes, filename: str):
                self.file = BytesIO(content)
                self.filename = filename
                self.content_type = "image/jpeg"
            async def read(self):
                return self.file.read()
        
        fake_file = FakeUploadFile(file_content, Path(file_path).name)
        
        # 执行 AI 分析
        task_manager.update_status(task_id, TaskStatus.PROCESSING, progress=30)
        ai_service = get_ai_service()
        analysis = await ai_service.analyze(fake_file, custom_prompt=custom_prompt)
        
        task_manager.update_status(task_id, TaskStatus.PROCESSING, progress=70)
        
        # 生成 LaTeX
        latex, attachments = export_service.build_single_question_latex(
            analysis, include_answer=include_answer, include_explanation=include_explanation
        )
        
        # 生成 SVG PNG 预览
        svg_png = None
        if analysis.get("hasGeometry"):
            svg_png = export_service.svg_to_png_base64(analysis.get("geometrySvg"))
        
        task_manager.update_status(task_id, TaskStatus.PROCESSING, progress=90)
        
        # 组装结果
        result = {
            "analysis": analysis,
            "latex": latex,
            "svgPng": svg_png,
            "similarQuestions": [],  # 异步模式暂不做相似题搜索
        }
        
        task_manager.update_status(task_id, TaskStatus.COMPLETED, result=result, progress=100)
        
    except Exception as e:
        task_manager.update_status(task_id, TaskStatus.FAILED, error=str(e))
    
    finally:
        # 清理临时文件
        try:
            shutil.rmtree(temp_dir)
        except:
            pass


@router.get("/tasks/{task_id}/status")
async def get_task_status(task_id: str):
    """
    查询异步任务状态。
    返回：status, progress, result(如果完成), error(如果失败)
    """
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    response = {
        "taskId": task.id,
        "status": task.status.value,
        "progress": task.progress,
    }
    
    if task.status == TaskStatus.COMPLETED:
        response["result"] = task.result
    elif task.status == TaskStatus.FAILED:
        response["error"] = task.error
    
    return response


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
        isHighSchool=bool(analysis.get("isHighSchool", True)),
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
            is_high_school=payload.isHighSchool,
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
        is_public=False,  # 默认不公开，需审核
        is_high_school=payload.isHighSchool,
        status=payload.status or "pending",
        created_by=current_user.id if current_user else None,
    )
        db.add(q)
        db.commit()
        db.refresh(q)
        
        # 后台异步生成 embedding 索引（使用 asyncio.create_task 避免阻塞）
        async def index_in_background(question_id: str):
            try:
                from db import session_scope
                with session_scope() as bg_db:
                    await rag_service.index_question(bg_db, question_id)
            except Exception as e:
                print(f"Embedding 索引创建失败: {e}")
        
        import asyncio
        asyncio.create_task(index_in_background(q.id))
        
        return QuestionCreateResponse(id=q.id, created=True, payload=payload)
    except Exception:
        db.rollback()
        raise


@router.get("/questions/search")
async def search_questions_semantic(
    query: str = Query(..., description="搜索关键词"),
    topK: int = Query(10, ge=1, le=50, description="返回结果数量"),
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(get_current_user),
):
    """
    语义搜索：使用 Embedding 进行向量相似性搜索。
    需要配置 SILICONFLOW_API_KEY 环境变量。
    """
    try:
        results = await rag_service.search_similar(db, query, top_k=topK * 2)  # 多搜一些，后面过滤
        # 转换为前端需要的格式（只返回公共题目 + 用户自己的题目）
        questions = []
        for r in results:
            q = db.query(orm.Question).filter(orm.Question.id == r["id"]).first()
            if not q:
                continue
            # 权限过滤：公共题目 或 自己创建的题目
            if not q.is_public and q.created_by != current_user.id:
                continue
            # options 和 knowledge_points 可能已经是 list（PostgreSQL JSON 字段），也可能是字符串
            options = q.options if isinstance(q.options, list) else (json.loads(q.options) if q.options else None)
            kp = q.knowledge_points if isinstance(q.knowledge_points, list) else (json.loads(q.knowledge_points) if q.knowledge_points else [])
            questions.append({
                "id": q.id,
                "questionText": q.question_text,
                "options": options,
                "answer": q.answer,
                "questionType": q.question_type,
                "difficulty": q.difficulty,
                "knowledgePoints": kp,
                "isPublic": q.is_public,
                "similarity": r.get("similarity", 0),
            })
            # 达到请求数量后停止
            if len(questions) >= topK:
                break
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


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
            status=item.status,
            isHighSchool=item.is_high_school,
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
        status=q.status,
        isHighSchool=q.is_high_school,
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
    如果尝试发布到公开库，会进行相似度检测。
    """
    q = db.query(orm.Question).filter(orm.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="question not found")
    
    # 权限检查：只能更新自己的题目
    if q.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限修改此题目")
    
    # 检测是否尝试发布到公开库（从 False 变为 True）
    is_publishing = not q.is_public and payload.isPublic
    publish_result = None
    
    if is_publishing:
        if not payload.isHighSchool:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "publish_rejected",
                    "reason": "该题目未被判定为高中数学，无法公开",
                },
            )
        # 进行发布资格检测
        publish_result = await rag_service.check_publish_eligibility(db, question_id)
        
        if publish_result['status'] == 'rejected':
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "publish_rejected",
                    "reason": publish_result['reason'],
                    "max_similarity": publish_result.get('max_similarity', 0),
                    "similar_question_id": publish_result.get('similar_question_id'),
                }
            )
        elif publish_result['status'] == 'pending_review':
            # 创建待审核记录
            review = orm.PublishReview(
                question_id=question_id,
                requested_by=current_user.id,
                status='pending',
                review_type=publish_result.get('review_type') or 'similar',
                similarity_score=int(publish_result.get('max_similarity', 0) * 100),
                similar_question_id=publish_result.get('similar_question_id'),
            )
            db.add(review)
            db.commit()
            
            raise HTTPException(
                status_code=202,
                detail={
                    "error": "publish_pending_review",
                    "reason": publish_result['reason'],
                    "message": "发布请求已提交，等待管理员审核",
                    "review_id": review.id,
                }
            )
        # 如果 approved，继续正常更新
    
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
    q.is_high_school = payload.isHighSchool
    q.status = payload.status or q.status
    
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
        status=q.status,
        isHighSchool=q.is_high_school,
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


@router.get("/papers/{paper_id}/export-answer")
async def export_paper_answer(
    paper_id: str,
    format: str = Query("pdf", pattern="^(pdf|latex)$"),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
):
    """
    导出答案卷：
    - 选择题/填空题：只显示答案结果
    - 解答题：显示完整答案
    """
    paper = db.query(orm.Paper).filter(orm.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="paper not found")
    qlist = paper.questions
    question_ids = [pq.question_id for pq in qlist]
    questions = db.query(orm.Question).filter(orm.Question.id.in_(question_ids)).all()
    qmap = {q.id: q for q in questions}

    latex, attachments = export_service.build_answer_latex(paper, qlist, qmap)

    if format == "latex":
        return {"latex": latex, "paper_id": paper_id}

    if format == "pdf":
        ok, out, log = export_service.compile_pdf(latex, attachments=attachments)
        if ok:
            file_path = Path(out)
            bg = background_tasks or BackgroundTasks()
            bg.add_task(export_service.cleanup_file, file_path)
            return FileResponse(
                file_path,
                media_type="application/pdf",
                filename=f"{paper.title or 'paper'}_答案卷.pdf",
                background=bg,
            )
        raise HTTPException(status_code=500, detail={"error": "pdf_export_failed", "detail": out, "latex": latex, "log": log})


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


@router.delete("/papers/{paper_id}")
async def delete_paper(
    paper_id: str,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["teacher", "admin"])),
):
    """
    删除试卷。只能删除自己创建的试卷。
    """
    paper = db.query(orm.Paper).filter(orm.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="paper not found")
    
    # 权限检查：只能删除自己的试卷
    if paper.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限删除此试卷")
    
    try:
        # 删除关联的 PaperQuestion
        db.query(orm.PaperQuestion).filter(orm.PaperQuestion.paper_id == paper_id).delete()
        db.delete(paper)
        db.commit()
    except Exception:
        db.rollback()
        raise
    
    return {"success": True, "message": "试卷已删除"}


# ===== 管理员审核 API =====

@router.get("/admin/publish-reviews")
async def list_publish_reviews(
    status: str = Query("pending", pattern="^(pending|approved|rejected|all)$"),
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["admin"])),
):
    """
    管理员查看待审核的发布请求列表
    """
    query = db.query(orm.PublishReview)
    if status != "all":
        query = query.filter(orm.PublishReview.status == status)
    reviews = query.order_by(orm.PublishReview.created_at.desc()).limit(50).all()
    
    result = []
    for r in reviews:
        q = db.query(orm.Question).filter(orm.Question.id == r.question_id).first()
        similar_q = None
        if r.similar_question_id:
            similar_q = db.query(orm.Question).filter(orm.Question.id == r.similar_question_id).first()
        
        result.append({
            "id": r.id,
            "questionId": r.question_id,
            "questionText": q.question_text[:200] if q else "",
            "status": r.status,
            "reviewType": r.review_type,
            "similarityScore": r.similarity_score,
            "similarQuestionId": r.similar_question_id,
            "similarQuestionText": similar_q.question_text[:200] if similar_q else None,
            "requestedBy": r.requested_by,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        })
    
    return {"items": result, "total": len(result)}


@router.post("/admin/publish-reviews/{review_id}/approve")
async def approve_publish_review(
    review_id: str,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["admin"])),
):
    """
    管理员批准发布请求
    """
    from datetime import datetime, timezone
    
    review = db.query(orm.PublishReview).filter(orm.PublishReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="review not found")
    if review.status != "pending":
        raise HTTPException(status_code=400, detail="该请求已处理")
    
    # 更新审核状态
    review.status = "approved"
    review.reviewed_by = current_user.id
    review.reviewed_at = datetime.now(timezone.utc)
    
    # 将题目设为公开
    q = db.query(orm.Question).filter(orm.Question.id == review.question_id).first()
    if q:
        q.is_public = True
    
    db.commit()
    return {"success": True, "message": "已批准发布"}


@router.post("/admin/publish-reviews/{review_id}/reject")
async def reject_publish_review(
    review_id: str,
    notes: str = Query(None),
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(require_role(["admin"])),
):
    """
    管理员拒绝发布请求
    """
    from datetime import datetime, timezone
    
    review = db.query(orm.PublishReview).filter(orm.PublishReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="review not found")
    if review.status != "pending":
        raise HTTPException(status_code=400, detail="该请求已处理")
    
    review.status = "rejected"
    review.reviewed_by = current_user.id
    review.reviewed_at = datetime.now(timezone.utc)
    review.admin_notes = notes
    
    db.commit()
    return {"success": True, "message": "已拒绝发布"}


# ===================== 试卷草稿 API =====================

from pydantic import BaseModel
from typing import Optional, List, Any

class DraftSaveRequest(BaseModel):
    title: Optional[str] = None
    templateId: Optional[str] = None
    timeLimit: Optional[int] = None
    questionsData: Optional[List[Any]] = None

@router.post("/papers/drafts")
async def save_draft(
    request: DraftSaveRequest,
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(get_current_user),
):
    """保存或更新试卷草稿（每用户只保留一份最新草稿）"""
    
    # 查找现有草稿
    draft = db.query(orm.PaperDraft).filter(orm.PaperDraft.user_id == current_user.id).first()
    
    if draft:
        # 更新现有草稿
        if request.title is not None:
            draft.title = request.title
        if request.templateId is not None:
            draft.template_id = request.templateId
        if request.timeLimit is not None:
            draft.time_limit = request.timeLimit
        if request.questionsData is not None:
            draft.questions_data = request.questionsData
    else:
        # 创建新草稿
        draft = orm.PaperDraft(
            user_id=current_user.id,
            title=request.title,
            template_id=request.templateId,
            time_limit=request.timeLimit,
            questions_data=request.questionsData or [],
        )
        db.add(draft)
    
    db.commit()
    db.refresh(draft)
    
    return {
        "id": draft.id,
        "title": draft.title,
        "templateId": draft.template_id,
        "timeLimit": draft.time_limit,
        "questionsData": draft.questions_data,
        "updatedAt": draft.updated_at.isoformat() if draft.updated_at else None,
    }


@router.get("/papers/drafts/current")
async def get_current_draft(
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(get_current_user),
):
    """获取当前用户的草稿"""
    draft = db.query(orm.PaperDraft).filter(orm.PaperDraft.user_id == current_user.id).first()
    
    if not draft:
        return None
    
    return {
        "id": draft.id,
        "title": draft.title,
        "templateId": draft.template_id,
        "timeLimit": draft.time_limit,
        "questionsData": draft.questions_data or [],
        "updatedAt": draft.updated_at.isoformat() if draft.updated_at else None,
    }


@router.delete("/papers/drafts/current")
async def delete_current_draft(
    db: Session = Depends(get_db),
    current_user: orm.User = Depends(get_current_user),
):
    """删除当前用户的草稿"""
    draft = db.query(orm.PaperDraft).filter(orm.PaperDraft.user_id == current_user.id).first()
    
    if draft:
        db.delete(draft)
        db.commit()
        return {"success": True, "message": "草稿已删除"}
    
    return {"success": True, "message": "无草稿"}
