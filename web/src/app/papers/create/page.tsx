'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { questionApi, paperApi } from '@/lib/api-client';
import { MathText } from '@/components/ui/MathText';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, Plus, Trash2, ArrowUp, ArrowDown, Save, FileText, Clock, Calculator, BookOpen, LayoutTemplate } from 'lucide-react';

interface Question {
    id: string;
    questionText: string;
    answer: string;
    difficulty: string;
    questionType: string;
    knowledgePoints: string[];
    similarity?: number;
}

interface SelectedQuestion extends Question {
    score: number;
    order: number;
}

// 模板定义
const TEMPLATES = {
    custom: { name: '自由组卷', slots: [] },
    gaokao_new_1: {
        name: '2025 全国卷 I（新高考）',
        total: 150,
        slots: [
            ...Array.from({ length: 8 }, (_, i) => ({ order: i + 1, questionType: 'choice', defaultScore: 5 })),
            ...Array.from({ length: 3 }, (_, i) => ({ order: 9 + i, questionType: 'multi', defaultScore: 6 })),
            ...Array.from({ length: 3 }, (_, i) => ({ order: 12 + i, questionType: 'fillblank', defaultScore: 5 })),
            { order: 15, questionType: 'solve', defaultScore: 13 },
            { order: 16, questionType: 'solve', defaultScore: 15 },
            { order: 17, questionType: 'solve', defaultScore: 15 },
            { order: 18, questionType: 'solve', defaultScore: 17 },
            { order: 19, questionType: 'solve', defaultScore: 17 },
        ],
    },
};

