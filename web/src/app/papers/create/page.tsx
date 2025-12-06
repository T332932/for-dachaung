'use client';

import { useState, useEffect, useCallback } from 'react';
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

// 模板槽位接口
interface Slot {
    order: number;
    questionType: string;
    defaultScore: number;
    question?: Question;  // 已填入的题目
}

// 题型中文名
const questionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
        'choice': '单选', 'multi': '多选', 'fillblank': '填空', 'solve': '解答'
    };
    return labels[type] || type;
};

// 模板定义
const TEMPLATES: Record<string, { name: string; total?: number; slots: Omit<Slot, 'question'>[] }> = {
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

    // 分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const PAGE_SIZE = 20;

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

    // 悬浮预览
    const [hoverQuestion, setHoverQuestion] = useState<Question | SelectedQuestion | null>(null);

    // 模板槽位状态
    const [templateSlots, setTemplateSlots] = useState<Slot[]>([]);
    const [activeSlot, setActiveSlot] = useState<number | null>(null);  // 当前选中的槽位序号

    // 当模板变化时，初始化槽位
    const initializeSlots = (newTemplateId: string) => {
        const template = TEMPLATES[newTemplateId];
        if (template && template.slots.length > 0) {
            setTemplateSlots(template.slots.map(s => ({ ...s, question: undefined })));
            setActiveSlot(1);  // 默认选中第一个槽位
            setSelectedQuestions([]);  // 清空自由组卷的题目
        } else {
            setTemplateSlots([]);
            setActiveSlot(null);
        }
    };

    // 判断是否是模板模式
    const isTemplateMode = templateSlots.length > 0;

    // 草稿加载状态
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);

    // 页面加载时恢复草稿
    useEffect(() => {
        const loadDraft = async () => {
            try {
                const draft = await paperApi.getDraft();
                if (draft) {
                    if (draft.title) setPaperTitle(draft.title);
                    if (draft.timeLimit) setTimeLimit(draft.timeLimit);
                    if (draft.questionsData && draft.questionsData.length > 0) {
                        // 恢复已选题目
                        setSelectedQuestions(draft.questionsData.map((q: any, idx: number) => ({
                            ...q,
                            order: q.order || idx + 1,
                        })));
                    }
                    console.log('草稿已恢复');
                }
            } catch (err) {
                console.log('无草稿或加载失败');
            }
            setDraftLoaded(true);
        };
        loadDraft();
    }, []);

    // 自动保存草稿（防抖 3 秒）
    useEffect(() => {
        if (!draftLoaded) return;

        const timer = setTimeout(async () => {
            try {
                setSavingDraft(true);
                await paperApi.saveDraft({
                    title: paperTitle || undefined,
                    templateId: templateId,
                    timeLimit: typeof timeLimit === 'number' ? timeLimit : undefined,
                    questionsData: selectedQuestions.map(q => ({
                        id: q.id,
                        score: q.score,
                        order: q.order,
                        questionText: q.questionText?.slice(0, 100),
                        difficulty: q.difficulty,
                    })),
                });
            } catch (err) {
                console.error('草稿保存失败', err);
            } finally {
                setSavingDraft(false);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [draftLoaded, paperTitle, templateId, timeLimit, selectedQuestions]);

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
    const loadQuestionList = async (page = 1, append = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setSearching(true);
            setCurrentPage(1);
        }
        try {
            const result = await questionApi.list({ limit: PAGE_SIZE, page });
            const items = result.items || [];
            if (append) {
                setSearchResults(prev => [...prev, ...items]);
            } else {
                setSearchResults(items);
            }
            setCurrentPage(page);
            setHasMore(items.length === PAGE_SIZE);
        } catch (error) {
            console.error('Failed to load questions:', error);
        } finally {
            setSearching(false);
            setLoadingMore(false);
        }
    };

    // 加载更多
    const loadMore = () => {
        loadQuestionList(currentPage + 1, true);
    };

    // 添加题目到试卷
    const addQuestion = (question: Question) => {
        // 模板模式：填充到当前选中的槽位
        if (isTemplateMode && activeSlot !== null) {
            // 检查是否已在其他槽位使用
            if (templateSlots.some(s => s.question?.id === question.id)) {
                alert('该题目已添加到其他位置');
                return;
            }
            setTemplateSlots(prev => prev.map(slot =>
                slot.order === activeSlot
                    ? { ...slot, question }
                    : slot
            ));
            // 自动跳转到下一个空槽位
            const nextEmpty = templateSlots.find(s => s.order > activeSlot && !s.question);
            if (nextEmpty) {
                setActiveSlot(nextEmpty.order);
            }
            return;
        }

        // 自由模式：追加到列表
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

    // 从模板槽位移除题目
    const removeSlotQuestion = (slotOrder: number) => {
        setTemplateSlots(prev => prev.map(slot =>
            slot.order === slotOrder ? { ...slot, question: undefined } : slot
        ));
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
            // 创建成功后删除草稿
            try {
                await paperApi.deleteDraft();
            } catch { }
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
                                onChange={(e) => {
                                    const newId = e.target.value;
                                    setTemplateId(newId);
                                    initializeSlots(newId);
                                }}
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
                                    onClick={() => loadQuestionList()}
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
                            {/* 加载更多按钮 */}
                            {!searching && searchResults.length > 0 && hasMore && (
                                <div className="text-center py-4">
                                    <Button
                                        variant="outline"
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="w-full"
                                    >
                                        {loadingMore ? '加载中...' : '加载更多'}
                                    </Button>
                                </div>
                            )}
                            {!searching && searchResults.length > 0 && !hasMore && (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                    已加载全部 {searchResults.length} 道题目
                                </div>
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
                                        {isTemplateMode ? templateSlots.filter(s => s.question).length : selectedQuestions.length}
                                    </span>
                                    {isTemplateMode ? `试卷结构 (${templateSlots.filter(s => s.question).length}/${templateSlots.length})` : '已选题目'}
                                </h2>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {selectedQuestions.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                                        <Plus className="w-8 h-8 opacity-20" />
                                        从左侧搜索并添加题目
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/30 sticky top-0">
                                            <tr className="text-left">
                                                <th className="py-2 px-3 w-12 text-center">#</th>
                                                <th className="py-2 px-3">题干预览</th>
                                                <th className="py-2 px-3 w-20 text-center">难度</th>
                                                <th className="py-2 px-3 w-24 text-center">分值</th>
                                                <th className="py-2 px-3 w-24 text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedQuestions.map((q, idx) => (
                                                <tr
                                                    key={q.id}
                                                    className={`border-b border-border/50 hover:bg-secondary/20 group cursor-pointer ${hoverQuestion?.id === q.id ? 'bg-primary/10' : ''}`}
                                                    onMouseEnter={() => setHoverQuestion(q)}
                                                >
                                                    <td className="py-2 px-3 text-center">
                                                        <span className="w-6 h-6 bg-primary/10 text-primary rounded flex items-center justify-center text-xs font-bold mx-auto">
                                                            {q.order}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="line-clamp-1 text-foreground/80 cursor-help" title={(q.questionText || '').slice(0, 300)}>
                                                            <MathText>{(q.questionText || '').slice(0, 60)}</MathText>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        <span className={`px-1.5 py-0.5 text-xs rounded ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                            }`}>
                                                            {difficultyLabel(q.difficulty)}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        <Input
                                                            type="number"
                                                            value={q.score}
                                                            onChange={(e) => updateScore(q.id, Number(e.target.value) || 0)}
                                                            className="w-14 h-6 text-center px-1 text-xs"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => moveQuestion(q.id, 'up')}
                                                                disabled={idx === 0}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <ArrowUp className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => moveQuestion(q.id, 'down')}
                                                                disabled={idx === selectedQuestions.length - 1}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <ArrowDown className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeQuestion(q.id)}
                                                                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </Card>

                        {/* 悬浮预览面板 */}
                        {hoverQuestion && (
                            <Card className="p-4 bg-card/95 backdrop-blur border-primary/20 shadow-lg shrink-0 max-h-80 overflow-y-auto">
                                <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                                    <span>题目预览</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={() => setHoverQuestion(null)}
                                    >×</Button>
                                </div>
                                <div className="space-y-3">
                                    <div className="text-sm">
                                        <MathText>{hoverQuestion.questionText}</MathText>
                                    </div>
                                    {hoverQuestion.answer && (
                                        <div className="border-t pt-3">
                                            <div className="text-xs text-muted-foreground mb-1">答案/解析</div>
                                            <div className="text-sm text-foreground/70">
                                                <MathText>{hoverQuestion.answer.slice(0, 500) + (hoverQuestion.answer.length > 500 ? '...' : '')}</MathText>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
