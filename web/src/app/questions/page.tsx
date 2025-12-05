'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { questionApi } from '@/lib/api-client';
import { MathText } from '@/components/ui/MathText';

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
    });

    // 加载题目列表
    const loadQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const result = await questionApi.list({
                page,
                limit: 10,
                search: searchMode === 'list' ? searchQuery : undefined,
                difficulty: filters.difficulty || undefined,
                question_type: filters.questionType || undefined,
            });
            setQuestions(result.questions || []);
            setTotalPages(result.totalPages || 1);
        } catch (error) {
            console.error('Failed to load questions:', error);
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, searchMode, filters]);

    // 语义搜索
    const handleSemanticSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchMode('list');
            loadQuestions();
            return;
        }

        setLoading(true);
        setSearchMode('semantic');
        try {
            const results = await questionApi.search(searchQuery, 20);
            setQuestions(results);
            setTotalPages(1);
        } catch (error) {
            console.error('Semantic search failed:', error);
            alert('语义搜索失败，请确认已配置 Embedding 服务');
        } finally {
            setLoading(false);
        }
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
        const map: Record<string, string> = { choice: '选择题', fillblank: '填空题', solve: '解答题', proof: '证明题' };
        return map[t] || t;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <Link href="/" className="text-xl font-bold text-gray-800">📚 题库</Link>
                    <div className="flex gap-3">
                        <Link href="/papers/create" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            创建试卷
                        </Link>
                        <Link href="/" className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition">
                            上传题目
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* 搜索和筛选 */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[300px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">搜索题目</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="输入关键词或描述，如：二次函数求最值"
                                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
                                />
                                <button
                                    onClick={handleSemanticSearch}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    🔍 语义搜索
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">难度</label>
                            <select
                                value={filters.difficulty}
                                onChange={(e) => {
                                    setFilters(f => ({ ...f, difficulty: e.target.value }));
                                    setPage(1);
                                    setSearchMode('list');
                                }}
                                className="px-3 py-2 border rounded-lg"
                            >
                                <option value="">全部</option>
                                <option value="easy">简单</option>
                                <option value="medium">中等</option>
                                <option value="hard">困难</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">题型</label>
                            <select
                                value={filters.questionType}
                                onChange={(e) => {
                                    setFilters(f => ({ ...f, questionType: e.target.value }));
                                    setPage(1);
                                    setSearchMode('list');
                                }}
                                className="px-3 py-2 border rounded-lg"
                            >
                                <option value="">全部</option>
                                <option value="choice">选择题</option>
                                <option value="fillblank">填空题</option>
                                <option value="solve">解答题</option>
                                <option value="proof">证明题</option>
                            </select>
                        </div>

                        {searchMode === 'semantic' && (
                            <button
                                onClick={() => {
                                    setSearchMode('list');
                                    setSearchQuery('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                清除搜索
                            </button>
                        )}
                    </div>

                    {searchMode === 'semantic' && (
                        <div className="mt-3 text-sm text-blue-600">
                            🔍 语义搜索模式：显示与"{searchQuery}"最相关的题目
                        </div>
                    )}
                </div>

                {/* 题目列表 */}
                {loading ? (
                    <div className="text-center py-12 text-gray-500">加载中...</div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-lg">暂无题目</p>
                        <p className="mt-2">请先 <Link href="/" className="text-blue-600 hover:underline">上传题目</Link></p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {questions.map((q) => (
                            <div key={q.id} className="bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-2 flex-wrap">
                                        <span className={`px-2 py-1 text-xs rounded ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {difficultyLabel(q.difficulty)}
                                        </span>
                                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                            {typeLabel(q.questionType)}
                                        </span>
                                        {q.similarity !== undefined && (
                                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                                                相似度: {Math.round(q.similarity * 100)}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="prose prose-sm max-w-none mb-3">
                                    <MathText>{(q.questionText || '').slice(0, 300) + ((q.questionText?.length || 0) > 300 ? '...' : '')}</MathText>
                                </div>

                                {q.knowledgePoints && q.knowledgePoints.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                        {q.knowledgePoints.slice(0, 5).map((kp, i) => (
                                            <span key={i} className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded">
                                                {kp}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 分页 */}
                {searchMode === 'list' && totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 border rounded-lg disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <span className="px-4 py-2 text-gray-600">
                            第 {page} / {totalPages} 页
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 border rounded-lg disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