export default function CreatePaperPage() {
    const router = useRouter();

    // 搜索状态
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Question[]>([]);
    const [searching, setSearching] = useState(false);

    // 已选题目
    const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);

    // 试卷信息
    const [paperTitle, setPaperTitle] = useState('');
    const [paperDescription, setPaperDescription] = useState('');
    const [timeLimit, setTimeLimit] = useState<number | ''>('');

    // 提交状态
    const [submitting, setSubmitting] = useState(false);

    // 模板状态
    const [templateId, setTemplateId] = useState<keyof typeof TEMPLATES>('custom');

    // 搜索题目
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const results = await questionApi.search(searchQuery, 10);
            setSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
            alert('搜索失败，请确认已配置 Embedding 服务');
        } finally {
            setSearching(false);
        }
    };

    // 加载题目列表（备选）
    const loadQuestionList = async () => {
        setSearching(true);
        try {
            const result = await questionApi.list({ limit: 20 });
            setSearchResults(result.items || []);
        } catch (error) {
            console.error('Failed to load questions:', error);
        } finally {
            setSearching(false);
        }
    };

    // 添加题目到试卷
    const addQuestion = (question: Question) => {
        if (selectedQuestions.find(q => q.id === question.id)) {
            alert('该题目已添加');
            return;
        }
        setSelectedQuestions(prev => [
            ...prev,
            {
                ...question,
                score: 10,
                order: prev.length + 1,
            }
        ]);
    };

    // 移除题目
    const removeQuestion = (id: string) => {
        setSelectedQuestions(prev => {
            const filtered = prev.filter(q => q.id !== id);
            return filtered.map((q, idx) => ({ ...q, order: idx + 1 }));
        });
    };

    // 更新分值
    const updateScore = (id: string, score: number) => {
        setSelectedQuestions(prev =>
            prev.map(q => q.id === id ? { ...q, score } : q)
        );
    };

    // 移动题目顺序
    const moveQuestion = (id: string, direction: 'up' | 'down') => {
        setSelectedQuestions(prev => {
            const idx = prev.findIndex(q => q.id === id);
            if (idx === -1) return prev;
            if (direction === 'up' && idx === 0) return prev;
            if (direction === 'down' && idx === prev.length - 1) return prev;

            const newArr = [...prev];
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
            return newArr.map((q, i) => ({ ...q, order: i + 1 }));
        });
    };

    // 计算总分
    const totalScore = selectedQuestions.reduce((sum, q) => sum + q.score, 0);

    // 提交试卷
    const handleSubmit = async () => {
        if (!paperTitle.trim()) {
            alert('请输入试卷标题');
            return;
        }
        if (selectedQuestions.length === 0) {
            alert('请至少添加一道题目');
            return;
        }

        setSubmitting(true);
        try {
            await paperApi.create({
                title: paperTitle,
                description: paperDescription || undefined,
                templateType: templateId,
                totalScore,
                timeLimit: timeLimit ? Number(timeLimit) : undefined,
                questions: selectedQuestions.map(q => ({
                    questionId: q.id,
                    order: q.order,
                    score: q.score,
                })),
            });
            alert('试卷创建成功！');
            router.push('/papers');
        } catch (error: any) {
            console.error('Failed to create paper:', error);
            alert(error?.userMessage || '创建失败');
        } finally {
            setSubmitting(false);
        }
    };

    const difficultyLabel = (d: string) => {
        const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };
        return map[d] || d;
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">创建试卷</h1>
                        <p className="text-muted-foreground">从题库中挑选题目组成试卷</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <div className="flex items-center gap-2">
                            <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
                            <select
                                className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
                                value={templateId}
                                onChange={(e) => setTemplateId(e.target.value as keyof typeof TEMPLATES)}
                            >
                                {Object.entries(TEMPLATES).map(([id, t]) => (
                                    <option key={id} value={id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || selectedQuestions.length === 0}
                            className="gap-2"
                        >
                            {submitting ? '创建中...' : (
                                <>
                                    <Save className="w-4 h-4" />
                                    完成创建
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                    {/* 左侧：搜索选题 */}
                    <Card className="flex flex-col h-full overflow-hidden">
                        <div className="p-5 border-b border-border shrink-0">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Search className="w-5 h-5 text-primary" />
                                搜索题目
                            </h2>

                            <div className="flex gap-2">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="输入关键词语义搜索，如：三角函数"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={searching}
                                >
                                    搜索
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={loadQuestionList}
                                    disabled={searching}
                                >
                                    全部
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/10">
                            {searching ? (
                                <div className="text-center py-12 text-muted-foreground">搜索中...</div>
                            ) : searchResults.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                                    <BookOpen className="w-8 h-8 opacity-20" />
                                    输入关键词搜索题目，或点击"全部"加载题库
                                </div>
                            ) : (
                                searchResults.map((q) => (
                                    <div key={q.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-2 items-center">
                                                <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    }`}>
                                                    {difficultyLabel(q.difficulty)}
                                                </span>
                                                {q.similarity !== undefined && (
                                                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md">
                                                        {Math.round(q.similarity * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => addQuestion(q)}
                                                className="h-7 px-2 text-xs hover:bg-primary hover:text-primary-foreground"
                                            >
                                                <Plus className="w-3 h-3 mr-1" />
                                                添加
                                            </Button>
                                        </div>
                                        <div className="text-sm text-foreground/80 line-clamp-3">
                                            <MathText>{(q.questionText || '').slice(0, 200)}</MathText>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* 右侧：已选题目 + 试卷信息 */}
                    <div className="flex flex-col gap-6 h-full overflow-hidden">
                        {/* 试卷基本信息 */}
                        <Card className="p-5 shrink-0">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                试卷信息
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                                        试卷标题 <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        value={paperTitle}
                                        onChange={(e) => setPaperTitle(e.target.value)}
                                        placeholder="如：2024年高三数学月考试卷"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> 考试时间 (分钟)
                                        </label>
                                        <Input
                                            type="number"
                                            value={timeLimit}
                                            onChange={(e) => setTimeLimit(e.target.value ? Number(e.target.value) : '')}
                                            placeholder="120"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                            <Calculator className="w-3 h-3" /> 总分
                                        </label>
                                        <div className="h-11 px-4 flex items-center bg-secondary/50 rounded-xl text-lg font-semibold text-primary border border-transparent">
                                            {totalScore} 分
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* 已选题目列表 */}
                        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="p-5 border-b border-border shrink-0">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                                        {selectedQuestions.length}
                                    </span>
                                    已选题目
                                </h2>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/10">
                                {selectedQuestions.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                                        <Plus className="w-8 h-8 opacity-20" />
                                        从左侧搜索并添加题目
                                    </div>
                                ) : (
                                    selectedQuestions.map((q, idx) => (
                                        <div key={q.id} className="bg-card border border-border rounded-xl p-4 group hover:shadow-sm transition-all">
                                            <div className="flex justify-between items-center mb-3 pb-3 border-b border-border/50">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-sm font-bold">
                                                        {q.order}
                                                    </span>
                                                    <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                        q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        }`}>
                                                        {difficultyLabel(q.difficulty)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => moveQuestion(q.id, 'up')}
                                                        disabled={idx === 0}
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <ArrowUp className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => moveQuestion(q.id, 'down')}
                                                        disabled={idx === selectedQuestions.length - 1}
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <ArrowDown className="w-4 h-4" />
                                                    </Button>
                                                    <div className="flex items-center gap-1 mx-2">
                                                        <Input
                                                            type="number"
                                                            value={q.score}
                                                            onChange={(e) => updateScore(q.id, Number(e.target.value) || 0)}
                                                            className="w-16 h-7 text-center px-1"
                                                        />
                                                        <span className="text-xs text-muted-foreground">分</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeQuestion(q.id)}
                                                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="text-sm text-foreground/80 line-clamp-2">
                                                <MathText>{(q.questionText || '').slice(0, 150)}</MathText>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
