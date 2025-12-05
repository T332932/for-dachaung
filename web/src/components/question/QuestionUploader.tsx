'use client';

import { useState, useCallback, useEffect } from 'react';
import { questionApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export interface SimilarQuestion {
    id: string;
    questionText: string;
    similarity: number;
    difficulty?: string;
}

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
    similarQuestions?: SimilarQuestion[];  // 相似题列表
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

// 默认提示词
const DEFAULT_PROMPT = `重要：questionText 只包含题干和选项，不要包含任何答案或解析；答案与解题步骤只放在 answer 字段。
SVG 生成要求：
- 使用 <line>, <circle>, <ellipse>, <path>, <text> 标签
- 虚线用 stroke-dasharray="5,5"
- 文本标注用 <text> 标签，内容为数学符号
- viewBox="0 0 400 400"，坐标准确`;

export function QuestionUploader({ onAnalyzed }: { onAnalyzed: (data: QuestionAnalysisResult, file: File) => void }) {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT);

    // 尝试从localStorage加载保存的提示词
    useEffect(() => {
        const saved = localStorage.getItem('zujuan_custom_prompt');
        if (saved) {
            setCustomPrompt(saved);
        }
    }, []);

    // 保存提示词到localStorage
    const savePrompt = () => {
        localStorage.setItem('zujuan_custom_prompt', customPrompt);
        setShowPromptEditor(false);
        alert('提示词已保存');
    };

    // 重置为默认提示词
    const resetPrompt = () => {
        setCustomPrompt(DEFAULT_PROMPT);
        localStorage.removeItem('zujuan_custom_prompt');
    };

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
            // 使用自定义提示词（如果与默认不同）
            const promptToUse = customPrompt !== DEFAULT_PROMPT ? customPrompt : undefined;
            const result = await questionApi.preview(file, { customPrompt: promptToUse });

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
                similarQuestions: result?.similarQuestions || [],
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
    }, [onAnalyzed, isUploading, customPrompt]);

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
        <div className="w-full max-w-xl mx-auto space-y-4">
            {/* 提示词设置按钮 */}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPromptEditor(!showPromptEditor)}
                    className="text-gray-500 hover:text-gray-700"
                >
                    ⚙️ {showPromptEditor ? '收起设置' : 'AI提示词设置'}
                </Button>
            </div>

            {/* 提示词编辑器 */}
            {showPromptEditor && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">自定义AI提示词</label>
                        <Button variant="ghost" size="sm" onClick={resetPrompt}>
                            重置为默认
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                        提示词会影响AI如何解析和理解题目。JSON格式要求是固定的，这里只修改附加说明部分。
                    </p>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="w-full h-40 p-3 text-sm border rounded-md font-mono resize-y"
                        placeholder="输入自定义提示词..."
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowPromptEditor(false)}>
                            取消
                        </Button>
                        <Button size="sm" onClick={savePrompt}>
                            保存提示词
                        </Button>
                    </div>
                </div>
            )}

            {/* 上传区域 */}
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
