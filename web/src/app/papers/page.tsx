'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { paperApi } from '@/lib/api-client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, FileDown, List, Plus, Trash2 } from 'lucide-react';

interface Paper {
  id: string;
  title: string;
  description?: string;
  templateType?: string;
  totalScore?: number;
  questions: { questionId: string; order: number; score: number }[];
}

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    loadPapers();
  }, []);

  const loadPapers = async () => {
    try {
      const result = await paperApi.list({ limit: 50 });
      setPapers(result.items || []);
    } catch (error) {
      console.error('Failed to load papers:', error);
    } finally {
      setLoadingPapers(false);
    }
  };

  const handleExport = async (paperId: string, format: 'pdf' | 'docx') => {
    setExportingId(paperId);
    try {
      const blob = format === 'pdf'
        ? await paperApi.exportPdf(paperId)
        : await paperApi.exportDocx(paperId);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `试卷.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(err);
      alert(err?.userMessage || '导出失败');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportAnswer = async (paperId: string) => {
    setExportingId(paperId);
    try {
      const blob = await paperApi.exportAnswer(paperId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `答案卷.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(err);
      alert(err?.userMessage || '导出答案卷失败');
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (paperId: string) => {
    if (!confirm('确定要删除这份试卷吗？此操作不可撤销。')) return;
    try {
      await paperApi.delete(paperId);
      setPapers(prev => prev.filter(p => p.id !== paperId));
    } catch (err: any) {
      alert(err?.userMessage || '删除失败');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">我的试卷</h1>
            <p className="text-muted-foreground">管理和导出已创建的试卷</p>
          </div>
          <Link href="/papers/create">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              创建试卷
            </Button>
          </Link>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <List className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">已创建的试卷</h2>
          </div>

          {loadingPapers ? (
            <div className="text-muted-foreground text-center py-8">加载中...</div>
          ) : papers.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              暂无试卷，点击右上角"创建试卷"开始组卷
            </div>
          ) : (
            <div className="space-y-3">
              {papers.map((paper) => (
                <div
                  key={paper.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{paper.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {paper.questions?.length || 0} 道题 · 总分: {paper.totalScore || 0}分
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(paper.id, 'pdf')}
                      disabled={exportingId === paper.id}
                      className="gap-1"
                    >
                      <Download className="w-4 h-4" />
                      {exportingId === paper.id ? '导出中...' : 'PDF'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(paper.id, 'docx')}
                      disabled={exportingId === paper.id}
                      className="gap-1"
                    >
                      <FileDown className="w-4 h-4" />
                      Word
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExportAnswer(paper.id)}
                      disabled={exportingId === paper.id}
                      className="gap-1"
                    >
                      📝 答案卷
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(paper.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
