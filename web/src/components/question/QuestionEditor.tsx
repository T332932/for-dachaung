'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { questionApi, QuestionPayload } from '@/lib/api-client';
import { QuestionAnalysisResult } from './QuestionUploader';
import { MathText } from '@/components/ui/MathText';

interface QuestionEditorProps {
    initialData: QuestionAnalysisResult;
    file: File | null;
    onSave: (savedData: QuestionAnalysisResult) => void;
    onCancel: () => void;
}

export function QuestionEditor({ initialData, file, onSave, onCancel }: QuestionEditorProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [questionText, setQuestionText] = useState(initialData.questionText || '');
    const [answer, setAnswer] = useState(initialData.answer || '');
    const [optionsText, setOptionsText] = useState(
        Array.isArray(initialData.options) ? initialData.options.join('\n') : ''
    );
    const [knowledgeText, setKnowledgeText] = useState(
        Array.isArray(initialData.knowledgePoints) ? initialData.knowledgePoints.join(',') : ''
    );
    const [difficulty, setDifficulty] = useState(initialData.difficulty || 'medium');
    const [questionType, setQuestionType] = useState(initialData.questionType || 'solve');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    // 组件挂载/卸载状态管理
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            // 清理定时器
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleSubmit = async () => {
        // 防止重复提交
        if (isSaving) {
            return;
        }

        // 验证必填字段
        if (!questionText.trim()) {
            alert('题目内容不能为空，请重新上传');
            return;
        }
        if (!answer.trim()) {
            alert('答案不能为空，请重新上传');
            return;
        }

        setIsSaving(true);
        try {
            // 定义有效的枚举值
            const validDifficulties = ['easy', 'medium', 'hard'] as const;
            const validQuestionTypes = ['choice', 'fillblank', 'solve', 'proof'] as const;

            // 类型守卫函数
            const isValidDifficulty = (val: any): val is typeof validDifficulties[number] => {
                return typeof val === 'string' && validDifficulties.includes(val as any);
            };

            const isValidQuestionType = (val: any): val is typeof validQuestionTypes[number] => {
                return typeof val === 'string' && validQuestionTypes.includes(val as any);
            };

            // 处理选项：确保是数组或null
            let processedOptions: string[] | null = null;
            const optionLines = optionsText
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            processedOptions = optionLines.length > 0 ? optionLines : null;

            // 处理知识点：确保是数组
            const kpList = knowledgeText
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            const processedKnowledgePoints: string[] = kpList;

            const payload: QuestionPayload = {
                questionText: questionText.trim(),
                options: processedOptions,
                answer: answer.trim(),
                explanation: undefined,
                hasGeometry: Boolean(initialData.hasGeometry),
                geometrySvg: initialData.geometrySvg || null,
                geometryTikz: null,
                knowledgePoints: processedKnowledgePoints,
                difficulty: isValidDifficulty(difficulty) ? difficulty : 'medium',
                questionType: isValidQuestionType(questionType) ? questionType : 'solve',
                source: undefined,
                year: undefined,
                aiGenerated: true,
            };

            await questionApi.create(payload);

            // 检查组件是否仍然挂载
            if (isMountedRef.current) {
                onSave({
                    ...initialData,
                    questionText: payload.questionText,
                    answer: payload.answer,
                    options: payload.options || undefined,
                    knowledgePoints: payload.knowledgePoints,
                    difficulty: payload.difficulty,
                    questionType: payload.questionType,
                });
            }
        } catch (error: any) {
            // 只在组件仍然挂载时显示错误
            if (isMountedRef.current) {
                console.error('Save failed:', error);
                const errorMessage = error?.userMessage || error?.response?.data?.detail || error?.message || '保存失败，请重试';
                alert(errorMessage);
            }
        } finally {
            // 只在组件仍然挂载时更新状态
            if (isMountedRef.current) {
                setIsSaving(false);
            }
        }
    };

    const handleDownloadPdf = async () => {
        // 防止重复下载
        if (isDownloading) {
            return;
        }

        if (!file) {
            alert('缺少原始文件，无法生成 PDF 预览，请重新上传。');
            return;
        }
        setIsDownloading(true);
        let blobUrl: string | null = null;
        try {
            const blob = await questionApi.previewPdf(file, { includeAnswer: true, includeExplanation: false });

            // 检查组件是否仍然挂载
            if (!isMountedRef.current) {
                return;
            }

            if (!(blob instanceof Blob) || blob.size === 0) {
                throw new Error('PDF生成失败：返回的数据无效');
            }
            blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = 'question_preview.pdf';
            document.body.appendChild(link);
            link.click();
            link.remove();
            // 延迟清理 URL，确保下载已开始
            timeoutRef.current = setTimeout(() => {
                if (blobUrl && isMountedRef.current) {
                    window.URL.revokeObjectURL(blobUrl);
                }
                timeoutRef.current = null;
            }, 100);
        } catch (error: any) {
            // 只在组件仍然挂载时处理错误
            if (!isMountedRef.current) {
                return;
            }

            console.error('PDF preview failed:', error);
            // 清理可能创建的 URL 和定时器
            if (blobUrl) {
                window.URL.revokeObjectURL(blobUrl);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            // 尝试读取后端错误
            const respData = error?.response?.data;
            let errorMessage = 'PDF 预览失败';

            if (respData instanceof Blob) {
                try {
                    // 克隆 Blob 以避免消耗原始 Blob
                    const clonedBlob = respData.slice();
                    const text = await clonedBlob.text();
                    const json = JSON.parse(text);
                    errorMessage = `PDF 预览失败：${json.detail || json.error || '未知错误'}`;
                } catch {
                    errorMessage = error?.userMessage || 'PDF 预览失败，请确认后端已安装 pdflatex';
                }
            } else {
                errorMessage = error?.userMessage || 'PDF 预览失败，请确认后端已安装 pdflatex';
            }

            alert(errorMessage);
        } finally {
            // 只在组件仍然挂载时更新状态
            if (isMountedRef.current) {
                setIsDownloading(false);
            }
        }
    };

    return (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-lg font-semibold">题目预览</h3>
                <div className="space-x-2">
                    <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading || !file}>
                        {isDownloading ? '生成中...' : '下载 PDF 预览'}
                    </Button>
                    <Button variant="ghost" onClick={onCancel}>重新上传</Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? '入库中...' : '确认入库'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 几何图形预览 */}
                {initialData?.hasGeometry && ((typeof initialData?.svgPng === 'string' && initialData.svgPng.startsWith('data:image')) || initialData?.geometrySvg) && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">📐 几何图形 (AI生成)</label>
                        <div className="border rounded-md p-4 bg-white flex justify-center overflow-auto max-h-[320px]">
                            {initialData.svgPng && initialData.svgPng.startsWith('data:image') ? (
                                <img
                                    src={initialData.svgPng}
                                    alt="geometry preview"
                                    className="max-h-[280px]"
                                    onError={(e) => {
                                        console.error('Image load failed:', e);
                                        // 如果图片加载失败，尝试显示 SVG
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div
                                    className="w-full"
                                    dangerouslySetInnerHTML={{ __html: initialData.geometrySvg || '' }}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* 题干展示 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">📝 题目内容</label>
                    <textarea
                        className="w-full min-h-[120px] p-3 border rounded-md text-sm"
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Markdown + LaTeX，支持 $...$ 或 $$...$$"
                    />
                    <div className="w-full min-h-[120px] p-3 border rounded-md bg-gray-50 text-sm">
                        <MathText>{questionText || '（无内容）'}</MathText>
                    </div>
                </div>

                {/* 选项（选择题） */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">🔘 选项（每行一个，空则视为无选项）</label>
                    <textarea
                        className="w-full min-h-[100px] p-3 border rounded-md text-sm"
                        value={optionsText}
                        onChange={(e) => setOptionsText(e.target.value)}
                        placeholder="A. ...\nB. ..."
                    />
                    {optionsText.trim() && (
                        <div className="space-y-2 p-3 border rounded-md bg-gray-50">
                            {optionsText
                                .split('\n')
                                .map((opt) => opt.trim())
                                .filter((opt) => opt.length > 0)
                                .map((opt, idx) => (
                                    <div key={idx} className="text-sm"><MathText>{opt}</MathText></div>
                                ))}
                        </div>
                    )}
                </div>

                {/* 答案展示 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">✅ 答案与解析</label>
                    <textarea
                        className="w-full min-h-[150px] p-3 border rounded-md text-sm"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="答案/解析，支持 Markdown + LaTeX"
                    />
                    <div className="w-full min-h-[150px] p-3 border rounded-md bg-gray-50 text-sm">
                        <MathText>{answer || '（无答案）'}</MathText>
                    </div>
                </div>

                {/* 知识点 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">🎯 知识点（用逗号分隔）</label>
                    <input
                        className="w-full p-3 border rounded-md text-sm"
                        value={knowledgeText}
                        onChange={(e) => setKnowledgeText(e.target.value)}
                        placeholder="函数, 导数"
                    />
                    {knowledgeText.trim() && (
                        <div className="flex flex-wrap gap-2">
                            {knowledgeText
                                .split(',')
                                .map((kp) => kp.trim())
                                .filter((kp) => kp.length > 0)
                                .map((kp, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                                        {kp}
                                    </span>
                                ))}
                        </div>
                    )}
                </div>

                {/* 属性展示 */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">难度</label>
                        <select
                            className="mt-1 w-full px-3 py-2 border rounded-md bg-white text-sm"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                        >
                            <option value="easy">easy</option>
                            <option value="medium">medium</option>
                            <option value="hard">hard</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">题型</label>
                        <select
                            className="mt-1 w-full px-3 py-2 border rounded-md bg-white text-sm"
                            value={questionType}
                            onChange={(e) => setQuestionType(e.target.value)}
                        >
                            <option value="choice">choice</option>
                            <option value="multi">multi</option>
                            <option value="fillblank">fillblank</option>
                            <option value="solve">solve</option>
                            <option value="proof">proof</option>
                        </select>
                    </div>
                </div>

                {/* LaTeX 预览 */}
                {initialData?.latex && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">🧪 LaTeX 源码（单题）</label>
                        <pre className="w-full p-3 border rounded-md bg-gray-50 text-xs overflow-auto max-h-[240px] whitespace-pre-wrap">
                            {initialData.latex}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
