#!/usr/bin/env python3
"""测试 TikZ 转 SVG - 带详细日志"""

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

# 保存并编译
with tempfile.TemporaryDirectory() as tmpdir:
    tmp_path = Path(tmpdir)
    tex_file = tmp_path / "tikz.tex"
    tex_file.write_text(latex_doc, encoding="utf-8")
    
    print("=== LaTeX 文档 ===")
    print(latex_doc)
    print("\n=== 开始编译 ===")
    
    result = subprocess.run(
        ["xelatex", "-interaction=nonstopmode", "tikz.tex"],
        cwd=tmpdir,
        capture_output=True,
        text=True,
        timeout=30
    )
    
    print("\n=== STDOUT ===")
    print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
    
    print("\n=== STDERR ===")
    print(result.stderr)
    
    pdf_file = tmp_path / "tikz.pdf"
    print(f"\n=== PDF 生成: {pdf_file.exists()} ===")
