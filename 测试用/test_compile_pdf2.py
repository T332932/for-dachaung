#!/usr/bin/env python3
"""测试新的 AI 输出"""

import sys
sys.path.insert(0, 'backend')

from services.export_service import ExportService

# 新的 AI 输出
question = {
    "questionText": "10. 下图是函数 $y = \\sin(\\omega x + \\phi)$ 的部分图像, 则 $\\sin(\\omega x + \\phi)=$\n\n  ![函数图像](...)  \n",
    "options": [
        "A. $\\sin(x + \\frac{\\pi}{3})$",
        "B. $\\sin(\\frac{\\pi}{3} - 2x)$",
        "C. $\\cos(2x + \\frac{\\pi}{6})$",
        "D. $\\cos(\\frac{5\\pi}{6} - 2x)$"
    ],
    "answer": "由函数图像可知...(省略)...故选 A。",
    "hasGeometry": True,
    "geometryTikz": r"""\begin{tikzpicture}[scale=0.75, line width=0.5pt, >=Stealth[length=4pt], every node/.style={font=\small, inner sep=1pt}]
\draw[->] (-0.5, 0) -- (3.5, 0) node[below] {$x$};
\draw[->] (0, -1.5) -- (0, 1.5) node[left] {$y$};
\node[below left] at (0,0) {$O$};

\draw[domain=-0.3:3.2, samples=100, smooth, thick, color=blue] plot (\x, {sin((\x r) + pi/3 r)});

\draw (1.57, 0.05) -- (1.57, -0.05) node[below] {$\frac{2\pi}{3}$};
\node at ({pi/6}, -0.05) {$\shortmid$};
\node[below] at ({pi/6}, -0.05) {$\frac{\pi}{6}$};
\draw (-0.05, 1) -- (0.05, 1) node[right] {$1$};

\draw[dashed] ({pi/6}, 0) -- ({pi/6}, 1) -- (0, 1);
\node[circle, fill, inner sep=1pt] at ({pi/6}, 1) {};
\node[circle, fill, inner sep=1pt] at ({2*pi/3}, 0) {};

% Corrected x-axis tick labels to decimal for pgfplots compatibility
% x=pi/6 is approx 0.52
% x=2pi/3 is approx 2.09
\draw[dashed] (0.52, 0) -- (0.52, 1) -- (0, 1);
\node[circle, fill, inner sep=1pt] at (0.52, 1) {};
\node[circle, fill, inner sep=1pt] at (2.09, 0) {};
\draw (2.09, 0.05) -- (2.09, -0.05) node[below] {$\frac{2\pi}{3}$};
\node at (0.52, -0.05) {$\shortmid$};
\node[below] at (0.52, -0.05) {$\frac{\pi}{6}$};

\end{tikzpicture}"""
}

export_service = ExportService()

# 1. 测试 build_single_question_latex
print("=== 测试 build_single_question_latex ===")
latex, attachments = export_service.build_single_question_latex(question, include_answer=True)
print(f"LaTeX 长度: {len(latex)} 字符")

# 检查 Markdown 图片是否被清理
if "![" in latex:
    print("⚠️  警告: LaTeX 中仍有 Markdown 图片语法")
else:
    print("✅ Markdown 图片语法已清理")

# 保存 LaTeX
with open("测试用/test_single_question2.tex", "w") as f:
    f.write(latex)
print("LaTeX 已保存到 测试用/test_single_question2.tex")

# 2. 测试 compile_pdf
print("\n=== 测试 compile_pdf ===")
ok, result, log = export_service.compile_pdf(latex, attachments)

if ok:
    print(f"✅ PDF 编译成功: {result}")
    import shutil
    shutil.copy(result, "测试用/test_single_question2.pdf")
    print("PDF 已保存到 测试用/test_single_question2.pdf")
    export_service.cleanup_file(result)
else:
    print(f"❌ PDF 编译失败")
    # 找错误行
    for line in log.split('\n'):
        if '!' in line or 'Error' in line:
            print(f"  {line}")
