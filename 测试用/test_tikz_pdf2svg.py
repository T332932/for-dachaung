#!/usr/bin/env python3
"""测试 TikZ → PDF → SVG，尝试不同方法"""

import subprocess
import tempfile
import shutil
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
    
    # 1. 编译 PDF
    print("=== 步骤1: xelatex 编译 ===")
    subprocess.run(
        ["xelatex", "-interaction=nonstopmode", "tikz.tex"],
        cwd=tmpdir,
        capture_output=True,
        timeout=30
    )
    
    pdf_file = tmp_path / "tikz.pdf"
    print(f"PDF 生成: {pdf_file.exists()}")
    
    if not pdf_file.exists():
        print("编译失败")
        exit(1)
    
    # 方法1: pdf2svg（如果安装了）
    print("\n=== 方法1: pdf2svg ===")
    if shutil.which("pdf2svg"):
        result = subprocess.run(
            ["pdf2svg", "tikz.pdf", "tikz_m1.svg"],
            cwd=tmpdir,
            capture_output=True,
            text=True
        )
        svg1 = tmp_path / "tikz_m1.svg"
        if svg1.exists():
            print(f"✅ pdf2svg 成功，大小: {svg1.stat().st_size} bytes")
            shutil.copy(svg1, "测试用/test_output_pdf2svg.svg")
        else:
            print(f"❌ pdf2svg 失败: {result.stderr}")
    else:
        print("pdf2svg 未安装")
    
    # 方法2: inkscape（如果安装了）
    print("\n=== 方法2: inkscape ===")
    if shutil.which("inkscape"):
        result = subprocess.run(
            ["inkscape", "--export-type=svg", "--export-filename=tikz_m2.svg", "tikz.pdf"],
            cwd=tmpdir,
            capture_output=True,
            text=True
        )
        svg2 = tmp_path / "tikz_m2.svg"
        if svg2.exists():
            print(f"✅ inkscape 成功，大小: {svg2.stat().st_size} bytes")
        else:
            print(f"❌ inkscape 失败: {result.stderr}")
    else:
        print("inkscape 未安装")
    
    # 方法3: mutool（如果安装了）
    print("\n=== 方法3: mutool ===")
    if shutil.which("mutool"):
        result = subprocess.run(
            ["mutool", "convert", "-o", "tikz_m3.svg", "tikz.pdf"],
            cwd=tmpdir,
            capture_output=True,
            text=True
        )
        svg3 = tmp_path / "tikz_m3.svg"
        if svg3.exists():
            print(f"✅ mutool 成功，大小: {svg3.stat().st_size} bytes")
        else:
            print(f"❌ mutool 失败: {result.stderr}")
    else:
        print("mutool 未安装")
    
    # 方法4: dvisvgm 直接从 DVI（用 latex 而不是 xelatex）
    print("\n=== 方法4: latex + dvisvgm ===")
    # 用不带中文的简化版本测试
    simple_latex = r"""\documentclass[tikz,border=5pt]{standalone}
\usepackage{amsmath,amssymb}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,patterns,calc}
\begin{document}
\begin{tikzpicture}[scale=1.2]
  \draw[->] (-0.5, 0) -- (3, 0) node[below] {$x$};
  \draw[->] (0, -1.2) -- (0, 1.2) node[left] {$y$};
  \draw[domain=-0.4:2.8, samples=100, smooth, blue] plot (\x, {sin(2*\x r + 2*pi/3)});
\end{tikzpicture}
\end{document}
"""
    simple_tex = tmp_path / "simple.tex"
    simple_tex.write_text(simple_latex)
    
    subprocess.run(
        ["latex", "-interaction=nonstopmode", "simple.tex"],
        cwd=tmpdir,
        capture_output=True,
        timeout=30
    )
    
    dvi_file = tmp_path / "simple.dvi"
    if dvi_file.exists():
        result = subprocess.run(
            ["dvisvgm", "--no-fonts", "-o", "simple.svg", "simple.dvi"],
            cwd=tmpdir,
            capture_output=True,
            text=True
        )
        svg4 = tmp_path / "simple.svg"
        if svg4.exists():
            print(f"✅ latex+dvisvgm 成功，大小: {svg4.stat().st_size} bytes")
            shutil.copy(svg4, "测试用/test_output_dvisvgm.svg")
        else:
            print(f"❌ dvisvgm 失败: {result.stderr}")
    else:
        print("latex 编译失败，无 DVI")
    
    # 保存 PDF 供查看
    shutil.copy(pdf_file, "测试用/test_output.pdf")
    print("\n✅ PDF 已保存到 测试用/test_output.pdf")
