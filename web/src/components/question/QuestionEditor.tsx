'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { questionApi, QuestionPayload } from '@/lib/api-client';
import { QuestionAnalysisResult } from './QuestionUploader';

interface QuestionEditorProps {
    initialData: QuestionAnalysisResult;
    onSave: (savedData: QuestionAnalysisResult) => void;
    onCancel: () => void;
}

export function QuestionEditor({ initialData, onSave, onCancel }: QuestionEditorProps) {
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            // 将解析结果直接入库，不提供前端编辑
            const payload: QuestionPayload = {
                questionText: initialData.questionText || '',
                options: initialData.options || null,
                answer: initialData.answer || '',
                explanation: undefined,
                hasGeometry: Boolean(initialData.hasGeometry),
                geometrySvg: initialData.geometrySvg || null,
                geometryTikz: null,
                knowledgePoints: initialData.knowledgePoints || [],
                difficulty: initialData.difficulty || 'medium',
                questionType: initialData.questionType || 'solve',
                source: undefined,
                year: undefined,
                aiGenerated: true,
            };
            await questionApi.create(payload);
            onSave(initialData);
        } catch (error) {
            console.error('Save failed:', error);
            alert('保存失败');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-lg font-semibold">题目预览</h3>
                <div className="space-x-2">
                    <Button variant="ghost" onClick={onCancel}>重新上传</Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? '入库中...' : '确认入库'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 几何图形预览 */}
                {initialData?.hasGeometry && initialData?.geometrySvg && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">📐 几何图形 (AI生成)</label>
                        <div
                            className="border rounded-md p-4 bg-white flex justify-center overflow-auto max-h-[320px]"
                            dangerouslySetInnerHTML={{ __html: initialData.geometrySvg }}
                        />
                    </div>
                )}

                {/* 题干展示 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">📝 题目内容</label>
                    <div className="w-full min-h-[150px] p-3 border rounded-md bg-gray-50 font-mono text-sm whitespace-pre-wrap">
                        {initialData?.questionText || '（无内容）'}
                    </div>
                </div>

                {/* 选项（选择题） */}
                {initialData?.options && initialData.options.length > 0 && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">🔘 选项</label>
                        <div className="space-y-2 p-3 border rounded-md bg-gray-50">
                            {initialData.options.map((opt: string, idx: number) => (
                                <div key={idx} className="text-sm">{opt}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 答案展示 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">✅ 答案与解析</label>
                    <div className="w-full min-h-[200px] p-3 border rounded-md bg-gray-50 font-mono text-sm whitespace-pre-wrap">
                        {initialData?.answer || '（无答案）'}
                    </div>
                </div>

                {/* 知识点 */}
                {initialData?.knowledgePoints && initialData.knowledgePoints.length > 0 && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">🎯 知识点</label>
                        <div className="flex flex-wrap gap-2">
                            {initialData.knowledgePoints.map((kp: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                                    {kp}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 属性展示 */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">难度</label>
                        <div className="mt-1 px-3 py-2 border rounded-md bg-gray-50 text-sm">
                            {initialData?.difficulty || 'unknown'}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">题型</label>
                        <div className="mt-1 px-3 py-2 border rounded-md bg-gray-50 text-sm">
                            {initialData?.questionType || 'unknown'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
