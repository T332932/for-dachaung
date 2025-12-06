from __future__ import annotations
import base64
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import List, Mapping, Tuple
import xml.etree.ElementTree as ET

from models import orm
from templates import PaperTemplate

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
    def build_latex_from_template(
        self,
        paper: orm.Paper,
        pq_list: List[orm.PaperQuestion],
        question_map: Mapping[str, orm.Question],
        template: PaperTemplate,
        include_answer: bool = True,
        include_explanation: bool = True,
    ) -> Tuple[str, List[Tuple[str, bytes]]]:
        """
        基于模板分块生成 LaTeX（简化版，使用 enumerate + 分块标题）
        """
        header = r"""\documentclass[12pt]{ctexart}
\usepackage[UTF8,fontset=none]{ctex}
\setCJKmainfont{Noto Serif CJK SC}
\setCJKsansfont{Noto Sans CJK SC}
\setCJKmonofont{Noto Sans Mono CJK SC}
\usepackage{amsmath,amssymb}
\usepackage{geometry,graphicx,enumitem,tikz,fancyhdr}
\usepackage[bodytextleadingratio=1.67,restoremathleading=true]{zhlineskip}
\geometry{paperheight=26cm,paperwidth=18.4cm,left=2cm,right=2cm,top=1.5cm,bottom=2cm,headsep=10pt}
\pagestyle{fancy}
\renewcommand{\headrulewidth}{0pt}
\setlength{\parskip}{0.6em}
\setlength{\parindent}{0pt}
\newcommand{\choicefour}[4]{%%
  \begin{tabular}{p{0.45\textwidth}p{0.45\textwidth}}
  \textsf{A}.~#1 & \textsf{B}.~#2\\
  \textsf{C}.~#3 & \textsf{D}.~#4
  \end{tabular}
}
\begin{document}
\begin{center}\Large %s\end{center}
""" % self._escape_latex(paper.title)

        attachments: List[Tuple[str, bytes]] = []
        body_parts: List[str] = []

        sections = self._sections_for_template(template)
        # 建立 order -> PaperQuestion 映射
        pq_by_order = {pq.order: pq for pq in pq_list}

        for section in sections:
            body_parts.append(r"{\bf %s}" % section["title"])
            body_parts.append(
                r"\begin{enumerate}[label=\arabic*.,start=%d,leftmargin=1.5em,itemsep=1em]"
                % section["start"]
            )
            for slot in section["slots"]:
                pq = pq_by_order.get(slot["order"])
                if not pq:
                    # 缺题直接占位
                    body_parts.append(r"\item (%s分) \textit{缺题占位}" % slot["score"])
                    continue
                q = question_map.get(pq.question_id)
                if not q:
                    body_parts.append(r"\item (%s分) \textit{缺题占位}" % slot["score"])
                    continue
                item_lines = []
                item_lines.append(r"\item (%s分) %s" % (pq.score or slot["score"], self._escape_latex(q.question_text)))
                # 选项
                if q.options and len(q.options) == 4 and (q.question_type or "").startswith("choice"):
                    a, b, c, d = q.options
                    item_lines.append(r"\choicefour{%s}{%s}{%s}{%s}" % (
                        self._escape_latex(a),
                        self._escape_latex(b),
                        self._escape_latex(c),
                        self._escape_latex(d),
                    ))
                elif q.options:
                    item_lines.append(r"\begin{enumerate}[label=\Alph*. ,leftmargin=1.2em,itemsep=0.2em]")
                    for opt in q.options:
                        item_lines.append(r"\item %s" % self._escape_latex(opt))
                    item_lines.append(r"\end{enumerate}")
                # 图形
                if q.has_geometry and q.geometry_tikz:
                    item_lines.append("\n" + q.geometry_tikz + "\n")
                elif q.has_geometry and q.geometry_svg:
                    tikz_block = self._svg_to_tikz_block(q.geometry_svg)
                    if tikz_block:
                        item_lines.append("\n" + tikz_block + "\n")
                    else:
                        svg_result = self._svg_to_png_attachment(q.geometry_svg)
                        if svg_result:
                            fname, data = svg_result
                            attachments.append((fname, data))
                            item_lines.append(f'\n\\includegraphics[width=0.6\\textwidth]{{{fname}}}\n')
                        else:
                            item_lines.append("\n% SVG 转换失败，未插入图形\n")
                # 答案/解析
                if include_answer and q.answer:
                    item_lines.append(r"\textbf{答案：} %s" % self._escape_latex(q.answer))
                if include_explanation and q.explanation:
                    item_lines.append(r"\textbf{解析：} %s" % self._escape_latex(q.explanation))
                body_parts.append("\n".join(item_lines))
            body_parts.append(r"\end{enumerate}")

        footer = r"\end{document}"
        return header + "\n\n".join(body_parts) + "\n" + footer, attachments

    def _sections_for_template(self, template: PaperTemplate):
        """
        根据模板定义分块标题和槽位
        """
        if template.id == "gaokao_new_1":
            sections = []
            slots_sorted = sorted(template.slots, key=lambda s: s.order)
            # 按 order 划分
            sections.append({
                "title": "一、选择题：本大题共 8 小题，每小题 5 分，共 40 分。",
                "start": 1,
                "slots": [{"order": s.order, "score": s.default_score} for s in slots_sorted if 1 <= s.order <= 8],
            })
            sections.append({
                "title": "二、选择题（多选）：本题共 3 小题，每小题 6 分，共 18 分。",
                "start": 9,
                "slots": [{"order": s.order, "score": s.default_score} for s in slots_sorted if 9 <= s.order <= 11],
            })
            sections.append({
                "title": "三、填空题：本大题共 3 小题，每小题 5 分，共 15 分。",
                "start": 12,
                "slots": [{"order": s.order, "score": s.default_score} for s in slots_sorted if 12 <= s.order <= 14],
            })
            sections.append({
                "title": "四、解答题：本大题共 5 小题，共 77 分。",
                "start": 15,
                "slots": [{"order": s.order, "score": s.default_score} for s in slots_sorted if 15 <= s.order <= 19],
            })
            return sections
        # 默认无分块
        slots_sorted = sorted(template.slots, key=lambda s: s.order)
        return [{
            "title": "试卷",
            "start": slots_sorted[0].order if slots_sorted else 1,
            "slots": [{"order": s.order, "score": s.default_score} for s in slots_sorted],
        }]

    def build_answer_latex(
        self,
        paper: orm.Paper,
        pq_list: List[orm.PaperQuestion],
        question_map: Mapping[str, orm.Question],
    ) -> Tuple[str, List[Tuple[str, bytes]]]:
        """
        生成答案卷 LaTeX：
        - 选择题（单选/多选）：表格显示题号+答案字母
        - 填空题：题号+答案值
        - 解答题：题号+完整答案
        """
        header = r"""\documentclass[12pt]{ctexart}
\usepackage[UTF8,fontset=none]{ctex}
\setCJKmainfont{Noto Serif CJK SC}
\setCJKsansfont{Noto Sans CJK SC}
\setCJKmonofont{Noto Sans Mono CJK SC}
\usepackage{unicode-math}
\setmathfont{Latin Modern Math}
\usepackage{amsmath,amssymb}
\usepackage{geometry,graphicx,enumitem,array,booktabs,tikz,fancyhdr}
\usepackage[bodytextleadingratio=1.67,restoremathleading=true]{zhlineskip}
\geometry{paperheight=26cm,paperwidth=18.4cm,left=2cm,right=2cm,top=1.5cm,bottom=2cm,headsep=10pt}
\pagestyle{fancy}
\renewcommand{\headrulewidth}{0pt}
\setlength{\parskip}{0.6em}
\setlength{\parindent}{0pt}
\providecommand{\SetMathEnvironmentSinglespace}[1]{}
\newcommand{\choicefour}[4]{%
  \begin{tabular}{p{0.45\textwidth}p{0.45\textwidth}}
  \textsf{A}.~#1 & \textsf{B}.~#2\\
  \textsf{C}.~#3 & \textsf{D}.~#4
  \end{tabular}
}
\begin{document}
\SetMathEnvironmentSinglespace{1}
\lineskiplimit=5.5pt
\lineskip=7pt
\abovedisplayshortskip=5pt
\belowdisplayshortskip=5pt
\abovedisplayskip=5pt
\begin{center}\Large\textbf{%s — 答案卷}\end{center}
\vspace{1em}
""" % self._escape_latex(paper.title)

        attachments: List[Tuple[str, bytes]] = []
        body_parts: List[str] = []
        
        # 按 order 排序
        pq_sorted = sorted(pq_list, key=lambda x: x.order)
        
        # 分类题目
        choices = []  # 单选 1-8
        multis = []   # 多选 9-11
        fillblanks = []  # 填空 12-14
        solves = []   # 解答 15-19
        
        for pq in pq_sorted:
            q = question_map.get(pq.question_id)
            if not q:
                continue
            order = pq.order
            if 1 <= order <= 8:
                choices.append((order, q))
            elif 9 <= order <= 11:
                multis.append((order, q))
            elif 12 <= order <= 14:
                fillblanks.append((order, q))
            else:
                solves.append((order, q))
        
        def extract_answer_letter(answer_text: str) -> str:
            """从答案文本中提取选项字母（如 A/B/C/D 或 AB/CD）"""
            if not answer_text:
                return ""
            # 尝试提取【答案】后的内容
            import re
            match = re.search(r'【答案】\s*([A-Za-z]+)', answer_text)
            if match:
                return match.group(1).upper()
            # 直接匹配开头的字母
            match = re.match(r'^([A-Za-z]+)', answer_text.strip())
            if match:
                return match.group(1).upper()
            # 返回前20字符作为fallback
            return answer_text.strip()[:20]
        
        def extract_fillblank_answer(answer_text: str) -> str:
            """从答案文本中提取填空答案"""
            if not answer_text:
                return ""
            import re
            match = re.search(r'【答案】\s*(.+?)(?=【|$)', answer_text, re.DOTALL)
            if match:
                return match.group(1).strip()[:50]
            return answer_text.strip()[:50]
        
        # 一、单选题答案表格
        if choices:
            body_parts.append(r"{\bf 一、选择题答案}")
            body_parts.append(r"\begin{center}")
            body_parts.append(r"\begin{tabular}{|" + "c|" * len(choices) + "}")
            body_parts.append(r"\hline")
            body_parts.append(" & ".join([str(o) for o, _ in choices]) + r" \\")
            body_parts.append(r"\hline")
            body_parts.append(" & ".join([extract_answer_letter(q.answer) for _, q in choices]) + r" \\")
            body_parts.append(r"\hline")
            body_parts.append(r"\end{tabular}")
            body_parts.append(r"\end{center}")
            body_parts.append(r"\vspace{1em}")
        
        # 二、多选题答案表格
        if multis:
            body_parts.append(r"{\bf 二、多选题答案}")
            body_parts.append(r"\begin{center}")
            body_parts.append(r"\begin{tabular}{|" + "c|" * len(multis) + "}")
            body_parts.append(r"\hline")
            body_parts.append(" & ".join([str(o) for o, _ in multis]) + r" \\")
            body_parts.append(r"\hline")
            body_parts.append(" & ".join([extract_answer_letter(q.answer) for _, q in multis]) + r" \\")
            body_parts.append(r"\hline")
            body_parts.append(r"\end{tabular}")
            body_parts.append(r"\end{center}")
            body_parts.append(r"\vspace{1em}")
        
        # 三、填空题答案
        if fillblanks:
            body_parts.append(r"{\bf 三、填空题答案}")
            body_parts.append(r"\begin{enumerate}[label=\arabic*.,start=12,leftmargin=1.5em]")
            for order, q in fillblanks:
                ans = extract_fillblank_answer(q.answer)
                body_parts.append(r"\item %s" % self._escape_latex(ans))
            body_parts.append(r"\end{enumerate}")
            body_parts.append(r"\vspace{1em}")
        
        # 四、解答题完整答案
        if solves:
            body_parts.append(r"{\bf 四、解答题答案}")
            body_parts.append(r"\begin{enumerate}[label=\arabic*.,start=15,leftmargin=1.5em,itemsep=1.5em]")
            for order, q in solves:
                body_parts.append(r"\item %s" % self._escape_latex(q.answer or "（无答案）"))
            body_parts.append(r"\end{enumerate}")
        
        footer = r"\end{document}"
        return header + "\n\n".join(body_parts) + "\n" + footer, attachments

    def build_single_question_latex(
        self,
        question: dict,
        include_answer: bool = True,
        include_explanation: bool = True,
    ) -> Tuple[str, List[Tuple[str, bytes]]]:
        """
        为单题生成可编译的 LaTeX 片段，返回 (latex, attachments)
        """
        header = r"""\documentclass[12pt,a4paper]{article}
\usepackage{ctex}
\usepackage{amsmath,amssymb}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{tikz}
\geometry{left=2cm,right=2cm,top=2.5cm,bottom=2.5cm}
\begin{document}
"""
        body_parts: List[str] = []
        attachments: List[Tuple[str, bytes]] = []

        body_parts.append(self._escape_latex(question.get("questionText") or ""))
        options = question.get("options") or []
        for opt in options:
            body_parts.append(r"\par " + self._escape_latex(opt))

        if question.get("hasGeometry") and question.get("geometryTikz"):
            body_parts.append("\n" + question.get("geometryTikz") + "\n")
        elif question.get("hasGeometry") and question.get("geometrySvg"):
            svg_result = self._svg_to_png_attachment(question.get("geometrySvg"))
            if svg_result:
                fname, data = svg_result
                attachments.append((fname, data))
                body_parts.append(f'\n\\includegraphics[width=0.6\\textwidth]{{{fname}}}\n')
            else:
                body_parts.append("\n% TODO: embed SVG or convert to TikZ\n")

        if include_answer and question.get("answer"):
            body_parts.append(f"\n\\textbf{{答案：}} {self._escape_latex(question.get('answer') or '')}")
        if include_explanation and question.get("explanation"):
            body_parts.append(f"\n\\textbf{{解析：}} {self._escape_latex(question.get('explanation') or '')}")

        footer = r"""\end{document}
"""
        latex = header + "\n\n".join(body_parts) + footer
        return latex, attachments

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
        header = r"""\documentclass[12pt]{ctexart}
\usepackage[UTF8,fontset=none]{ctex}
\setCJKmainfont{Noto Serif CJK SC}
\setCJKsansfont{Noto Sans CJK SC}
\setCJKmonofont{Noto Sans Mono CJK SC}
\usepackage{amsmath,amssymb}
\usepackage{geometry,graphicx,enumitem,tikz,fancyhdr}
\usepackage[bodytextleadingratio=1.67,restoremathleading=true]{zhlineskip}
\geometry{paperheight=26cm,paperwidth=18.4cm,left=2cm,right=2cm,top=1.5cm,bottom=2cm,headsep=10pt}
\pagestyle{fancy}
\renewcommand{\headrulewidth}{0pt}
\setlength{\parskip}{0.6em}
\setlength{\parindent}{0pt}
\newcommand{\choicefour}[4]{%%
  \begin{tabular}{p{0.45\textwidth}p{0.45\textwidth}}
  \textsf{A}.~#1 & \textsf{B}.~#2\\
  \textsf{C}.~#3 & \textsf{D}.~#4
  \end{tabular}
}
\begin{document}
\begin{center}
\Large %s
\end{center}
\vspace{0.5em}
""" % self._escape_latex(paper.title)

        body_parts = []
        attachments: List[Tuple[str, bytes]] = []
        
        # 按题型分组
        SECTION_ORDER = ['choice_single', 'choice_multi', 'fill', 'solve']
        SECTION_NAMES = {
            'choice_single': '一、选择题',
            'choice_multi': '二、多项选择题',
            'fill': '二、填空题',
            'solve': '三、解答题',
        }
        
        # 收集题目按类型分组
        questions_by_type: dict = {}
        for pq in sorted(pq_list, key=lambda x: x.order):
            q = question_map.get(pq.question_id)
            if not q:
                continue
            qtype = q.question_type or 'solve'
            if qtype.startswith('choice'):
                qtype = 'choice_single'
            if qtype not in questions_by_type:
                questions_by_type[qtype] = []
            questions_by_type[qtype].append((pq, q))
        
        # 判断是否只有一种题型
        has_multiple_types = len(questions_by_type) > 1
        
        # 按顺序输出各类型题目
        question_number = 0
        for section_type in SECTION_ORDER:
            if section_type not in questions_by_type:
                continue
            
            section_content = []
            
            # 添加章节标题（如果有多种题型）
            if has_multiple_types:
                section_name = SECTION_NAMES.get(section_type, section_type)
                section_content.append(r"\vspace{1em}")
                section_content.append(r"\noindent\textbf{%s}" % section_name)
                section_content.append(r"\vspace{0.5em}")
            
            # 开始这个章节的 enumerate
            section_content.append(r"\begin{enumerate}[leftmargin=0em,label=\arabic*.,itemsep=1em,start=%d]" % (question_number + 1))
            
            for pq, q in questions_by_type[section_type]:
                question_number += 1
                try:
                    item = []
                    item.append(f"\\item ({pq.score}分) {self._escape_latex(q.question_text)}")
                    # 选项渲染
                    if q.options and len(q.options) == 4 and (q.question_type or "").startswith("choice"):
                        a, b, c, d = q.options
                        item.append("\n" + r"\choicefour{%s}{%s}{%s}{%s}" % (
                            self._escape_latex(a),
                            self._escape_latex(b),
                            self._escape_latex(c),
                            self._escape_latex(d),
                        ) + "\n")
                    elif q.options:
                        item.append(r"\begin{enumerate}[label=\Alph*. ,leftmargin=1.2em,itemsep=0.2em]")
                        for opt in q.options:
                            item.append(r"\item %s" % self._escape_latex(opt))
                        item.append(r"\end{enumerate}")
                    # 图形
                    if q.has_geometry and q.geometry_tikz:
                        item.append("\n" + q.geometry_tikz + "\n")
                    elif q.has_geometry and q.geometry_svg:
                        # 优先尝试转 TikZ
                        tikz_block = self._svg_to_tikz_block(q.geometry_svg)
                        if tikz_block:
                            item.append("\n" + tikz_block + "\n")
                        else:
                            # TikZ 转换失败，尝试 PNG
                            svg_result = self._svg_to_png_attachment(q.geometry_svg)
                            if svg_result:
                                fname, data = svg_result
                                attachments.append((fname, data))
                                item.append(f'\n\\includegraphics[width=0.6\\textwidth]{{{fname}}}\n')
                    if include_answer and q.answer:
                        item.append(f"\n\\textbf{{答案：}} {self._escape_latex(q.answer)}")
                    if include_explanation and q.explanation:
                        item.append(f"\n\\textbf{{解析：}} {self._escape_latex(q.explanation)}")
                    section_content.append("\n".join(item))
                except Exception as e:
                    # 单题出错不影响整体
                    section_content.append(f"\\item % 题目生成出错: {str(e)[:50]}")
            
            # 结束这个章节的 enumerate
            section_content.append(r"\end{enumerate}")
            body_parts.append("\n".join(section_content))

        footer = r"""
\end{document}
"""
        return header + "\n\n".join(body_parts) + footer, attachments

    def compile_pdf(self, latex_content: str, attachments: List[Tuple[str, bytes]] | None = None) -> tuple[bool, str | Path, str]:
        """
        调用 xelatex 编译，返回 (ok, path/message, log_text)
        """
        import shutil

        engine = shutil.which("xelatex")
        if not engine:
            return False, "xelatex not found (please install texlive-xetex)", ""

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                tmp_path = Path(tmpdir)
                tex_file = tmp_path / "paper.tex"
                tex_file.write_text(latex_content, encoding="utf-8")
                # 写入附件（图片等）
                for fname, data in attachments or []:
                    (tmp_path / fname).write_bytes(data)
                cmd = [
                    engine,
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
                # 只要 PDF 存在就算成功（LaTeX 警告会导致非零返回码）
                if pdf_file.exists():
                    # 安全创建临时文件保存结果
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_out:
                        tmp_out.write(pdf_file.read_bytes())
                        out_file = Path(tmp_out.name)
                    return True, out_file, log
                return False, log or "xelatex failed", log
        except FileNotFoundError as exc:
            return False, "xelatex not found in PATH", str(exc)
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

    def _svg_to_tikz_block(self, svg_content: str) -> str | None:
        """
        将简单 SVG 转换为 TikZ 片段（支持 line/circle/ellipse/text 基础元素）。
        若无法解析则返回 None。
        """
        if not svg_content:
            return None
        try:
            root = ET.fromstring(svg_content)
        except Exception:
            return None

        # 获取画布大小用于翻转 y 轴
        width, height = 400.0, 400.0
        viewbox = root.get("viewBox")
        if viewbox:
            parts = viewbox.replace(",", " ").split()
            if len(parts) == 4:
                try:
                    width = float(parts[2])
                    height = float(parts[3])
                except Exception:
                    pass
        else:
            try:
                width = float((root.get("width") or "400").replace("px", ""))
                height = float((root.get("height") or "400").replace("px", ""))
            except Exception:
                pass

        cmds: List[str] = []
        scale = 0.03  # 将 400x400 缩放到约 12x12

        def fmt(coord: str | None) -> float:
            try:
                return float(coord or "0.0")
            except Exception:
                return 0.0

        def flip_y(y: float) -> float:
            return (height - y) * scale

        def is_dashed(el: ET.Element) -> bool:
            style = el.get("style", "")
            cls = el.get("class", "")
            dasharray = el.get("stroke-dasharray", "")
            return ("dash" in style) or ("dash" in cls) or (dasharray not in ("", None))

        def parse_path(d: str) -> List[tuple[float, float]]:
            import re
            pts = []
            parts = re.findall(r'[ML]\s*([-\d.]+)\s+([-\d.]+)', d or "", re.IGNORECASE)
            for x, y in parts:
                try:
                    pts.append((float(x), float(y)))
                except Exception:
                    continue
            return pts

        for el in root.iter():
            tag = el.tag.split("}")[-1].lower()
            dashed = "[dashed]" if is_dashed(el) else ""
            if tag == "line":
                x1, y1 = fmt(el.get("x1")), fmt(el.get("y1"))
                x2, y2 = fmt(el.get("x2")), fmt(el.get("y2"))
                cmds.append(r"\draw%s (%.3f,%.3f) -- (%.3f,%.3f);" % (dashed, x1 * scale, flip_y(y1), x2 * scale, flip_y(y2)))
            elif tag == "circle":
                cx, cy = fmt(el.get("cx")), fmt(el.get("cy"))
                r = fmt(el.get("r"))
                cmds.append(r"\draw%s (%.3f,%.3f) circle (%.3f);" % (dashed, cx * scale, flip_y(cy), r * scale))
            elif tag == "ellipse":
                cx, cy = fmt(el.get("cx")), fmt(el.get("cy"))
                rx, ry = fmt(el.get("rx")), fmt(el.get("ry"))
                cmds.append(r"\draw%s (%.3f,%.3f) ellipse (%.3f and %.3f);" % (dashed, cx * scale, flip_y(cy), rx * scale, ry * scale))
            elif tag == "path":
                pts = parse_path(el.get("d") or "")
                if len(pts) >= 2:
                    coords = " -- ".join(["(%.3f,%.3f)" % (x * scale, flip_y(y)) for x, y in pts])
                    cmds.append(r"\draw%s %s;" % (dashed, coords))
            elif tag == "text":
                x, y = fmt(el.get("x")), fmt(el.get("y"))
                dx = fmt(el.get("dx"))
                dy = fmt(el.get("dy"))
                txt = (el.text or "").strip()
                if txt:
                    cmds.append(r"\node at (%.3f,%.3f) {%s};" % ((x + dx) * scale, flip_y(y + dy), self._escape_latex(txt)))

        if not cmds:
            return None
        tikz = ["\\begin{tikzpicture}[scale=1]", *cmds, "\\end{tikzpicture}"]
        return "\n".join(tikz)

    def svg_to_png_base64(self, svg_content: str) -> str | None:
        """
        将 SVG 转 base64 PNG，前端可直接展示。
        """
        if not svg_content or cairosvg is None:
            return None
        try:
            png_bytes = cairosvg.svg2png(bytestring=svg_content.encode("utf-8"))
            return f"data:image/png;base64,{base64.b64encode(png_bytes).decode('utf-8')}"
        except Exception:
            return None

    def _clean_markdown(self, text: str) -> str:
        """
        简单去掉常见的 Markdown 标记，保留公式/纯文本。
        """
        if not text:
            return ""
        import re
        t = text
        # 去掉代码块
        t = re.sub(r"```.*?```", "", t, flags=re.S)
        # 去掉标题符号
        t = re.sub(r"^\\s*#{1,6}\\s*", "", t, flags=re.M)
        # 去掉加粗/斜体标记
        t = t.replace("**", "").replace("__", "").replace("*", "")
        # 去掉列表标记
        t = re.sub(r"^\\s*[-+*]\\s+", "", t, flags=re.M)
        return t.strip()

    def _escape_latex(self, text: str) -> str:
        """
        转义特殊字符，但保留数学环境 $...$ 和 $$...$$ 内的内容不转义。
        """
        if not text:
            return ""
        import re
        
        # 先简单清洗 Markdown
        text = self._clean_markdown(text)
        
        # 使用正则分割，保留数学环境
        # 匹配 $$...$$ 或 $...$（非贪婪）
        pattern = r'(\$\$.*?\$\$|\$.*?\$)'
        parts = re.split(pattern, text, flags=re.DOTALL)
        
        result = []
        for i, part in enumerate(parts):
            if part.startswith('$$') or part.startswith('$'):
                # 数学环境，直接保留
                result.append(part)
            else:
                # 非数学环境，转义特殊字符
                escaped = self._escape_text_only(part)
                result.append(escaped)
        
        return ''.join(result)
    
    def _escape_text_only(self, text: str) -> str:
        """
        仅转义普通文本中的特殊字符（不在数学环境中）。
        连续下划线（____）作为填空横线处理。
        """
        import re
        
        # 使用占位符保护连续下划线，避免被逐字符转义
        BLANK_PLACEHOLDER = "\x00BLANK\x00"
        text = re.sub(r'_{2,}', BLANK_PLACEHOLDER, text)
        
        # 转义特殊字符
        replacements = {
            "&": r"\&",
            "%": r"\%",
            "#": r"\#",
            "_": r"\_",
            "{": r"\{",
            "}": r"\}",
            "~": r"\textasciitilde{}",
            "^": r"\^{}",
        }
        out = []
        for ch in text:
            out.append(replacements.get(ch, ch))
        result = "".join(out)
        
        # 将占位符替换为 LaTeX 填空横线
        result = result.replace(BLANK_PLACEHOLDER, r"\underline{\hspace{2em}}")
        return result
