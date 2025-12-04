import json
import mimetypes
import os
from typing import Optional

from fastapi import UploadFile

from config import get_settings

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover - optional dependency
    genai = None


settings = get_settings()
GEMINI_MODEL = settings.gemini_model


class GeminiService:
    """
    Gemini 解析服务占位：
    - 若未安装 google-generativeai 或未配置 API Key，返回 stub。
    - 若已配置，将真实调用 Gemini。
    """

    def __init__(self, api_key: Optional[str] = None, model: str = GEMINI_MODEL):
        self.api_key = api_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = model
        self._client = None
        if self.api_key and genai:
            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(self.model_name)

    async def analyze(self, file: UploadFile):
        if not self._client:
            # Stub fallback
            text = file.filename or "题目"
            return {
                "questionText": f"占位题干：{text}",
                "options": None,
                "answer": "占位答案（请在前端审核修改后提交）。",
                "hasGeometry": False,
                "geometrySvg": None,
                "knowledgePoints": [],
                "difficulty": "medium",
                "questionType": "solve",
                "confidence": 0.0,
            }

        file_bytes = await file.read()
        mime, _ = mimetypes.guess_type(file.filename or "")
        mime = mime or "image/png"
        image_part = {"mime_type": mime, "data": file_bytes}

        prompt = _analysis_prompt()
        response = self._client.generate_content([prompt, image_part])
        text = response.text or ""
        payload = _extract_json(text)
        return payload


def get_gemini_service():
    return GeminiService()


def _analysis_prompt() -> str:
    return """请分析这道数学题，按以下 JSON 格式返回：
{
  "questionText": "题目完整文本（Markdown 格式，公式用 LaTeX）",
  "options": ["A. ...", "B. ..."],  // 如果是选择题
  "answer": "详细解答过程（Markdown + LaTeX）",
  "hasGeometry": true/false,
  "geometrySvg": "如果有几何图，生成 SVG 代码",
  "knowledgePoints": ["知识点1", "知识点2"],
  "difficulty": "easy/medium/hard",
  "questionType": "choice/fillblank/solve/proof",
  "confidence": 0.0-1.0
}
SVG 生成要求：
- 使用 <line>, <circle>, <ellipse>, <path>, <text> 标签
- 虚线用 stroke-dasharray="5,5"
- 文本标注用 <text> 标签，内容为数学符号
- viewBox="0 0 400 400"，坐标准确
仅输出 JSON，不要额外说明。"""


def _extract_json(text: str):
    cleaned = text
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception:
        # 返回原始内容便于调试
        return {
            "questionText": cleaned or "未能解析 JSON，请检查模型输出。",
            "options": None,
            "answer": "",
            "hasGeometry": False,
            "geometrySvg": None,
            "knowledgePoints": [],
            "difficulty": None,
            "questionType": None,
            "confidence": None,
        }
