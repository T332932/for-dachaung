#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""直接用原始 JSON 测试"""

import sys
import json
sys.path.insert(0, 'backend')

from services.export_service import ExportService

# 原始 JSON 字符串（从用户输入复制）
raw_json = r'''{"questionText": "10. 下图是函数 $y = \\sin(\\omega x + \\phi)$ 的部分图像, 则 $\\sin(\\omega x + \\phi)=$\n\n  ![函数图像](...)  \n","options": ["A. $\\sin(x + \\frac{\\pi}{3})$","B. $\\sin(\\frac{\\pi}{3} - 2x)$","C. $\\cos(2x + \\frac{\pi}{6})$","D. $\\cos(\\frac{5\\pi}{6} - 2x)$"],"answer": "由函数图像可知，函数的一个最大值点是 $(\\frac{\\pi}{6}, 1)$，以及一个零点是 $(\\frac{2\\pi}{3}, 0)$。\n\n**方法一：利用五点法关键点求解**\n\n1.  **求周期 $T$ 和角频率 $\\omega$**\n    从最大值点到相邻的平衡位置（函数值为0且单调递减）的时间间隔是四分之一个周期。\n    所以，$\\frac{T}{4} = \\frac{2\\pi}{3} - \\frac{\\pi}{6} = \\frac{4\\pi}{6} - \\frac{\\pi}{6} = \\frac{3\\pi}{6} = \\frac{\\pi}{2}$。\n    因此，周期 $T = 4 \\times \\frac{\\pi}{2} = 2\\pi$。\n    角频率 $\\omega = \\frac{2\\pi}{T} = \\frac{2\\pi}{2\\pi} = 1$。\n    此时函数解析式为 $y = \\sin(x + \\phi)$。\n\n2.  **求初相 $\\phi$**\n    将最大值点 $(\\frac{\\pi}{6}, 1)$ 代入函数解析式中，得：\n    $1 = \\sin(\\frac{\\pi}{6} + \\phi)$。\n    根据正弦函数的性质，可得 $\\frac{\\pi}{6} + \\phi = \\frac{\pi}{2} + 2k\\pi$，其中 $k$ 为整数。\n    解得 $\\phi = \\frac{\pi}{2} - \\frac{\pi}{6} + 2k\\pi = \\frac{\\pi}{3} + 2k\\pi$。\n    通常我们取 $k=0$（或取满足 $|\\phi| < \\pi$ 的值），得 $\\phi = \\frac{\\pi}{3}$。\n\n3.  **确定函数解析式**\n    综上，函数解析式为 $y = \\sin(x + \\frac{\pi}{3})$。\n\n    **验证**：将零点 $(\\frac{2\\pi}{3}, 0)$ 代入验证：\n    $y = \\sin(\\frac{2\\pi}{3} + \\frac{\pi}{3}) = \\sin(\\pi) = 0$。验证通过。\n\n    因此，正确答案是 A。\n\n**方法二：逐一验证选项**\n\n-   **选项 A: $y = \\sin(x + \\frac{\\pi}{3})$**\n    -   当 $x = \\frac{\\pi}{6}$ 时，$y = \\sin(\\frac{\\pi}{6} + \\frac{\\pi}{3}) = \\sin(\\frac{\pi}{2}) = 1$。 （满足最大值点）\n    -   当 $x = \\frac{2\\pi}{3}$ 时，$y = \\sin(\\frac{2\\pi}{3} + \\frac{\pi}{3}) = \\sin(\\pi) = 0$。 （满足零点）\n    -   该选项符合图像特征。 \n\n-   **选项 B: $y = \\sin(\\frac{\\pi}{3} - 2x)$**\n    -   当 $x = \\frac{\\pi}{6}$ 时，$y = \\sin(\\frac{\\pi}{3} - 2 \\times \\frac{\\pi}{6}) = \\sin(\\frac{\\pi}{3} - \\frac{\\pi}{3}) = \\sin(0) = 0$。这与图像在 $x=\\frac{\\pi}{6}$ 处取最大值 1 矛盾。 \n\n-   **选项 C: $y = \\cos(2x + \\frac{\\pi}{6})$**\n    -   当 $x = \\frac{\\pi}{6}$ 时，$y = \\cos(2 \\times \\frac{\\pi}{6} + \\frac{\\pi}{6}) = \\cos(\\frac{\\pi}{3} + \\frac{\\pi}{6}) = \\cos(\\frac{\\pi}{2}) = 0$。这与图像在 $x=\\frac{\pi}{6}$ 处取最大值 1 矛盾。 \n\n-   **选项 D: $y = \\cos(\\frac{5\\pi}{6} - 2x)$**\n    -   当 $x = \\frac{\\pi}{6}$ 时，$y = \\cos(\\frac{5\\pi}{6} - 2 \\times \\frac{\\pi}{6}) = \\cos(\\frac{5\\pi}{6} - \\frac{\\pi}{3}) = \\cos(\\frac{3\\pi}{6}) = \\cos(\\frac{\\pi}{2}) = 0$。这与图像在 $x=\\frac{\\pi}{6}$ 处取最大值 1 矛盾。 \n\n两种方法均得出结论，函数解析式为 $y = \\sin(x + \\frac{\\pi}{3})$。\n\n故选 A。","hasGeometry": true,"geometryTikz": "\\begin{tikzpicture}[scale=0.75, line width=0.5pt, >=Stealth[length=4pt], every node/.style={font=\\small, inner sep=1pt}]\n\\draw[->] (-0.5, 0) -- (3.5, 0) node[below] {$x$};\n\\draw[->] (0, -1.5) -- (0, 1.5) node[left] {$y$};\n\\node[below left] at (0,0) {$O$};\n\n\\draw[domain=-0.3:3.2, samples=100, smooth, thick, color=blue] plot (\\x, {sin((\\x r) + pi/3 r)});\n\n\\draw (1.57, 0.05) -- (1.57, -0.05) node[below] {$\\frac{2\\pi}{3}$};\n\\node at ({pi/6}, -0.05) {$\\shortmid$};\n\\node[below] at ({pi/6}, -0.05) {$\\frac{\\pi}{6}$};\n\\draw (-0.05, 1) -- (0.05, 1) node[right] {$1$};\n\n\\draw[dashed] ({pi/6}, 0) -- ({pi/6}, 1) -- (0, 1);\n\\node[circle, fill, inner sep=1pt] at ({pi/6}, 1) {};\n\\node[circle, fill, inner sep=1pt] at ({2*pi/3}, 0) {};\n\n% Corrected x-axis tick labels to decimal for pgfplots compatibility\n% x=pi/6 is approx 0.52\n% x=2pi/3 is approx 2.09\n\\draw[dashed] (0.52, 0) -- (0.52, 1) -- (0, 1);\n\\node[circle, fill, inner sep=1pt] at (0.52, 1) {};\n\\node[circle, fill, inner sep=1pt] at (2.09, 0) {};\n\\draw (2.09, 0.05) -- (2.09, -0.05) node[below] {$\\frac{2\\pi}{3}$};\n\\node at (0.52, -0.05) {$\\shortmid$};\n\\node[below] at (0.52, -0.05) {$\\frac{\\pi}{6}$};\n\n\\end{tikzpicture}","knowledgePoints": ["三角函数图像与性质","由y=Asin(ωx+φ)的部分图像确定其解析式","三角函数周期性","三角函数最值","相位变换"],"difficulty": "medium","questionType": "choice","confidence": 1}'''

# 解析 JSON
question = json.loads(raw_json)

print("=== 解析后的 geometryTikz ===")
tikz = question.get("geometryTikz", "")
print(f"长度: {len(tikz)}")
print(f"前200字符:\n{tikz[:200]}")
print(f"\n是否以 \\begin 开头: {tikz.startswith(chr(92) + 'begin')}")

export_service = ExportService()

# 测试编译
print("\n=== 测试 compile_pdf ===")
latex, attachments = export_service.build_single_question_latex(question, include_answer=False)

# 保存 LaTeX
with open("测试用/test_raw.tex", "w") as f:
    f.write(latex)
print(f"LaTeX 已保存 (长度: {len(latex)})")

ok, result, log = export_service.compile_pdf(latex, attachments)

if ok:
    print(f"✅ PDF 编译成功")
    import shutil
    shutil.copy(result, "测试用/test_raw.pdf")
    print("PDF 已保存到 测试用/test_raw.pdf")
    export_service.cleanup_file(result)
else:
    print(f"❌ PDF 编译失败")
    # 找关键错误
    for line in log.split('\n'):
        if '!' in line:
            print(f"  {line}")
