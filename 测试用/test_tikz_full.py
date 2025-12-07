#!/usr/bin/env python3
"""测试完整 TikZ → PDF → SVG 流程"""

import subprocess
import tempfile
from pathlib import Path

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

latex_doc = r"""\documentclass[tikz,border=5pt]{standalone}
\usepackage{ctex}
\usepackage{amsmath,amssymb}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,patterns,calc}
\begin{document}
""" + tikz_content + r"""
\end{document}
"""

with tempfile.TemporaryDirectory() as tmpdir:
    tmp_path = Path(tmpdir)
    tex_file = tmp_path / "tikz.tex"
    tex_file.write_text(latex_doc, encoding="utf-8")
    
    # 1. 编译 PDF（不用 -halt-on-error）
    print("=== 步骤1: xelatex 编译 ===")
    result = subprocess.run(
        ["xelatex", "-interaction=nonstopmode", "tikz.tex"],
        cwd=tmpdir,
        capture_output=True,
        text=True,
        timeout=30
    )
    
    pdf_file = tmp_path / "tikz.pdf"
    print(f"PDF 生成: {pdf_file.exists()}")
    
    if not pdf_file.exists():
        print("编译失败，退出")
        exit(1)
    
    # 2. dvisvgm 转 SVG
    print("\n=== 步骤2: dvisvgm 转换 ===")
    result = subprocess.run(
        ["dvisvgm", "--pdf", "--no-fonts", "-o", "tikz.svg", "tikz.pdf"],
        cwd=tmpdir,
        capture_output=True,
        text=True,
        timeout=30
    )
    print(f"STDOUT: {result.stdout}")
    print(f"STDERR: {result.stderr}")
    
    svg_file = tmp_path / "tikz.svg"
    print(f"SVG 生成: {svg_file.exists()}")
    
    if svg_file.exists():
        svg_content = svg_file.read_text()
        print(f"SVG 长度: {len(svg_content)} 字符")
        # 保存到测试目录
        with open("测试用/test_output.svg", "w") as f:
            f.write(svg_content)
        print("✅ 已保存到 测试用/test_output.svg")
    else:
        print("❌ SVG 转换失败")
