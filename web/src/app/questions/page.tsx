

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, RefreshCw, Eye, Download } from 'lucide-react';
import { questionApi } from '@/lib/api-client';
import { MathText } from '@/components/ui/MathText';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Question {
    id: string;
    questionText: string;
    answer: string;
    difficulty: string;
    questionType: string;
    knowledgePoints: string[];
    similarity?: number;
}

export default function QuestionsPage() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'list' | 'semantic'>('list');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        difficulty: '',
        questionType: '',
        includePublic: true,
    });

    // 加载题目列表
    const loadQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const result = await questionApi.list({
                page,
                limit: 10,
                search: searchMode === 'list' ? searchQuery : undefined,
                includePublic: filters.includePublic,
            });
            setQuestions(result.items || []);
            setTotalPages(Math.ceil((result.total || 0) / 10) || 1);
        } catch (error) {
            console.error('Failed to load questions:', error);
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, searchMode, filters]);

    // 语义搜索
    const handleSemanticSearch = async () => {
        setSearchMode('list');
        loadQuestions();
    };

    useEffect(() => {
        if (searchMode === 'list') {
            loadQuestions();
        }
    }, [loadQuestions, searchMode]);

    const difficultyLabel = (d: string) => {
        const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };
        return map[d] || d;
    };

    const typeLabel = (t: string) => {
        const map: Record<string, string> = { choice: '选择题', fillblank: '填空题', solve: '解答题', proof: '证明题', multi: '多选题' };
        return map[t] || t;
    };

    // 导出题目 JSON
    const exportQuestionJson = async (questionId: string) => {
        try {
            const question = await questionApi.get(questionId);
            const jsonStr = JSON.stringify(question, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `question_${questionId.slice(0, 8)}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Failed to export question:', error);
            alert('导出失败');
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">题库浏览</h1>
                        <p className="text-muted-foreground">管理和检索所有题目资源</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/dashboard">
                            <Button variant="outline">上传题目</Button>
                        </Link>
                        <Link href="/papers/create">
                            <Button>创建试卷</Button>
                        </Link>
                    </div>
                </div>

                {/* 搜索和筛选 */}
                <Card className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-muted-foreground mb-1">搜索题目</label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="输入关键词或描述，如：二次函数求最值"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
                                    leftIcon={<Search className="w-4 h-4" />}
                                />
                                <Button onClick={handleSemanticSearch}>
                                    语义搜索
                                </Button>
                            </div>
                        </div>

                        <div className="w-full md:w-auto">
                            <label className="block text-sm font-medium text-muted-foreground mb-1">难度</label>
                            <select
                                value={filters.difficulty}
                                onChange={(e) => {
                                    setFilters(f => ({ ...f, difficulty: e.target.value }));
                                    setPage(1);
                                    setSearchMode('list');
                                }}
                                className="w-full h-11 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">全部难度</option>
                                <option value="easy">简单</option>
                                <option value="medium">中等</option>
                                <option value="hard">困难</option>
                            </select>
                        </div>

                        <div className="w-full md:w-auto">
                            <label className="block text-sm font-medium text-muted-foreground mb-1">题型</label>
                            <select
                                value={filters.questionType}
                                onChange={(e) => {
                                    setFilters(f => ({ ...f, questionType: e.target.value }));
                                    setPage(1);
                                    setSearchMode('list');
                                }}
                                className="w-full h-11 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">全部题型</option>
                                <option value="choice">选择题</option>
                                <option value="multi">多选题</option>
                                <option value="fillblank">填空题</option>
                                <option value="solve">解答题</option>
                                <option value="proof">证明题</option>
                            </select>
                        </div>

                        {searchMode === 'semantic' && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSearchMode('list');
                                    setSearchQuery('');
                                }}
                            >
                                清除搜索
                            </Button>
                        )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <label className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                            <input
                                type="checkbox"
                                checked={filters.includePublic}
                                onChange={(e) => {
                                    setFilters(f => ({ ...f, includePublic: e.target.checked }));
                                    setPage(1);
                                    setSearchMode('list');
                                }}
                                className="w-4 h-4 text-primary rounded border-input focus:ring-primary"
                            />
                            <span>包含公共题库</span>
                        </label>

                        <div className="text-sm text-muted-foreground">
                            提示：后端暂不支持语义搜索/删除，仅关键词检索。
                        </div>
                    </div>
                </Card>

                {/* 题目列表 */}
                {loading ? (
                    <div className="grid gap-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Card key={i} className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-2">
                                        <Skeleton className="h-5 w-12 rounded-full" />
                                        <Skeleton className="h-5 w-12 rounded-full" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-20 bg-secondary/30 rounded-2xl border border-dashed border-border">
                        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">暂无题目</h3>
                        <p className="text-muted-foreground mt-1">
                            没有找到相关题目，试着调整筛选条件或 <Link href="/dashboard" className="text-primary hover:underline">上传新题目</Link>
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {questions.map((q) => (
                            <Card key={q.id} hover className="p-5 group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-2 flex-wrap">
                                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>
                                            {difficultyLabel(q.difficulty)}
                                        </span>
                                        <span className="px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                                            {typeLabel(q.questionType)}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => exportQuestionJson(q.id)}
                                            title="导出 JSON"
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        <Link href={`/questions/${q.id}`}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>

                                <div className="prose prose-sm max-w-none mb-4 text-foreground/90">
                                    <MathText>{(q.questionText || '').slice(0, 300) + ((q.questionText?.length || 0) > 300 ? '...' : '')}</MathText>
                                </div>

                                {q.knowledgePoints && q.knowledgePoints.length > 0 && (
                                    <div className="flex gap-1.5 flex-wrap pt-3 border-t border-border/50">
                                        {q.knowledgePoints.slice(0, 5).map((kp, i) => (
                                            <span key={i} className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300 rounded border border-indigo-100 dark:border-indigo-900/30">
                                                # {kp}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}

                {/* 分页 */}
                {searchMode === 'list' && totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                        <Button
                            variant="outline"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            上一页
                        </Button>
                        <div className="flex items-center px-4 text-sm font-medium text-muted-foreground">
                            第 {page} / {totalPages} 页
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            下一页
                        </Button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
