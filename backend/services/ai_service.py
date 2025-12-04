"""
统一AI服务层：支持Gemini和OpenAI（或OpenAI兼容API）
"""
import json
import mimetypes
import os
from typing import Optional

from fastapi import UploadFile

from config import get_settings

# 可选依赖
try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


settings = get_settings()


class AIService:
    """
    统一AI服务：根据配置选择Gemini或OpenAI
    """
    
    def __init__(self):
        self.provider = settings.ai_provider
        
        if self.provider == "gemini":
            self._init_gemini()
        elif self.provider == "openai":
            self._init_openai()
        else:
            raise ValueError(f"Unsupported AI provider: {self.provider}")
    
    def _init_gemini(self):
        """初始化Gemini"""
        api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
        if api_key and genai:
            try:
                genai.configure(api_key=api_key)
                self.client = genai.GenerativeModel(settings.gemini_model)
            except Exception:
                self.client = None
        else:
            self.client = None
    
    def _init_openai(self):
        """初始化OpenAI（或兼容API）"""
        api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
        base_url = settings.openai_base_url
        
        if api_key and OpenAI:
            try:
                self.client = OpenAI(
                    api_key=api_key,
                    base_url=base_url  # None则使用默认OpenAI URL
                )
            except Exception:
                self.client = None
        else:
            self.client = None
    
    async def analyze(self, file: UploadFile):
        """分析题目图片"""
        if not self.client:
            return self._stub_response(file.filename or "题目")
        
        if self.provider == "gemini":
            return await self._analyze_with_gemini(file)
        elif self.provider == "openai":
            return await self._analyze_with_openai(file)
    
    async def _analyze_with_gemini(self, file: UploadFile):
        """使用Gemini分析"""
        file_bytes = await file.read()
        file.file.seek(0)
        mime, _ = mimetypes.guess_type(file.filename or "")
        mime = mime or "image/png"
        image_part = {"mime_type": mime, "data": file_bytes}
        
        prompt = self._get_analysis_prompt()
        response = self.client.generate_content([prompt, image_part])
        text = response.text or ""
        return self._extract_json(text)
    
    async def _analyze_with_openai(self, file: UploadFile):
        """使用OpenAI（或兼容API）分析"""
        import base64
        
        file_bytes = await file.read()
        file.file.seek(0)
        base64_image = base64.b64encode(file_bytes).decode('utf-8')
        
        # 判断MIME类型
        mime, _ = mimetypes.guess_type(file.filename or "")
        mime = mime or "image/png"
        
        response = self.client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": self._get_analysis_prompt()},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        
        text = response.choices[0].message.content
        return self._extract_json(text)
    
    def _get_analysis_prompt(self) -> str:
        """获取分析提示词"""
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
    
    def _extract_json(self, text: str):
        """从文本中提取JSON"""
        cleaned = text
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
        cleaned = cleaned.strip()
        
        try:
            return json.loads(cleaned)
        except Exception:
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
    
    def _stub_response(self, filename: str):
        """占位响应（未配置API时）"""
        return {
            "questionText": f"占位题干：{filename}",
            "options": None,
            "answer": "占位答案（请在前端审核修改后提交）。",
            "hasGeometry": False,
            "geometrySvg": None,
            "knowledgePoints": [],
            "difficulty": "medium",
            "questionType": "solve",
            "confidence": 0.0,
        }


def get_ai_service():
    """获取AI服务实例"""
    return AIService()
