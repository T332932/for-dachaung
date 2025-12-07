#!/usr/bin/env python3
"""测试 TikZ 转 SVG"""

import sys
sys.path.insert(0, 'backend')

from services.export_service import ExportService

# AI 输出的 TikZ（从 JSON 解析后的状态，单反斜杠）
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

export_service = ExportService()
result = export_service.tikz_to_svg(tikz_content)

if result:
    print("✅ 转换成功！")
    print(f"SVG 长度: {len(result)} 字符")
    # 保存 SVG 文件
    with open("测试用/test_output.svg", "w") as f:
        f.write(result)
    print("已保存到 测试用/test_output.svg")
else:
    print("❌ 转换失败")
