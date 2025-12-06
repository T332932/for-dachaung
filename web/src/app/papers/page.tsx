'use client';

import { useState } from 'react';
import { paperApi } from '@/lib/api-client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { FileText, Save, LayoutTemplate } from 'lucide-react';

type Slot = { order: number; questionType: string; defaultScore: number };

const templates: Record<string, { name: string; slots: Slot[]; total: number }> = {
  gaokao_new_1: {
    name: '2025 全国卷 I（新高考）',
    total: 150,
    slots: [
      ...Array.from({ length: 8 }, (_, i) => ({ order: i + 1, questionType: 'choice', defaultScore: 5 })),
      ...Array.from({ length: 3 }, (_, i) => ({ order: 9 + i, questionType: 'multi', defaultScore: 6 })),
      ...Array.from({ length: 3 }, (_, i) => ({ order: 12 + i, questionType: 'fillblank', defaultScore: 5 })),
      ...[13, 15, 15, 17, 17].map((sc, idx) => ({ order: 15 + idx, questionType: 'solve', defaultScore: sc })),
    ],
  },
};

export default function PaperBuilder() {
  const [templateId, setTemplateId] = useState<keyof typeof templates>('gaokao_new_1');
  const [title, setTitle] = useState('2025 全国卷 I 组卷');
  const [creating, setCreating] = useState(false);
  const tpl = templates[templateId];
  const [rows, setRows] = useState(
    tpl.slots.map((s) => ({ ...s, questionId: '', score: s.defaultScore }))
  );

  const handleTemplateChange = (id: keyof typeof templates) => {
    setTemplateId(id);
    const t = templates[id];
    setRows(t.slots.map((s) => ({ ...s, questionId: '', score: s.defaultScore })));
    setTitle(`${t.name} 组卷`);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('请填写试卷标题');
      return;
    }
    if (rows.some((r) => !r.questionId.trim())) {
      alert('所有槽位都需要填 questionId');
      return;
    }
    setCreating(true);
    try {
      await paperApi.create({
        title: title.trim(),
        templateType: templateId,
        questions: rows.map((r) => ({
          questionId: r.questionId.trim(),
          order: r.order,
          score: Number(r.score) || r.defaultScore,
        })),
        totalScore: tpl.total,
      });
      alert('创建成功');
    } catch (err: any) {
      console.error(err);
      alert(err?.userMessage || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">模板组卷</h1>
            <p className="text-muted-foreground">基于标准考试模板快速生成试卷</p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={creating}
            className="gap-2"
          >
            {creating ? '创建中...' : (
              <>
                <Save className="w-4 h-4" />
                生成试卷
              </>
            )}
          </Button>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">选择模板</label>
              <div className="relative">
                <LayoutTemplate className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <select
                  className="w-full h-11 pl-10 pr-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={templateId}
                  onChange={(e) => handleTemplateChange(e.target.value as keyof typeof templates)}
                >
                  {Object.entries(templates).map(([id, t]) => (
                    <option key={id} value={id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-2">试卷标题</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                leftIcon={<FileText className="w-4 h-4" />}
                placeholder="请输入试卷标题"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">题号</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">题型</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-32">分值</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">关联题目 ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, idx) => (
                  <tr key={row.order} className="bg-card hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{row.order}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md bg-secondary text-xs font-medium">
                        {row.questionType === 'choice' ? '选择题' :
                          row.questionType === 'multi' ? '多选题' :
                            row.questionType === 'fillblank' ? '填空题' :
                              row.questionType === 'solve' ? '解答题' :
                                row.questionType === 'proof' ? '证明题' : row.questionType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={row.score}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setRows((prev) =>
                            prev.map((r) =>
                              r.order === row.order ? { ...r, score: val } : r
                            )
                          );
                        }}
                        className="h-8 text-center"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        placeholder="输入题目 ID"
                        value={row.questionId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((prev) =>
                            prev.map((r) =>
                              r.order === row.order ? { ...r, questionId: val } : r
                            )
                          );
                        }}
                        className="h-8 font-mono text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
