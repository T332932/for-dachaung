#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""只测试 TikZ 编译"""

import subprocess
import tempfile
from pathlib import Path

# 你给的 TikZ（JSON 解析后应该是单反斜杠）
tikz = r"""\begin{tikzpicture}[scale=0.75, line width=0.5pt, >=Stealth[length=4pt], every node/.style={font=\small, inner sep=1pt}]
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

latex_doc = r"""\documentclass[12pt,a4paper]{article}
\usepackage{ctex}
\usepackage{amsmath,amssymb}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,patterns,calc}
\geometry{left=2cm,right=2cm,top=2.5cm,bottom=2.5cm}
\begin{document}
""" + tikz + r"""
\end{document}
"""

# 保存并编译
with tempfile.TemporaryDirectory() as tmpdir:
    tmp_path = Path(tmpdir)
    tex_file = tmp_path / "test.tex"
    tex_file.write_text(latex_doc, encoding="utf-8")
    
    print("=== 编译 TikZ ===")
    result = subprocess.run(
        ["xelatex", "-interaction=nonstopmode", "test.tex"],
        cwd=tmpdir,
        capture_output=True,
        text=True,
        timeout=60
    )
    
    pdf_file = tmp_path / "test.pdf"
    if pdf_file.exists():
        print(f"✅ PDF 生成成功，大小: {pdf_file.stat().st_size} bytes")
        import shutil
        shutil.copy(pdf_file, "测试用/test_tikz_only.pdf")
        print("已保存到 测试用/test_tikz_only.pdf")
    else:
        print("❌ PDF 生成失败")
        # 找错误
        for line in result.stdout.split('\n'):
            if '!' in line or 'Error' in line:
                print(f"  {line}")
