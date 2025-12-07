#!/usr/bin/env python3
"""测试后端 compile_pdf 能否正常处理 AI 输出的 TikZ"""

import sys
sys.path.insert(0, 'backend')

from services.export_service import ExportService

# 模拟一个完整的单题 LaTeX（包含 AI 输出的 TikZ）
tikz_content = r"""\begin{tikzpicture}[scale=1.2, line width=0.5pt, >=Stealth[length=4pt], every node/.style={font=\small, inner sep=1pt}]
  \draw[->] (-0.5, 0) -- (3, 0) node[below] {$x$};
  \draw[->] (0, -1.2) -- (0, 1.2) node[left] {$y$};
  \node[below left=1pt] at (0,0) {$O$};
  \draw[domain=-0.4:2.8, samples=100, smooth, color=blue, line width=0.6pt] plot (\x, {sin(2*\x r + 2*pi/3)});
  \node[below] at (pi/6, 0) {$\frac{\pi}{6}$};
  \draw (pi/6, 0.05) -- (pi/6, -0.05);
  \node[below] at (2*pi/3, 0) {$\frac{2\pi}{3}$};
  \draw (2*pi/3, 0.05) -- (2*pi/3, -0.05);
  \node[left] at (0, 1) {$1$};
  \draw (0.05, 1) -- (-0.05, 1);
  \node[left] at (0, -1) {$-1$};
  \draw (0.05, -1) -- (-0.05, -1);
\end{tikzpicture}"""

# 模拟 AI 输出的 question dict
question = {
    "questionText": "下图是函数 $y = \\sin(\\omega x + \\phi)$ 的部分图像，则 $\\sin(\\omega x + \\phi)=$",
    "options": [
        "A. $\\sin(x + \\frac{\\pi}{3})$",
        "B. $\\sin(\\frac{\\pi}{3} - 2x)$",
        "C. $\\cos(2x + \\frac{\\pi}{6})$",
        "D. $\\cos(\\frac{5\\pi}{6} - 2x)$"
    ],
    "answer": "C",
    "hasGeometry": True,
    "geometryTikz": tikz_content,
}

export_service = ExportService()

# 1. 测试 build_single_question_latex
print("=== 测试 build_single_question_latex ===")
latex, attachments = export_service.build_single_question_latex(question, include_answer=True)
print(f"LaTeX 长度: {len(latex)} 字符")
print(f"附件数量: {len(attachments)}")

# 保存 LaTeX 查看
with open("测试用/test_single_question.tex", "w") as f:
    f.write(latex)
print("LaTeX 已保存到 测试用/test_single_question.tex")

# 2. 测试 compile_pdf
print("\n=== 测试 compile_pdf ===")
ok, result, log = export_service.compile_pdf(latex, attachments)

if ok:
    print(f"✅ PDF 编译成功: {result}")
    # 复制到测试目录
    import shutil
    shutil.copy(result, "测试用/test_single_question.pdf")
    print("PDF 已保存到 测试用/test_single_question.pdf")
    export_service.cleanup_file(result)
else:
    print(f"❌ PDF 编译失败: {result}")
    print(f"日志最后 1000 字符:\n{log[-1000:]}")
