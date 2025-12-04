'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { questionApi, QuestionPayload } from '@/lib/api-client';

interface QuestionEditorProps {
    initialData: QuestionPayload;
    onSave: (savedData: QuestionPayload) => void;
    onCancel: () => void;
}

export function QuestionEditor({ initialData, onSave, onCancel }: QuestionEditorProps) {
    const [formData, setFormData] = useState<QuestionPayload>(initialData);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        console.log('QuestionEditor received data:', initialData);
        setFormData(initialData);
    }, [initialData]);

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            const result = await questionApi.create(formData);
            onSave(result);
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
                <h3 className="text-lg font-semibold">编辑题目</h3>
                <div className="space-x-2">
                    <Button variant="ghost" onClick={onCancel}>取消</Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? '保存中...' : '确认入库'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 几何图形预览 (如果有) - 放在最上面 */}
                {formData?.hasGeometry && formData?.geometrySvg && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">📐 几何图形 (AI生成)</label>
                        <div
                            className="border rounded-md p-4 bg-gray-50 flex justify-center"
                            dangerouslySetInnerHTML={{ __html: formData.geometrySvg }}
                        />
                    </div>
                )}

                {/* 题干编辑 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">📝 题目内容</label>
                    <textarea
                        className="w-full min-h-[150px] p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        value={formData?.questionText || ''}
                        onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                        placeholder="支持 Markdown 和 LaTeX 公式..."
                    />
                </div>

                {/* 选项（选择题） */}
                {formData?.options && formData.options.length > 0 && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">🔘 选项</label>
                        <div className="space-y-2 p-3 border rounded-md bg-gray-50">
                            {formData.options.map((opt: string, idx: number) => (
                                <div key={idx} className="text-sm">{opt}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 答案编辑 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">✅ 答案与解析</label>
                    <textarea
                        className="w-full min-h-[200px] p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        value={formData?.answer || ''}
                        onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                        placeholder="输入标准答案..."
                    />
                </div>

                {/* 知识点 */}
                {formData?.knowledgePoints && formData.knowledgePoints.length > 0 && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">🎯 知识点</label>
                        <div className="flex flex-wrap gap-2">
                            {formData.knowledgePoints.map((kp: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                                    {kp}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 属性编辑 */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">难度</label>
                        <select
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                            value={formData?.difficulty || 'medium'}
                            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                        >
                            <option value="easy">简单</option>
                            <option value="medium">中等</option>
                            <option value="hard">困难</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">题型</label>
                        <select
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                            value={formData?.questionType || 'solve'}
                            onChange={(e) => setFormData({ ...formData, questionType: e.target.value })}
                        >
                            <option value="choice">选择题</option>
                            <option value="fillblank">填空题</option>
                            <option value="solve">解答题</option>
                            <option value="proof">证明题</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">AI置信度</label>
                        <div className="mt-1 px-3 py-2 bg-gray-100 rounded-md text-sm">
                            {formData?.confidence ? `${(formData.confidence * 100).toFixed(0)}%` : 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
