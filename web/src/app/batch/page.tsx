'use client';

import { useCallback, useState } from 'react';
import { questionApi } from '@/lib/api-client';
import { MathText } from '@/components/ui/MathText';
import { QuestionAnalysisResult } from '@/components/question/QuestionUploader';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

type ItemStatus = 'pending' | 'processing' | 'ready' | 'error' | 'saved';

interface QueueItem {
  id: string;
  file: File;
  name: string;
  status: ItemStatus;
  result?: QuestionAnalysisResult;
  error?: string;
}

export default function BatchUploader() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: QueueItem[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
      status: 'pending',
    }));
    setItems((prev) => [...prev, ...newItems]);
  };

  const runPreview = useCallback(async (item: QueueItem) => {
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'processing', error: undefined } : it)));
    try {
      const result = (await questionApi.preview(item.file)) as any;
      const merged: QuestionAnalysisResult = {
        ...(result?.analysis || result || {}),
        svgPng: result?.svgPng || null,
        latex: result?.latex,
      };
      if (!merged.questionText?.trim() || !merged.answer?.trim() || !merged.questionType) {
        throw new Error('解析结果缺少题干/答案/题型');
      }
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'ready', result: merged, error: undefined } : it)),
      );
    } catch (err: any) {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'error', error: err?.message || '解析失败' } : it)),
      );
    }
  }, []);

  const runAll = async () => {
    setIsUploading(true);
    for (const it of items) {
      if (it.status === 'pending' || it.status === 'error') {
        // eslint-disable-next-line no-await-in-loop
        await runPreview(it);
      }
    }
    setIsUploading(false);
  };

  const validateForSave = (res?: QuestionAnalysisResult) => {
    if (!res?.questionText?.trim() || !res.answer?.trim() || !res.questionType) return false;
    if ((res.questionType === 'choice' || res.questionType === 'multi') && (!res.options || res.options.length === 0)) {
      return false;
    }
    return true;
  };

  const saveItem = async (item: QueueItem) => {
    const res = item.result;
    if (!validateForSave(res)) {
      alert('题干/答案/题型或选项不完整');
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'processing' } : it)));
    try {
      await questionApi.create({
        questionText: res?.questionText || '',
        options: res?.options || null,
        answer: res?.answer || '',
        explanation: undefined,
        hasGeometry: Boolean(res?.hasGeometry),
        geometrySvg: res?.geometrySvg || null,
        geometryTikz: null,
        knowledgePoints: res?.knowledgePoints || [],
        difficulty: res?.difficulty || 'medium',
        questionType: res?.questionType || 'solve',
        source: undefined,
        year: undefined,
        aiGenerated: true,
        isPublic: false,
      });
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'saved' } : it)));
    } catch (err: any) {
      alert(err?.userMessage || '入库失败');
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'ready', error: err?.message } : it)),
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">批量上传</h1>
          <p className="text-muted-foreground">上传多个题目图片，AI 自动识别并入库</p>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <p className="font-medium text-foreground mb-2">拖拽或点击选择多个图片文件</p>
            <input
              type="file"
              multiple
              accept="image/*"
              className="mt-2"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={runAll}
              disabled={isUploading || items.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
            >
              {isUploading ? '解析中…' : '解析全部'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-card p-4 rounded-xl border border-border">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground">状态：{item.status}</div>
                  {item.error && <div className="text-xs text-destructive">错误：{item.error}</div>}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => runPreview(item)}
                    className="px-3 py-1 border border-border rounded-lg text-sm hover:bg-secondary transition-colors"
                  >
                    重新生成
                  </button>
                  <button
                    onClick={() => saveItem(item)}
                    disabled={!validateForSave(item.result) || item.status !== 'ready'}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    入库
                  </button>
                </div>
              </div>

              {item.result && (
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <div className="font-semibold text-muted-foreground">题干</div>
                    <div className="p-2 border border-border rounded-lg bg-secondary/50">
                      <MathText>{item.result.questionText || ''}</MathText>
                    </div>
                  </div>
                  {item.result.options && item.result.options.length > 0 && (
                    <div>
                      <div className="font-semibold text-muted-foreground">选项</div>
                      <div className="p-2 border border-border rounded-lg bg-secondary/50 space-y-1">
                        {item.result.options.map((opt, idx) => (
                          <MathText key={idx}>{opt}</MathText>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-muted-foreground">答案</div>
                    <div className="p-2 border border-border rounded-lg bg-secondary/50">
                      <MathText>{item.result.answer || ''}</MathText>
                    </div>
                  </div>
                  {item.result.svgPng && (
                    <div>
                      <div className="font-semibold text-muted-foreground">几何图预览</div>
                      <div className="p-2 border border-border rounded-lg bg-card flex justify-center">
                        <img src={item.result.svgPng} className="max-h-64" alt="几何图" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">尚未添加文件</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
