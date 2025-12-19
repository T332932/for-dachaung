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
  "confidence": 0.0-1.0,
  "isHighSchool": true/false  // 是否为高中数学范围的题目（若判断不出，返回 false）
}
仅输出 JSON，不要额外说明。"""
        
        # 默认的附加说明
        default_instructions = """重要：
- questionText 只包含题干和选项，不要包含任何答案或解析。
- 不要在题干前自动加题号（如 1.、(1) 等），题号由系统生成。
- 答案与解题步骤只放在 answer 字段。
- questionType 只能是 choice/multi/fillblank/solve/proof 之一，禁止组合值。
- isHighSchool 为 true 仅限高中数学题；如果不是高中数学或无法判断，请返回 false。

图形处理规则（非常重要）：
- hasGeometry：如果图片中包含几何图形、函数图像、坐标系等图形，设为 true
- geometrySvg：必须根据图片中的原始图形精确重绘为 SVG，禁止凭空想象或编造
- 如果图片中没有图形，hasGeometry 设为 false，geometrySvg 设为 null

SVG 重绘要求：
1. 精确还原：
   - 必须忠实还原图片中的图形，包括形状、位置、标注、虚实线等
   - 坐标、角度、比例要与原图一致
   - 所有文字标注（如点的名称 A/B/C、坐标值、角度等）必须完整保留

2. 基本规范：
   - viewBox="0 0 400 300"
   - 只使用基础标签：<svg>, <line>, <circle>, <ellipse>, <path>, <polyline>, <polygon>, <rect>, <text>
   - 禁止使用：<defs>, <marker>, <use>, <g>, <clipPath>, <mask> 等高级标签
   - 虚线用 stroke-dasharray="5,5"
   - 线条默认 stroke="#000" stroke-width="1.5"

3. 文本标注规则：
   - <text> 标签内容必须使用 Unicode 数学符号，禁止使用 LaTeX 格式（禁止 $...$）
   - 分数写法：用斜杠表示，如 "π/6"、"2π/3"、"1/2"
   - 常用符号：π ω φ θ α β γ（希腊字母）、√（根号）、x₁ x₂（下标）、x² x³（上标）
   - 示例：<text x="100" y="180">π/6</text>

4. 坐标轴与曲线：
   - 坐标轴用 <line> 绘制，箭头用三角形 <polygon> 表示
   - 曲线用 <polyline> 或 <path> 的 L/M 命令绘制"""
        
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
                # 处理 JSON 转义: \\n -> \n, \\" -> ", \\\\ -> \\ (LaTeX 命令需要单反斜线)
                text = qt_match.group(1) if qt_match.group(1) else ""
                text = text.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                result["questionText"] = text
            
            # 提取 answer
            ans_match = re.search(r'"answer"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
            if ans_match:
                text = ans_match.group(1)
                text = text.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                result["answer"] = text
            
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
            "isHighSchool": True,
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
            # 高中数学标记默认 True
            data["isHighSchool"] = bool(data.get("isHighSchool", True))
        return data

    def _strip_images(self, text: str) -> str:
        """
        去掉 questionText 中的 markdown 图片和 HTML img 标签，保留纯文本。
        """
        if not text:
            return ""
        # 移除所有 Markdown 图片（包括空图片 ![]() 和带 URL 的）
        text = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', text)
        # 去掉 HTML <img ...>
        text = re.sub(r'<img[^>]*>', '', text, flags=re.IGNORECASE)
        # 清理多余空行
        text = re.sub(r'\n{3,}', '\n\n', text)
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
            "isHighSchool": True,
        }


def get_ai_service():
    """获取AI服务实例"""
    return AIService()
