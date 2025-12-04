"""
统一AI服务层：支持Gemini和OpenAI（或OpenAI兼容API）
"""
import json
import mimetypes
import os
from typing import Optional
import re

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
        if hasattr(file, "file") and hasattr(file.file, "seek"):
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
        if hasattr(file, "file") and hasattr(file.file, "seek"):
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
重要：questionText 只包含题干和选项，不要包含任何答案或解析；答案与解题步骤只放在 answer 字段。
SVG 生成要求：
- 使用 <line>, <circle>, <ellipse>, <path>, <text> 标签
- 虚线用 stroke-dasharray="5,5"
- 文本标注用 <text> 标签，内容为数学符号
- viewBox="0 0 400 400"，坐标准确
仅输出 JSON，不要额外说明。"""
    
    def _extract_json(self, text: str):
        """从文本中提取JSON"""
        import re
        
        cleaned = text.strip()
        
        # 尝试多种方式提取JSON
        # 1. 处理 ```json ... ``` 格式
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            # 可能是 ``` 包裹的代码块
            parts = cleaned.split("```")
            if len(parts) >= 2:
                cleaned = parts[1].strip()
                # 如果第一行是语言标识，去掉它
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
        
        # 2. 尝试找到JSON对象 { ... }
        if not cleaned.startswith("{"):
            match = re.search(r'\{[\s\S]*\}', cleaned)
            if match:
                cleaned = match.group(0)
        
        # 3. 清理可能导致JSON解析失败的控制字符
        # 替换真实的换行为转义后的换行（确保在字符串值内部）
        # 首先尝试直接解析，如果失败再尝试修复
        
        # 3. 尝试解析
        try:
            data = json.loads(cleaned)
            # 解析成功，进行后处理
            if isinstance(data, dict):
                return self._post_process_json(data)
            return data
        except json.JSONDecodeError:
            # 尝试修复控制字符问题：将JSON字符串值内的换行符转义
            try:
                # 尝试用更宽松的方式解析
                import ast
                # 替换真实换行为 \\n（在JSON字符串值内部）
                fixed = cleaned
                # 移除可能的 BOM
                if fixed.startswith('\ufeff'):
                    fixed = fixed[1:]
                data = json.loads(fixed, strict=False)
                if isinstance(data, dict):
                    return self._post_process_json(data)
                return data
            except Exception as e:
            # 解析失败，返回原始文本作为questionText
            return {
                "questionText": text or "未能解析 JSON，请检查模型输出。",
                "options": None,
                "answer": "",
                "hasGeometry": False,
                "geometrySvg": None,
                "knowledgePoints": [],
                "difficulty": None,
                "questionType": None,
                "confidence": None,
                "_parseError": str(e),
            }
    
    def _post_process_json(self, data: dict) -> dict:
        if isinstance(data, dict):
            qt = data.get("questionText") or ""
            ans = data.get("answer") or ""
            lower_qt = qt.lower()
            # 常见中文/英文提示词
            split_tokens = ["答案：", "参考答案", "解答：", "解析：", "solution", "answer:"]
            ans_part = None
            for token in split_tokens:
                if token.lower() in lower_qt:
                    idx = lower_qt.index(token.lower())
                    ans_part = qt[idx:]
                    data["questionText"] = qt[:idx].strip()
                    # 将分离出来的内容追加到 answer
                    if ans_part and ans_part not in ans:
                        data["answer"] = (ans + "\n\n" + ans_part).strip()
                    break
            # 清理 questionText 中的图片/占位
            data["questionText"] = self._strip_images(data.get("questionText") or "").strip()
        return data

    def _strip_images(self, text: str) -> str:
        """
        去掉 questionText 中的 markdown 图片（尤其是 data:image base64），保留纯文本。
        """
        if not text:
            return ""
        # 优先移除 base64 图片
        text = re.sub(r'!\[[^\]]*\]\(data:image/[^)]+\)', '', text)
        # 可选：移除所有 Markdown 图片（如需）：
        # text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
        # 去掉 HTML <img ...>
        text = re.sub(r'<img[^>]*>', '', text, flags=re.IGNORECASE)
        return text
    
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
