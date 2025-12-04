import base64
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import List, Mapping, Tuple

from models import orm

try:
    from docx import Document
except ImportError:  # pragma: no cover - optional dependency
    Document = None

try:
    import cairosvg
except ImportError:  # pragma: no cover - optional dependency
    cairosvg = None


class ExportService:
    """
    导出服务：
    - build_latex: 生成可编译的 LaTeX 文本。
    - compile_pdf: 调用本地 pdflatex，如果不可用则返回错误。
    - build_docx: 使用 python-docx 生成 Word。
    """

    async def export_stub(self, paper_id: str, fmt: str, paper_payload: dict | None = None):
        return {
            "paperId": paper_id,
            "format": fmt,
            "status": "not_implemented",
            "message": "导出服务尚未实现，返回渲染用内容。",
            "paper": paper_payload,
            "latex": paper_payload.get("latex") if paper_payload else None,
        }

    def build_latex(
        self,
        paper: orm.Paper,
        pq_list: List[orm.PaperQuestion],
        question_map: Mapping[str, orm.Question],
        include_answer: bool = True,
        include_explanation: bool = True,
    ) -> Tuple[str, List[Tuple[str, bytes]]]:
        header = r"""\documentclass[12pt,a4paper]{article}
\usepackage{ctex}
\usepackage{amsmath,amssymb}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{enumitem}
\usepackage{tikz}
\geometry{left=2cm,right=2cm,top=2.5cm,bottom=2.5cm}
\setlength{\parskip}{0.6em}
\begin{document}
\begin{center}
\Large %s
\end{center}
\vspace{0.5em}
\begin{enumerate}[leftmargin=0em,label=\arabic*.,itemsep=1em]
""" % self._escape_latex(paper.title)

        body_parts = []
        attachments: List[Tuple[str, bytes]] = []
        for pq in sorted(pq_list, key=lambda x: x.order):
            q = question_map.get(pq.question_id)
            if not q:
                continue
            item = []
            item.append(f"\\item ({pq.score}分) {self._escape_latex(q.question_text)}")
            if q.has_geometry and q.geometry_tikz:
                item.append("\n" + q.geometry_tikz + "\n")
            elif q.has_geometry and q.geometry_svg:
                svg_result = self._svg_to_png_attachment(q.geometry_svg)
                if svg_result:
                    fname, data = svg_result
                    attachments.append((fname, data))
                    item.append(f'\n\\includegraphics[width=0.6\\textwidth]{{{fname}}}\n')
                else:
                    item.append("\n% TODO: embed SVG or convert to TikZ\n")
            if include_answer and q.answer:
                item.append(f"\n\\textbf{{答案：}} {self._escape_latex(q.answer)}")
            if include_explanation and q.explanation:
                item.append(f"\n\\textbf{{解析：}} {self._escape_latex(q.explanation)}")
            body_parts.append("\n".join(item))

        footer = r"""\end{enumerate}
\end{document}
"""
        return header + "\n\n".join(body_parts) + footer, attachments

    def compile_pdf(self, latex_content: str, attachments: List[Tuple[str, bytes]] | None = None) -> tuple[bool, str | Path, str]:
        """
        调用 pdflatex 编译，返回 (ok, path/message, log_text)
        """
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                tmp_path = Path(tmpdir)
                tex_file = tmp_path / "paper.tex"
                tex_file.write_text(latex_content, encoding="utf-8")
                # 写入附件（图片等）
                for fname, data in attachments or []:
                    (tmp_path / fname).write_bytes(data)
                cmd = [
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    tex_file.name,
                ]
                proc = subprocess.run(
                    cmd,
                    cwd=tmp_path,
                    capture_output=True,
                    text=True,
                )
                log = proc.stdout + "\n" + proc.stderr
                pdf_file = tmp_path / "paper.pdf"
                if proc.returncode == 0 and pdf_file.exists():
                    # 安全创建临时文件保存结果
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_out:
                        tmp_out.write(pdf_file.read_bytes())
                        out_file = Path(tmp_out.name)
                    return True, out_file, log
                return False, log or "pdflatex failed", log
        except FileNotFoundError as exc:
            return False, "pdflatex not found in PATH", str(exc)
        except Exception as exc:  # pragma: no cover - unexpected
            return False, f"compile error: {exc}", str(exc)

    def build_docx(
        self,
        paper: orm.Paper,
        pq_list: List[orm.PaperQuestion],
        question_map: Mapping[str, orm.Question],
        include_answer: bool = True,
        include_explanation: bool = True,
    ) -> tuple[bool, str | Path, str]:
        if not Document:
            return False, "python-docx not installed", ""
        try:
            doc = Document()
            doc.add_heading(paper.title, level=1)
            if paper.description:
                doc.add_paragraph(paper.description)

            for pq in sorted(pq_list, key=lambda x: x.order):
                q = question_map.get(pq.question_id)
                if not q:
                    continue
                p = doc.add_paragraph()
                p.add_run(f"{pq.order}. ({pq.score}分) ").bold = True
                p.add_run(q.question_text)
                if q.options:
                    for opt in q.options:
                        doc.add_paragraph(opt, style="List Bullet")
                if include_answer and q.answer:
                    doc.add_paragraph(f"【答案】{q.answer}")
                if include_explanation and q.explanation:
                    doc.add_paragraph(f"【解析】{q.explanation}")
                if q.has_geometry and q.geometry_svg:
                    svg_result = self._svg_to_png_attachment(q.geometry_svg)
                    if svg_result:
                        fname, data = svg_result
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as img_tmp:
                            img_tmp.write(data)
                            image_path = Path(img_tmp.name)
                        doc.add_picture(image_path, width=None)
                        image_path.unlink(missing_ok=True)
                    else:
                        doc.add_paragraph("[SVG 未内嵌，请前端或后续步骤转换插入]")

            with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp_out:
                doc.save(tmp_out.name)
                out_file = Path(tmp_out.name)
            return True, out_file, ""
        except Exception as exc:  # pragma: no cover
            return False, f"docx export error: {exc}", str(exc)

    def cleanup_file(self, path: str | Path):
        try:
            Path(path).unlink(missing_ok=True)
        except Exception:
            pass

    def _svg_to_png_attachment(self, svg_content: str) -> tuple[str, bytes] | None:
        """
        尝试将 SVG 转 PNG，失败则返回 None。
        """
        if not svg_content:
            return None
        if cairosvg is None:  # pragma: no cover - optional dependency not installed
            return None
        try:
            png_bytes = cairosvg.svg2png(bytestring=svg_content.encode("utf-8"))
            fname = f"svg_{uuid.uuid4().hex}.png"
            return fname, png_bytes
        except Exception:
            return None

    def _escape_latex(self, text: str) -> str:
        """
        简单转义特殊字符，避免编译报错。
        """
        replacements = {
            "\\": r"\textbackslash{}",
            "&": r"\&",
            "%": r"\%",
            "$": r"\$",
            "#": r"\#",
            "_": r"\_",
            "{": r"\{",
            "}": r"\}",
            "~": r"\textasciitilde{}",
            "^": r"\^{}",
        }
        out = []
        for ch in text or "":
            out.append(replacements.get(ch, ch))
        return "".join(out)
