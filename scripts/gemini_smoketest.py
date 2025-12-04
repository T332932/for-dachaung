"""
Gemini 图片解析烟囱脚本（占位）

功能：
- 扫描输入目录下的图片（png/jpg/jpeg/webp）
- 调用 Gemini 2.5 Pro，按约定 JSON 返回题干/答案/SVG 等
- 将原始文本与解析后的 JSON 分别保存到输出目录

使用：
  export GEMINI_API_KEY=xxx
  python scripts/gemini_smoketest.py --input samples/images --output samples/out

依赖：
  pip install google-generativeai pillow
"""

import argparse
import json
import mimetypes
import os
import sys
import time
from pathlib import Path
from typing import List

try:
    import google.generativeai as genai
except ImportError as exc:  # pragma: no cover
    raise SystemExit("缺少依赖 google-generativeai，请先安装：pip install google-generativeai pillow") from exc

from PIL import Image  # noqa: E402


PROMPT = """请分析这道数学题，按以下 JSON 格式返回：
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


def parse_args():
    parser = argparse.ArgumentParser(description="Gemini 图片解析烟囱脚本")
    parser.add_argument("--input", "-i", type=Path, default=Path("samples/images"), help="输入图片目录")
    parser.add_argument("--output", "-o", type=Path, default=Path("samples/out"), help="输出目录")
    parser.add_argument("--model", "-m", default=os.getenv("GEMINI_MODEL", "gemini-2.5-pro"))
    return parser.parse_args()


def list_images(folder: Path) -> List[Path]:
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    return sorted([p for p in folder.glob("*") if p.suffix.lower() in exts])


def ensure_output_dir(folder: Path):
    folder.mkdir(parents=True, exist_ok=True)


def to_part(path: Path):
    mime, _ = mimetypes.guess_type(path.name)
    mime = mime or "image/png"
    return {"mime_type": mime, "data": path.read_bytes()}


def extract_json_block(text: str):
    cleaned = text
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
    cleaned = cleaned.strip()
    return cleaned


def main():
    args = parse_args()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("未检测到 GEMINI_API_KEY，请先设置环境变量。")

    if not args.input.exists():
        raise SystemExit(f"输入目录不存在：{args.input}")

    ensure_output_dir(args.output)
    images = list_images(args.input)
    if not images:
        raise SystemExit(f"输入目录无图片：{args.input}")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(args.model)

    for path in images:
        print(f"[解析] {path.name}")
        start = time.time()
        image = Image.open(path)  # noqa: F841  # 确认图片可读；后续传原始 bytes
        response = model.generate_content([PROMPT, to_part(path)])
        text = response.text or ""
        json_block = extract_json_block(text)

        # 保存原始与解析
        (args.output / f"{path.stem}.raw.txt").write_text(text, encoding="utf-8")
        try:
            parsed = json.loads(json_block)
        except Exception:
            parsed = {"error": "JSON 解析失败", "raw": json_block}
        (args.output / f"{path.stem}.json").write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
        cost = time.time() - start
        print(f"完成，用时 {cost:.1f}s，输出：{args.output / (path.stem + '.json')}")


if __name__ == "__main__":
    sys.exit(main())
