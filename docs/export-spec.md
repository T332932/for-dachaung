# 导出规范样张（PDF / Word）

目的：统一试卷导出排版，减少后期返工。

## 通用
- 纸张：A4，纵向；页边距 2.5cm（上下），2cm（左右）。
- 字体：中文使用思源黑体/宋体（PDF）；英文字体 Times New Roman；字号 12pt。
- 行距：1.4 倍；段前后 0.5 行。
- 题号与分值：`{序号}. ({分值}分)`，题干后接空格。
- 公式：LaTeX 渲染（PDF）；Word 中使用内嵌公式，字体 Cambria Math，行内基线对齐。
- 图片：默认宽度 9cm，居中；需要标注 caption：“图N 说明”。
- 解析/答案：可选显示，若显示，使用“【答案】”“【解析】”前缀，缩进 2 字。

## PDF (LaTeX)
- 模板：article + ctex + amsmath + tikz。
- 列表：`\begin{enumerate}[leftmargin=0em,label=\arabic*.,itemsep=0.6em]`
- 大题分区：选择题、填空、解答题，可选以 `\section*{}` 分隔。
- 图片：`\includegraphics[width=0.6\textwidth]{path}`；若为 TikZ 直接插入。
- 参考答案页：可选单独附录页，按题号列出答案/解析。

## Word (python-docx)
- 段落样式：
  - 标题：Heading 1，居中。
  - 题目：Normal 样式，字号 12，行距 1.4。
  - 答案/解析：Normal + 缩进 2 字。
- 题号与分值：用 Run 分开，题号加粗，分值括号常规。
- 图片：插入 PNG（若源为 SVG，先转 PNG），宽度 9cm，居中。
- 页眉页脚：可留空；页码居中。

## 示例待办
- 生成一版示例 PDF 和 DOCX，验证中英文、公式、图片、长题干、解析的排版效果。
- 检查：分页、图片断行、公式溢出、长选项换行、目录/分区标题样式。
