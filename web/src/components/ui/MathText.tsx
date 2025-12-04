'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MathTextProps {
    children: string;
    className?: string;
}

/**
 * 基于 ReactMarkdown + KaTeX 渲染 Markdown/LaTeX。
 * 支持 $...$ 行内公式和 $$...$$ 块级公式。
 */
export function MathText({ children, className = '' }: MathTextProps) {
    const content = children || '';
    return (
        <div className={`prose max-w-none whitespace-pre-wrap ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export default MathText;
