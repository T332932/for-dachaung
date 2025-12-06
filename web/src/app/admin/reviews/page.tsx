'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { adminApi, authApi } from '@/lib/api-client';
import { Check, X, AlertTriangle, FileText } from 'lucide-react';
import { MathText } from '@/components/ui/MathText';

interface ReviewItem {
    id: string;
    questionId: string;
    questionText: string;
    status: string;
    reviewType: string;
    similarityScore: number;
    similarQuestionId: string | null;
    similarQuestionText: string | null;
    requestedBy: string;
    createdAt: string;
}

export default function AdminReviewsPage() {
    const router = useRouter();
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        checkAdmin();
        loadReviews();
    }, []);

    const checkAdmin = async () => {
        const user = authApi.getUser();
        if (!user || user.role !== 'admin') {
            router.replace('/dashboard');
        }
    };

    const loadReviews = async () => {
        try {
            const data = await adminApi.getReviews('pending');
            setReviews(data.items);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        if (!confirm('确定批准发布此题目吗？')) return;
        setProcessingId(id);
        try {
            await adminApi.approveReview(id);
            setReviews(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert('操作失败');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('请输入拒绝原因（可选）：');
        if (reason === null) return;

        setProcessingId(id);
        try {
            await adminApi.rejectReview(id, reason);
            setReviews(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert('操作失败');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">发布审核</h1>
                    <p className="text-muted-foreground">处理教师提交的公开题库发布请求</p>
                </div>

                {loading ? (
                    <div className="text-center py-8">加载中...</div>
                ) : reviews.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">
                        暂无待审核的请求
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <Card key={review.id} className="p-6">
                                <div className="flex justify-between items-start gap-4 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${review.reviewType === 'duplicate' ? 'bg-red-100 text-red-700' :
                                                review.reviewType === 'suspicious' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {review.reviewType === 'duplicate' ? '疑似重题' :
                                                review.reviewType === 'suspicious' ? '疑似坏题' : '高度相似'}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            相似度: {review.similarityScore}%
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            申请人ID: {review.requestedBy}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="default"
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => handleApprove(review.id)}
                                            disabled={!!processingId}
                                        >
                                            <Check className="w-4 h-4 mr-1" />
                                            批准
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleReject(review.id)}
                                            disabled={!!processingId}
                                        >
                                            <X className="w-4 h-4 mr-1" />
                                            拒绝
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <h3 className="font-medium flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-500" />
                                            申请发布的题目
                                        </h3>
                                        <div className="p-4 bg-secondary/30 rounded-lg text-sm min-h-[100px]">
                                            <MathText>{review.questionText}</MathText>
                                        </div>
                                    </div>

                                    {review.similarQuestionText && (
                                        <div className="space-y-2">
                                            <h3 className="font-medium flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                                库中相似题目 (ID: {review.similarQuestionId})
                                            </h3>
                                            <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-lg text-sm min-h-[100px]">
                                                <MathText>{review.similarQuestionText}</MathText>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
