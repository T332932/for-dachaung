'use client';

import { useState, useCallback } from 'react';
import { questionApi } from '@/lib/api-client';

export interface QuestionAnalysisResult {
    questionText?: string;
    options?: string[] | null;
    answer?: string;
    hasGeometry?: boolean;
    geometrySvg?: string | null;
    svgPng?: string | null;
    latex?: string;
    knowledgePoints?: string[];
    difficulty?: string | null;
    questionType?: string | null;
    confidence?: number | null;
}

export function QuestionUploader({ onAnalyzed }: { onAnalyzed: (data: QuestionAnalysisResult, file: File) => void }) {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const { clientX: x, clientY: y } = e;
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                setDragActive(false);
            }
        }
    }, []);

    const handleFile = useCallback(async (file: File) => {
        setIsUploading(true);
        try {
            const result = await questionApi.preview(file) as any;
            const merged: QuestionAnalysisResult = {
                ...(result?.analysis || {}),
                svgPng: result?.svgPng || null,
                latex: result?.latex,
            };
            if (!merged.questionText?.trim() && !merged.answer?.trim()) {
                throw new Error('AI 返回数据不完整');
            }
            onAnalyzed(merged, file);
        } catch (error) {
            console.error('Analysis failed:', error);
            alert('题目识别失败，请重试');
        } finally {
            setIsUploading(false);
        }
    }, [onAnalyzed]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            await handleFile(e.target.files[0]);
            // 允许再次选择同一文件
            e.target.value = '';
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto">
            <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleChange}
                    accept="image/*"
                    disabled={isUploading}
                />

                <div className="space-y-2">
                    {isUploading ? (
                        <div className="text-blue-600">
                            <p className="font-medium">正在AI分析题目...</p>
                            <p className="text-sm text-gray-500">识别文字、公式与几何图形</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-lg font-medium text-gray-700">
                                点击或拖拽上传题目图片
                            </p>
                            <p className="text-sm text-gray-500">
                                支持 JPG, PNG 格式
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
