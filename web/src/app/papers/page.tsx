'use client';

import { useState } from 'react';
import { paperApi } from '@/lib/api-client';

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
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h1 className="text-2xl font-bold mb-4">组卷（模板填槽）</h1>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">模板</label>
              <select
                className="mt-1 w-full px-3 py-2 border rounded-md bg-white text-sm"
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value as keyof typeof templates)}
              >
                {Object.entries(templates).map(([id, t]) => (
                  <option key={id} value={id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">试卷标题</label>
              <input
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">题号</th>
                  <th className="px-3 py-2 text-left">题型</th>
                  <th className="px-3 py-2 text-left">分值</th>
                  <th className="px-3 py-2 text-left">questionId</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.order} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 font-mono">{row.order}</td>
                    <td className="px-3 py-2">{row.questionType}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-16 px-2 py-1 border rounded"
                        type="number"
                        value={row.score}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((prev) =>
                            prev.map((r) =>
                              r.order === row.order ? { ...r, score: val } : r
                            )
                          );
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full px-2 py-1 border rounded"
                        placeholder="questionId"
                        value={row.questionId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((prev) =>
                            prev.map((r) =>
                              r.order === row.order ? { ...r, questionId: val } : r
                            )
                          );
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? '创建中...' : '创建试卷'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
