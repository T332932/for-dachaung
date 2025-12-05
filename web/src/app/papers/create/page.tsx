'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { questionApi, paperApi } from '@/lib/api-client';
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

interface SelectedQuestion extends Question {
    score: number;
    order: number;
}

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
            setSearchResults(result.questions || []);
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
                templateType: 'custom',
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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xl font-bold text-gray-800">📝 创建试卷</Link>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/questions" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                            题库
                        </Link>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || selectedQuestions.length === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            {submitting ? '创建中...' : '创建试卷'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 左侧：搜索选题 */}
                    <div className="bg-white rounded-lg shadow-sm p-5">
                        <h2 className="text-lg font-semibold mb-4">🔍 搜索题目</h2>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="输入关键词语义搜索，如：三角函数"
                                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={searching}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                搜索
                            </button>
                            <button
                                onClick={loadQuestionList}
                                disabled={searching}
                                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                全部
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto space-y-3">
                            {searching ? (
                                <div className="text-center py-8 text-gray-500">搜索中...</div>
                            ) : searchResults.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    输入关键词搜索题目，或点击"全部"加载题库
                                </div>
                            ) : (
                                searchResults.map((q) => (
                                    <div key={q.id} className="border rounded-lg p-3 hover:border-blue-300 transition">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-1">
                                                <span className={`px-2 py-0.5 text-xs rounded ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                        q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {difficultyLabel(q.difficulty)}
                                                </span>
                                                {q.similarity !== undefined && (
                                                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                                        {Math.round(q.similarity * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => addQuestion(q)}
                                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                            >
                                                + 添加
                                            </button>
                                        </div>
                                        <div className="text-sm text-gray-700 line-clamp-3">
                                            <MathText>{(q.questionText || '').slice(0, 200)}</MathText>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 右侧：已选题目 + 试卷信息 */}
                    <div className="space-y-6">
                        {/* 试卷基本信息 */}
                        <div className="bg-white rounded-lg shadow-sm p-5">
                            <h2 className="text-lg font-semibold mb-4">📋 试卷信息</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        试卷标题 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={paperTitle}
                                        onChange={(e) => setPaperTitle(e.target.value)}
                                        placeholder="如：2024年高三数学月考试卷"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        试卷描述
                                    </label>
                                    <textarea
                                        value={paperDescription}
                                        onChange={(e) => setPaperDescription(e.target.value)}
                                        placeholder="选填"
                                        rows={2}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            考试时间（分钟）
                                        </label>
                                        <input
                                            type="number"
                                            value={timeLimit}
                                            onChange={(e) => setTimeLimit(e.target.value ? Number(e.target.value) : '')}
                                            placeholder="如：120"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            总分
                                        </label>
                                        <div className="px-4 py-2 bg-gray-100 rounded-lg text-lg font-semibold text-blue-600">
                                            {totalScore} 分
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 已选题目列表 */}
                        <div className="bg-white rounded-lg shadow-sm p-5">
                            <h2 className="text-lg font-semibold mb-4">
                                ✅ 已选题目 ({selectedQuestions.length})
                            </h2>

                            {selectedQuestions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    从左侧搜索并添加题目
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                                    {selectedQuestions.map((q, idx) => (
                                        <div key={q.id} className="border rounded-lg p-3 bg-blue-50">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                                                        {q.order}
                                                    </span>
                                                    <span className={`px-2 py-0.5 text-xs rounded ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                            q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {difficultyLabel(q.difficulty)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => moveQuestion(q.id, 'up')}
                                                        disabled={idx === 0}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        onClick={() => moveQuestion(q.id, 'down')}
                                                        disabled={idx === selectedQuestions.length - 1}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        ↓
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={q.score}
                                                        onChange={(e) => updateScore(q.id, Number(e.target.value) || 0)}
                                                        className="w-16 px-2 py-1 border rounded text-center"
                                                    />
                                                    <span className="text-sm text-gray-500">分</span>
                                                    <button
                                                        onClick={() => removeQuestion(q.id)}
                                                        className="p-1 text-red-500 hover:text-red-700"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-700 line-clamp-2">
                                                <MathText>{(q.questionText || '').slice(0, 150)}</MathText>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
