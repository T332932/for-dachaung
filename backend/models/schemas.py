from typing import List, Literal, Optional

from pydantic import BaseModel


class QuestionAnalysisResponse(BaseModel):
    questionText: str
    options: Optional[List[str]] = None
    answer: str
    hasGeometry: bool
    geometrySvg: Optional[str] = None
    knowledgePoints: List[str] = []
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
    questionType: Optional[Literal["choice", "fillblank", "solve", "proof"]] = None
    confidence: Optional[float] = None


class QuestionCreateRequest(BaseModel):
    questionText: str
    options: Optional[List[str]] = None
    answer: str
    explanation: Optional[str] = None
    hasGeometry: bool = False
    geometrySvg: Optional[str] = None
    geometryTikz: Optional[str] = None
    knowledgePoints: List[str] = []
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    questionType: Literal["choice", "fillblank", "solve", "proof"] = "solve"
    source: Optional[str] = None
    year: Optional[int] = None
    aiGenerated: bool = True


class QuestionCreateResponse(BaseModel):
    id: str
    created: bool
    payload: QuestionCreateRequest


class QuestionView(BaseModel):
    id: str
    questionText: str
    options: Optional[List[str]] = None
    answer: str
    explanation: Optional[str] = None
    hasGeometry: bool = False
    geometrySvg: Optional[str] = None
    geometryTikz: Optional[str] = None
    knowledgePoints: List[str] = []
    difficulty: Optional[str] = None
    questionType: Optional[str] = None
    source: Optional[str] = None
    year: Optional[int] = None
    aiGenerated: bool = True

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    total: int
    items: List[QuestionView]


class PaperQuestionInput(BaseModel):
    questionId: str
    order: int
    score: int
    customLabel: Optional[str] = None


class PaperCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    templateType: Literal["gaokao_new_1", "gaokao_old_science", "custom"] = "custom"
    questions: List[PaperQuestionInput]
    totalScore: Optional[int] = None  # 若未提供，自动按题目分值求和
    timeLimit: Optional[int] = None
    tags: List[str] = []
    subject: str = "math"
    gradeLevel: str = "high"


class PaperCreateResponse(BaseModel):
    id: str
    created: bool


class PaperQuestionView(BaseModel):
    questionId: str
    order: int
    score: int
    customLabel: Optional[str] = None


class PaperView(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    templateType: str
    totalScore: int
    timeLimit: Optional[int] = None
    tags: List[str] = []
    subject: str
    gradeLevel: str
    questions: List[PaperQuestionView] = []

    class Config:
        from_attributes = True


class PaperListResponse(BaseModel):
    total: int
    items: List[PaperView]


class ReviewCreateRequest(BaseModel):
    questionId: str
    reviewerId: Optional[str] = None
    status: Literal["pending", "approved", "rejected"] = "pending"
    comment: Optional[str] = None


class ReviewView(BaseModel):
    id: str
    questionId: str
    reviewerId: Optional[str] = None
    status: str
    comment: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    class Config:
        from_attributes = True


# Auth/User
class UserCreateRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: Literal["teacher", "student", "admin"] = "teacher"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserView(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class StudentAskRequest(BaseModel):
    question: str
    conversationId: Optional[str] = None


class StudentAskResponse(BaseModel):
    answer: str
    relatedQuestions: List[dict] = []
    sources: List[str] = []
