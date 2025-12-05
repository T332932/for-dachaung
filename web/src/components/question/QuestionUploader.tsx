'use client';

import { useState, useCallback, useEffect } from 'react';
import { questionApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileImage, Settings, Loader2, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
        toast.success('提示词已保存');
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
            toast.error('请上传图片文件（JPG、PNG等格式）');
            return;
        }

        // 验证文件大小
        if (file.size > MAX_FILE_SIZE) {
            toast.error('文件大小不能超过 10MB，请压缩后重试');
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
            toast.error(errorMessage);
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
        <div className="w-full max-w-2xl mx-auto space-y-4">
            <Card className="p-1 overflow-hidden">
                <div className="p-4 flex justify-between items-center border-b border-border/50 bg-secondary/20">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                            <Upload className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm">上传题目图片</h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPromptEditor(!showPromptEditor)}
                        className={`h-8 text-xs gap-1.5 ${showPromptEditor ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'}`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        {showPromptEditor ? '收起设置' : 'AI 设置'}
                    </Button>
                </div>

                {/* 提示词编辑器 */}
                {showPromptEditor && (
                    <div className="p-4 bg-secondary/10 border-b border-border/50 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">自定义 AI 提示词</label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetPrompt}
                                    className="h-6 text-xs hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    重置默认
                                </Button>
                            </div>
                            <Textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                className="font-mono text-xs min-h-[120px] resize-y bg-background"
                                placeholder="输入自定义提示词..."
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowPromptEditor(false)} className="h-8">
                                    取消
                                </Button>
                                <Button size="sm" onClick={savePrompt} className="h-8">
                                    保存设置
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 上传区域 */}
                <div className="p-6">
                    <div
                        className={`
                            relative group cursor-pointer
                            flex flex-col items-center justify-center
                            min-h-[240px] rounded-xl border-2 border-dashed transition-all duration-300
                            ${dragActive
                                ? 'border-primary bg-primary/5 scale-[0.99]'
                                : 'border-border hover:border-primary/50 hover:bg-secondary/20'
                            }
                            ${isUploading ? 'pointer-events-none opacity-80' : ''}
                        `}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={handleChange}
                            accept="image/*"
                            disabled={isUploading}
                        />

                        {isUploading ? (
                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                                    <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="font-medium text-foreground">正在智能分析题目...</p>
                                    <p className="text-xs text-muted-foreground">识别文字、公式与几何图形</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 transition-transform duration-300 group-hover:scale-105">
                                <div className={`
                                    p-4 rounded-full transition-colors duration-300
                                    ${dragActive ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}
                                `}>
                                    <FileImage className="w-8 h-8" />
                                </div>
                                <div className="text-center space-y-1.5">
                                    <p className="font-medium text-foreground">
                                        点击或拖拽上传图片
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-[200px]">
                                        支持 JPG, PNG 格式，文件大小不超过 10MB
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
