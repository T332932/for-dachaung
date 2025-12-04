'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { questionApi } from '@/lib/api-client';

interface QuestionEditorProps {
    initialData: any;
    onSave: (savedData: any) => void;
    onCancel: () => void;
}

export function QuestionEditor({ initialData, onSave, onCancel }: QuestionEditorProps) {
    const [formData, setFormData] = useState(initialData);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData(initialData);
    }, [initialData]);

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            // 这里将来会调用后端保存接口
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
                {/* 题干编辑 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">题目内容</label>
                    <textarea
                        className="w-full min-h-[150px] p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.questionText || ''}
                        onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                        placeholder="支持 Markdown 和 LaTeX 公式..."
                    />
                </div>

                {/* 答案编辑 */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">答案与解析</label>
                    <textarea
                        className="w-full min-h-[100px] p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.answer || ''}
                        onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                        placeholder="输入标准答案..."
                    />
                </div>

                {/* 属性编辑 */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">难度</label>
                        <select
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={formData.difficulty || 'medium'}
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
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={formData.questionType || 'solve'}
                            onChange={(e) => setFormData({ ...formData, questionType: e.target.value })}
                        >
                            <option value="choice">选择题</option>
                            <option value="fillblank">填空题</option>
                            <option value="solve">解答题</option>
                        </select>
                    </div>
                </div>

                {/* 几何图形预览 (如果有) */}
                {formData.hasGeometry && formData.geometrySvg && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">几何图形 (AI生成)</label>
                        <div
                            className="border rounded-md p-4 bg-gray-50 flex justify-center"
                            dangerouslySetInnerHTML={{ __html: formData.geometrySvg }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
