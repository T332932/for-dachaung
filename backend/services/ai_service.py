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
    
    async def analyze(self, file: UploadFile, custom_prompt: str = None):
        """分析题目图片，支持自定义提示词"""
        if not self.client:
            return self._stub_response(file.filename or "题目")
        
        if self.provider == "gemini":
            return await self._analyze_with_gemini(file, custom_prompt)
        elif self.provider == "openai":
            return await self._analyze_with_openai(file, custom_prompt)
        else:
            return self._stub_response(file.filename or "题目")
    
    async def _analyze_with_gemini(self, file: UploadFile, custom_prompt: str = None):
        """使用Gemini分析"""
        file_bytes = await file.read()
        if hasattr(file, "file") and hasattr(file.file, "seek"):
            file.file.seek(0)
        mime, _ = mimetypes.guess_type(file.filename or "")
        mime = mime or "image/png"
        image_part = {"mime_type": mime, "data": file_bytes}
        
        prompt = self._get_analysis_prompt(custom_prompt)
        response = self.client.generate_content([prompt, image_part])
        text = response.text or ""
        return self._extract_json(text)
    
    async def _analyze_with_openai(self, file: UploadFile, custom_prompt: str = None):
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
                        {"type": "text", "text": self._get_analysis_prompt(custom_prompt)},
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
    
    def _get_analysis_prompt(self, custom_prompt: str = None) -> str:
        """获取分析提示词，支持自定义提示词"""
        # 固定的JSON格式要求
        format_requirement = """请分析这道数学题，按以下 JSON 格式返回：
{
  "questionText": "题目完整文本（Markdown 格式，公式用 LaTeX）",
  "options": ["A. ...", "B. ..."],  // 如果是选择题
  "answer": "详细解答过程（Markdown + LaTeX）",
  "hasGeometry": true/false,
  "geometrySvg": "如果有几何图，生成 SVG 代码",
  "knowledgePoints": ["知识点1", "知识点2"],
  "difficulty": "easy/medium/hard",
  "questionType": "choice/multi/fillblank/solve/proof",
  "confidence": 0.0-1.0
}
仅输出 JSON，不要额外说明。"""
        
        # 默认的附加说明
        default_instructions = """重要：
- questionText 只包含题干和选项，不要包含任何答案或解析。
- 不要在题干前自动加题号（如 1.、(1) 等），题号由系统生成。
- 答案与解题步骤只放在 answer 字段。
- questionType 只能是 choice/multi/fillblank/solve/proof 之一，禁止组合值。
SVG 生成要求：
- 使用 <line>, <circle>, <ellipse>, <path>, <text> 标签
- 虚线用 stroke-dasharray="5,5"
- 文本标注用 <text> 标签，内容为数学符号
- viewBox="0 0 400 400"，坐标准确
- 必须是合法 SVG，坐标/属性正确，避免重复属性或拼写错误"""
        
        # 如果有自定义提示词，用它替换默认说明
        if custom_prompt:
            return f"{format_requirement}\n\n{custom_prompt}"
        else:
            return f"{format_requirement}\n\n{default_instructions}"
    
    def _extract_json(self, text: str):
        """从文本中提取JSON，增强版：处理嵌套内容、控制字符等"""
        import re
        
        cleaned = text.strip()
        
        # 1. 处理 ```json ... ``` 格式
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            parts = cleaned.split("```")
            if len(parts) >= 2:
                cleaned = parts[1].strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
        
        # 2. 使用括号匹配找到完整的JSON对象
        def find_json_object(s: str) -> str:
            """通过括号匹配找到完整的JSON对象"""
            start = s.find('{')
            if start == -1:
                return s
            
            depth = 0
            in_string = False
            escape = False
            end = start
            
            for i, c in enumerate(s[start:], start):
                if escape:
                    escape = False
                    continue
                if c == '\\':
                    escape = True
                    continue
                if c == '"' and not escape:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            
            return s[start:end]
        
        if not cleaned.startswith("{"):
            cleaned = find_json_object(cleaned)
        
        # 3. 多策略尝试解析
        def try_parse(s: str):
            """尝试解析JSON，失败返回None"""
            try:
                return json.loads(s)
            except:
                return None
        
        # 策略1: 直接解析
        data = try_parse(cleaned)
        if data and isinstance(data, dict):
            return self._post_process_json(data)
        
        # 策略2: 移除BOM，使用非严格模式
        fixed = cleaned
        if fixed.startswith('\ufeff'):
            fixed = fixed[1:]
        
        data = try_parse(fixed)
        if data and isinstance(data, dict):
            return self._post_process_json(data)
        
        # 策略3: 修复字符串内的换行符
        # 在JSON字符串值内部，将真实换行替换为 \n
        def fix_newlines_in_strings(s: str) -> str:
            result = []
            in_string = False
            escape = False
            for c in s:
                if escape:
                    result.append(c)
                    escape = False
                    continue
                if c == '\\':
                    result.append(c)
                    escape = True
                    continue
                if c == '"':
                    in_string = not in_string
                    result.append(c)
                    continue
                if in_string and c == '\n':
                    result.append('\\n')
                elif in_string and c == '\r':
                    result.append('\\r')
                elif in_string and c == '\t':
                    result.append('\\t')
                else:
                    result.append(c)
            return ''.join(result)
        
        fixed = fix_newlines_in_strings(cleaned)
        data = try_parse(fixed)
        if data and isinstance(data, dict):
            return self._post_process_json(data)
        
        # 策略4: 尝试用正则提取各个字段
        try:
            result = {}
            # 提取 questionText
            qt_match = re.search(r'"questionText"\s*:\s*"((?:[^"\\]|\\.)*)?"', cleaned, re.DOTALL)
            if qt_match:
                result["questionText"] = qt_match.group(1).replace('\\n', '\n').replace('\\"', '"') if qt_match.group(1) else ""
            
            # 提取 answer
            ans_match = re.search(r'"answer"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
            if ans_match:
                result["answer"] = ans_match.group(1).replace('\\n', '\n').replace('\\"', '"')
            
            # 提取 hasGeometry
            hg_match = re.search(r'"hasGeometry"\s*:\s*(true|false)', cleaned)
            if hg_match:
                result["hasGeometry"] = hg_match.group(1) == "true"
            
            # 提取 geometrySvg
            svg_match = re.search(r'"geometrySvg"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
            if svg_match:
                result["geometrySvg"] = svg_match.group(1).replace('\\n', '\n').replace('\\"', '"').replace('\\/', '/')
            
            # 提取 difficulty
            diff_match = re.search(r'"difficulty"\s*:\s*"(\w+)"', cleaned)
            if diff_match:
                result["difficulty"] = diff_match.group(1)
            
            # 提取 questionType
            qt_type_match = re.search(r'"questionType"\s*:\s*"(\w+)"', cleaned)
            if qt_type_match:
                result["questionType"] = qt_type_match.group(1)
            
            # 提取 confidence
            conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', cleaned)
            if conf_match:
                result["confidence"] = float(conf_match.group(1))
            
            # 提取 knowledgePoints (简化处理)
            kp_match = re.search(r'"knowledgePoints"\s*:\s*\[(.*?)\]', cleaned, re.DOTALL)
            if kp_match:
                kp_str = kp_match.group(1)
                kps = re.findall(r'"([^"]*)"', kp_str)
                result["knowledgePoints"] = kps
            
            # 提取 options
            opt_match = re.search(r'"options"\s*:\s*\[(.*?)\]', cleaned, re.DOTALL)
            if opt_match:
                opt_str = opt_match.group(1)
                opts = re.findall(r'"((?:[^"\\]|\\.)*)"', opt_str)
                result["options"] = opts if opts else None
            else:
                result["options"] = None
            
            if result.get("questionText") or result.get("answer"):
                # 填充缺失字段
                result.setdefault("questionText", "")
                result.setdefault("answer", "")
                result.setdefault("hasGeometry", False)
                result.setdefault("geometrySvg", None)
                result.setdefault("knowledgePoints", [])
                result.setdefault("difficulty", None)
                result.setdefault("questionType", None)
                result.setdefault("confidence", None)
                return self._post_process_json(result)
        except Exception:
            pass
        
        # 全部失败，返回错误
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
            "_parseError": "所有解析策略均失败",
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
