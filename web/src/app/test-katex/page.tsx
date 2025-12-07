'use client';

import { MathText } from '@/components/ui/MathText';

// 这是 AI 返回的真实数据
const testData = {
    questionText: "10. 下图是函数 $y = \\sin(\\omega x + \\phi)$ 的部分图像，则 $\\sin(\\omega x + \\phi)=$\n\n![函数图像](...) \n",
    options: [
        "A. $\\sin(x + \\frac{\\pi}{3})$",
        "B. $\\sin(\\frac{\\pi}{3} - 2x)$",
        "C. $\\cos(2x + \\frac{\\pi}{6})$",
        "D. $\\cos(\\frac{5\\pi}{6} - 2x)$"
    ],
    answer: "### 解题步骤：\n\n1.  **确定角频率 $\\omega$**\n    根据函数图像，函数在 $x = \\frac{\\pi}{6}$ 和 $x = \\frac{2\\pi}{3}$ 处连续两次穿过 x 轴。"
};

export default function TestKatexPage() {
    return (
        <div className="min-h-screen bg-background p-8">
            <h1 className="text-2xl font-bold mb-6">KaTeX 渲染测试（ReactMarkdown + rehype-katex）</h1>

            <div className="space-y-6">
                <div className="p-4 border rounded-lg">
                    <h2 className="font-semibold text-primary mb-2">题干</h2>
                    <MathText>{testData.questionText}</MathText>
                </div>

                <div className="p-4 border rounded-lg">
                    <h2 className="font-semibold text-primary mb-2">选项</h2>
                    <div className="space-y-2">
                        {testData.options.map((opt, idx) => (
                            <div key={idx} className="p-2 bg-secondary/20 rounded">
                                <MathText>{opt}</MathText>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border rounded-lg">
                    <h2 className="font-semibold text-primary mb-2">答案片段</h2>
                    <MathText>{testData.answer}</MathText>
                </div>

                <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                    <h2 className="font-semibold mb-2">原始数据（调试用）</h2>
                    <pre className="text-xs overflow-auto p-2 bg-black/10 rounded">
                        {JSON.stringify(testData, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}
