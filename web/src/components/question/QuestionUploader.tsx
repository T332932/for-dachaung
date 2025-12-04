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

// 文件大小限制常量
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 验证文件是否为图片
const isValidImageFile = (file: File): boolean => {
    // 检查文件类型
    if (!file.type || !file.type.startsWith('image/')) {
        return false;
    }
    // 检查文件扩展名作为备用验证（某些浏览器可能type为空）
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return validExtensions.some(ext => fileName.endsWith(ext));
};

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
        // 防止竞态条件：如果正在上传，直接返回
        if (isUploading) {
            return;
        }
        
        // 验证文件类型
        if (!isValidImageFile(file)) {
            alert('请上传图片文件（JPG、PNG等格式）');
            return;
        }
        
        // 验证文件大小
        if (file.size > MAX_FILE_SIZE) {
            alert('文件大小不能超过 10MB，请压缩后重试');
            return;
        }
        
        setIsUploading(true);
        try {
            const result = await questionApi.preview(file);
            
            // 检查返回结构
            if (!result) {
                throw new Error('API返回数据为空');
            }
            
            // 优先使用 analysis 字段，如果没有则使用 result 本身
            const analysisData = result.analysis || result;
            if (!analysisData || (typeof analysisData !== 'object')) {
                throw new Error('API返回数据格式错误');
            }
            
            const merged: QuestionAnalysisResult = {
                ...analysisData,
                svgPng: result?.svgPng || null,
                latex: result?.latex,
            };
            
            // 验证必要字段
            if (!merged.questionText?.trim() && !merged.answer?.trim()) {
                throw new Error('AI返回数据不完整：缺少题目内容或答案');
            }
            
            onAnalyzed(merged, file);
        } catch (error: any) {
            console.error('Analysis failed:', error);
            const errorMessage = error?.userMessage || error?.message || '题目识别失败，请重试';
            alert(errorMessage);
        } finally {
            setIsUploading(false);
        }
    }, [onAnalyzed, isUploading]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            // 验证文件类型
            if (!isValidImageFile(file)) {
                alert('请拖拽图片文件（JPG、PNG等格式）');
                return;
            }
            // 验证文件大小
            if (file.size > MAX_FILE_SIZE) {
                alert('文件大小不能超过 10MB，请压缩后重试');
                return;
            }
            await handleFile(file);
        }
    }, [handleFile]);

    const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            await handleFile(e.target.files[0]);
            // 允许再次选择同一文件
            e.target.value = '';
        }
    }, [handleFile]);

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
