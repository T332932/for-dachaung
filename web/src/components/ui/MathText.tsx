'use client';

import React from 'react';

interface MathTextProps {
    children: string;
    className?: string;
}

/**
 * 渲染包含LaTeX公式的文本
 * 支持 $...$ 行内公式和 $$...$$ 块级公式
 */
export function MathText({ children, className = '' }: MathTextProps) {
    const renderMath = (text: string) => {
        if (!text) return null;

        const parts: React.ReactNode[] = [];
        let key = 0;

        // 正则匹配 $$...$$ 块级公式和 $...$ 行内公式
        const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // 添加公式前的普通文本
            if (match.index > lastIndex) {
                parts.push(
                    <span key={key++}>{text.slice(lastIndex, match.index)}</span>
                );
            }

            const formula = match[0];
            const isBlock = formula.startsWith('$$');
            const latex = isBlock
                ? formula.slice(2, -2).trim()
                : formula.slice(1, -1).trim();

            // 渲染公式 - 使用CSS类来样式化
            if (isBlock) {
                parts.push(
                    <div key={key++} className="my-2 text-center font-mono text-blue-700 bg-blue-50 p-2 rounded overflow-x-auto">
                        {latex}
                    </div>
                );
            } else {
                parts.push(
                    <span key={key++} className="font-mono text-blue-700 bg-blue-50 px-1 rounded">
                        {latex}
                    </span>
                );
            }

            lastIndex = regex.lastIndex;
        }

        // 添加最后剩余的文本
        if (lastIndex < text.length) {
            parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
        }

        return parts;
    };

    return (
        <div className={`whitespace-pre-wrap ${className}`}>
            {renderMath(children)}
        </div>
    );
}

export default MathText;
