'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { questionApi, QuestionPayload } from '@/lib/api-client';
import { QuestionAnalysisResult } from './QuestionUploader';
import { MathText } from '@/components/ui/MathText';
import { Save, Download, RotateCcw, Eye, Edit3, AlertTriangle, CheckCircle2, X } from 'lucide-react';

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
    const [isPublic, setIsPublic] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleSubmit = async () => {
        if (isSaving) return;
        if (!questionText.trim()) {
            alert('题目内容不能为空');
            return;
        }
        if (!answer.trim()) {
            alert('答案不能为空');
            return;
        }

        setIsSaving(true);
        try {
            const validDifficulties = ['easy', 'medium', 'hard'] as const;
            const validQuestionTypes = ['choice', 'fillblank', 'solve', 'proof'] as const;

            const isValidDifficulty = (val: any): val is typeof validDifficulties[number] =>
                typeof val === 'string' && validDifficulties.includes(val as any);

            const isValidQuestionType = (val: any): val is typeof validQuestionTypes[number] =>
                typeof val === 'string' && validQuestionTypes.includes(val as any);

            const processedOptions = optionsText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
            const processedKnowledgePoints = knowledgeText.split(',').map(s => s.trim()).filter(s => s.length > 0);

            const payload: QuestionPayload = {
                questionText: questionText.trim(),
                options: processedOptions.length > 0 ? processedOptions : null,
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
                isPublic: isPublic,
            };

            await questionApi.create(payload);

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
            if (isMountedRef.current) {
                console.error('Save failed:', error);
                const errorMessage = error?.userMessage || error?.response?.data?.detail || error?.message || '保存失败，请重试';
                alert(errorMessage);
            }
        } finally {
            if (isMountedRef.current) setIsSaving(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (isDownloading) return;
        if (!file) {
            alert('缺少原始文件，无法生成 PDF 预览');
            return;
        }
        setIsDownloading(true);
        let blobUrl: string | null = null;
        try {
            const blob = await questionApi.previewPdf(file, { includeAnswer: true, includeExplanation: false });
            if (!isMountedRef.current) return;

            if (!(blob instanceof Blob) || blob.size === 0) throw new Error('PDF生成失败');

            blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = 'question_preview.pdf';
            document.body.appendChild(link);
            link.click();
            link.remove();

            timeoutRef.current = setTimeout(() => {
                if (blobUrl && isMountedRef.current) window.URL.revokeObjectURL(blobUrl);
                timeoutRef.current = null;
            }, 100);
        } catch (error: any) {
            if (!isMountedRef.current) return;
            console.error('PDF preview failed:', error);
            if (blobUrl) window.URL.revokeObjectURL(blobUrl);
            alert(error?.userMessage || 'PDF 预览失败');
        } finally {
            if (isMountedRef.current) setIsDownloading(false);
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-6">
            {/* 左侧：预览区域 */}
            <Card className="flex-1 flex flex-col overflow-hidden bg-secondary/10 border-border/50">
                <div className="p-4 border-b border-border/50 bg-background/50 backdrop-blur flex justify-between items-center shrink-0">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Eye className="w-4 h-4 text-primary" />
                        实时预览
                    </h3>
                    <div className="flex items-center gap-2">
                        {initialData.similarQuestions && initialData.similarQuestions.length > 0 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {initialData.similarQuestions.length} 相似题
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 相似题警告 */}
                    {initialData.similarQuestions && initialData.similarQuestions.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-in slide-in-from-top-2">
                            <h4 className="font-medium text-amber-800 mb-2 text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                题库中已存在高度相似的题目
                            </h4>
                            <div className="space-y-2 pl-6">
                                {initialData.similarQuestions.map((sq) => (
                                    <div key={sq.id} className="text-xs text-amber-900/80 bg-white/50 p-2 rounded border border-amber-100">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-medium">相似度: {Math.round(sq.similarity * 100)}%</span>
                                            <span className="opacity-70">ID: {sq.id.slice(0, 8)}</span>
                                        </div>
                                        <p className="line-clamp-2 opacity-80">{sq.questionText}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 几何图形 */}
                    {initialData?.hasGeometry && ((typeof initialData?.svgPng === 'string' && initialData.svgPng.startsWith('data:image')) || initialData?.geometrySvg) && (
                        <div className="flex justify-center p-4 bg-white rounded-xl border border-border shadow-sm">
                            {initialData.svgPng && initialData.svgPng.startsWith('data:image') ? (
                                <img
                                    src={initialData.svgPng}
                                    alt="geometry preview"
                                    className="max-h-[200px] object-contain"
                                />
                            ) : (
                                <div
                                    className="w-full max-w-[300px]"
                                    dangerouslySetInnerHTML={{ __html: initialData.geometrySvg || '' }}
                                />
                            )}
                        </div>
                    )}

                    {/* 题目预览 */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
                            <div className="prose prose-sm max-w-none">
                                <MathText>{questionText || '<span class="text-gray-400 italic">题目内容为空...</span>'}</MathText>
                            </div>

                            {optionsText.trim() && (
                                <div className="mt-4 space-y-2">
                                    {optionsText.split('\n').filter(o => o.trim()).map((opt, idx) => (
                                        <div key={idx} className="text-sm pl-4 border-l-2 border-primary/20">
                                            <MathText>{opt}</MathText>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-emerald-50/50 rounded-xl p-6 shadow-sm border border-emerald-100">
                            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">Answer & Explanation</h4>
                            <div className="prose prose-sm max-w-none text-emerald-900/80">
                                <MathText>{answer || '<span class="text-gray-400 italic">暂无答案...</span>'}</MathText>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* 右侧：编辑区域 */}
            <Card className="flex-1 flex flex-col overflow-hidden border-border shadow-lg">
                <div className="p-4 border-b border-border bg-background flex justify-between items-center shrink-0">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-primary" />
                        编辑内容
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 text-muted-foreground">
                            <X className="w-4 h-4 mr-1" /> 取消
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSaving} size="sm" className="h-8 gap-1.5">
                            {isSaving ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isSaving ? '入库中...' : '确认入库'}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">难度</label>
                            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                <option value="easy">简单</option>
                                <option value="medium">中等</option>
                                <option value="hard">困难</option>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">题型</label>
                            <Select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                                <option value="choice">选择题</option>
                                <option value="multi">多选题</option>
                                <option value="fillblank">填空题</option>
                                <option value="solve">解答题</option>
                                <option value="proof">证明题</option>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">题目内容 (Markdown + LaTeX)</label>
                        <Textarea
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            className="font-mono text-sm min-h-[120px] resize-y"
                            placeholder="支持 $...$ 或 $$...$$"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">选项 (每行一个)</label>
                        <Textarea
                            value={optionsText}
                            onChange={(e) => setOptionsText(e.target.value)}
                            className="font-mono text-sm min-h-[80px] resize-y"
                            placeholder="A. 选项内容..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">答案与解析</label>
                        <Textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            className="font-mono text-sm min-h-[120px] resize-y"
                            placeholder="输入详细解析..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">知识点 (逗号分隔)</label>
                        <Input
                            value={knowledgeText}
                            onChange={(e) => setKnowledgeText(e.target.value)}
                            placeholder="函数, 导数, 极值"
                        />
                        {knowledgeText.trim() && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {knowledgeText.split(',').filter(k => k.trim()).map((k, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded-md">
                                        {k.trim()}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-border flex justify-between items-center">
                        <label className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                                className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                            />
                            <span>公开到题库</span>
                        </label>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={isDownloading || !file}
                            className="text-xs h-8"
                        >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            {isDownloading ? '生成中...' : '下载 PDF 预览'}
                        </Button>
                    </div>

                    {initialData?.latex && (
                        <div className="pt-4 border-t border-border space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">原始 LaTeX</label>
                            <pre className="p-3 bg-secondary/30 rounded-lg text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-[100px]">
                                {initialData.latex}
                            </pre>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
