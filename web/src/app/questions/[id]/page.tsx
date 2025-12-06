'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { questionApi } from '@/lib/api-client';
import { MathText } from '@/components/ui/MathText';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Edit, Trash2, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Question {
    id: string;
    questionText: string;
    options?: string[];
    answer: string;
    explanation?: string;
    difficulty: string;
    questionType: string;
    knowledgePoints: string[];
    hasGeometry?: boolean;
    geometrySvg?: string;
    source?: string;
    year?: number;
    isPublic?: boolean;
}

export default function QuestionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const questionId = params.id as string;

    const [question, setQuestion] = useState<Question | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Question>>({});

    useEffect(() => {
        if (questionId) {
            loadQuestion();
        }
    }, [questionId]);

    const loadQuestion = async () => {
        try {
            const data = await questionApi.get(questionId);
            setQuestion(data);
            setEditForm(data);
        } catch (error) {
            console.error('Failed to load question:', error);
            alert('加载题目失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!question) return;
        setSaving(true);
        try {
            await questionApi.update(question.id, {
                questionText: editForm.questionText || '',
                options: editForm.options,
                answer: editForm.answer || '',
                explanation: editForm.explanation,
                difficulty: editForm.difficulty || 'medium',
                questionType: editForm.questionType || 'solve',
                knowledgePoints: editForm.knowledgePoints || [],
                hasGeometry: editForm.hasGeometry || false,
                geometrySvg: editForm.geometrySvg,
                source: editForm.source,
                year: editForm.year,
                isPublic: editForm.isPublic || false,
            });
            setQuestion({ ...question, ...editForm } as Question);
            setEditing(false);
            alert('保存成功');
        } catch (error: any) {
            alert(error?.userMessage || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!question) return;
        if (!confirm('确定要删除这道题目吗？此操作不可撤销。')) return;
        try {
            await questionApi.delete(question.id);
            router.push('/questions');
        } catch (error: any) {
            alert(error?.userMessage || '删除失败');
        }
    };

    const difficultyLabel = (d: string) => {
        const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };
        return map[d] || d;
    };

    const typeLabel = (t: string) => {
        const map: Record<string, string> = { choice: '选择题', multi: '多选题', fillblank: '填空题', solve: '解答题', proof: '证明题' };
        return map[t] || t;
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="text-center py-12 text-muted-foreground">加载中...</div>
            </DashboardLayout>
        );
    }

    if (!question) {
        return (
            <DashboardLayout>
                <div className="text-center py-12 text-muted-foreground">题目不存在</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.push('/questions')}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            返回
                        </Button>
                        <h1 className="text-2xl font-bold">题目详情</h1>
                    </div>
                    <div className="flex gap-2">
                        {editing ? (
                            <>
                                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                                    <X className="w-4 h-4 mr-2" />
                                    取消
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    <Save className="w-4 h-4 mr-2" />
                                    {saving ? '保存中...' : '保存'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setEditing(true)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    编辑
                                </Button>
                                <Button variant="danger" onClick={handleDelete}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    删除
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <Card className="p-6 space-y-6">
                    {/* 基本信息 */}
                    <div className="flex gap-2 flex-wrap">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${question.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                            question.difficulty === 'hard' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                            {difficultyLabel(question.difficulty)}
                        </span>
                        <span className="px-3 py-1 text-sm font-medium bg-secondary text-secondary-foreground rounded-full">
                            {typeLabel(question.questionType)}
                        </span>
                        {question.isPublic && (
                            <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">
                                公开
                            </span>
                        )}
                    </div>

                    {/* 题干 */}
                    <div>
                        <h3 className="font-semibold text-muted-foreground mb-2">题干</h3>
                        {editing ? (
                            <textarea
                                className="w-full p-3 border border-input rounded-lg bg-background min-h-[120px]"
                                value={editForm.questionText || ''}
                                onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                            />
                        ) : (
                            <div className="p-4 bg-secondary/30 rounded-lg">
                                <MathText>{question.questionText}</MathText>
                            </div>
                        )}
                    </div>

                    {/* 选项 */}
                    {question.options && question.options.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-muted-foreground mb-2">选项</h3>
                            <div className="space-y-2">
                                {question.options.map((opt, idx) => (
                                    <div key={idx} className="p-3 bg-secondary/30 rounded-lg">
                                        <MathText>{opt}</MathText>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 答案 */}
                    <div>
                        <h3 className="font-semibold text-muted-foreground mb-2">答案</h3>
                        {editing ? (
                            <textarea
                                className="w-full p-3 border border-input rounded-lg bg-background min-h-[80px]"
                                value={editForm.answer || ''}
                                onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                            />
                        ) : (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <MathText>{question.answer}</MathText>
                            </div>
                        )}
                    </div>

                    {/* 解析 */}
                    {(question.explanation || editing) && (
                        <div>
                            <h3 className="font-semibold text-muted-foreground mb-2">解析</h3>
                            {editing ? (
                                <textarea
                                    className="w-full p-3 border border-input rounded-lg bg-background min-h-[80px]"
                                    value={editForm.explanation || ''}
                                    onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                                    placeholder="可选"
                                />
                            ) : question.explanation ? (
                                <div className="p-4 bg-secondary/30 rounded-lg">
                                    <MathText>{question.explanation}</MathText>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {/* 几何图 */}
                    {question.hasGeometry && question.geometrySvg && (
                        <div>
                            <h3 className="font-semibold text-muted-foreground mb-2">几何图</h3>
                            <div className="p-4 bg-white rounded-lg border flex justify-center" dangerouslySetInnerHTML={{ __html: question.geometrySvg }} />
                        </div>
                    )}

                    {/* 知识点 */}
                    {question.knowledgePoints && question.knowledgePoints.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-muted-foreground mb-2">知识点</h3>
                            <div className="flex gap-2 flex-wrap">
                                {question.knowledgePoints.map((kp, i) => (
                                    <span key={i} className="px-2 py-1 text-sm bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                                        #{kp}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
}
