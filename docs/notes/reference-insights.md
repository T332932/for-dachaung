# 参考项目要点摘录（备查）

目标：删除参考代码前，保留可复用思路/提示词。

- 文档转换管线：Pandoc 提取 docx → markdown + media，后续再做分章、模板套壳。
- LLM 提示模式：
  - 章节识别：输出 `{"sections": [...]}` 的 JSON，避免摘要/参考文献。
  - 章节抽取：system 里指定“提取完整章节内容，包含公式/图/表”。
  - 模板清洗：让模型保留 preamble 与图片/表格示例，剥离正文。
  - LaTeX 生成：在 system 塞模板；章节内容用 markdown 输入，输出以 `\section` 开始；图片引用直接插入，双栏/单栏按大小；引用用 `\cite{N}`。
  - 主文件生成：提取标题/作者/单位，正文处用 `\input{Section}` 插入；bib 只引用，不转换。
- bib 抓取流程：从参考文献文本提取标题列表 → 逐条访问 Scholar/DBLP 拿 BibTeX → 对 bib 的 cite key 统一改为序号并写出 `bibtex.bib`、`cite` 清单。
- 常见坑：
  - 步骤开关命名不一致（step_5 → step5）导致 KeyError。
  - llm 调用参数顺序反了（system 与 user）。
  - 依赖 Pandoc、openai、requests、lxml；Scholar 需要 Cookie/代理。
  - LaTeX 编译易失败：特殊字符转义、图片路径、bib 引用缺失。
