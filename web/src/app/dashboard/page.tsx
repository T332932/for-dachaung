'use client';

import { useCallback, useState, useEffect } from 'react';
import { questionApi } from '@/lib/api-client';
import { MathText } from '@/components/ui/MathText';
import { QuestionAnalysisResult } from '@/components/question/QuestionUploader';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

type ItemStatus = 'pending' | 'processing' | 'ready' | 'error' | 'saved' | 'ingesting';

// 存储版本（用 base64 存储文件）
interface StoredItem {
  id: string;
  name: string;
  base64: string; // 文件的 base64
  mimeType: string;
  status: ItemStatus;
  result?: QuestionAnalysisResult;
  error?: string;
}

interface QueueItem {
  id: string;
  file: File;
  name: string;
  status: ItemStatus;
  result?: QuestionAnalysisResult;
  error?: string;
}

const STORAGE_KEY = 'zujuan_upload_queue';

// base64 转 File
function base64ToFile(base64: string, name: string, mimeType: string): File {
  const byteString = atob(base64.split(',')[1] || base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], name, { type: mimeType });
}

// File 转 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 从 localStorage 恢复
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredItem[] = JSON.parse(stored);
        const restored: QueueItem[] = parsed
          .filter(item => item.status !== 'saved') // 不恢复已入库的
          .map(item => ({
            id: item.id,
            name: item.name,
            file: base64ToFile(item.base64, item.name, item.mimeType),
            status: item.status === 'processing' || item.status === 'ingesting' ? 'pending' : item.status,
            result: item.result,
            error: item.error,
          }));
        setItems(restored);
      }
    } catch (e) {
      console.error('Failed to restore upload queue:', e);
    }
    setLoaded(true);
  }, []);

  // 保存到 localStorage
  const saveToStorage = useCallback(async (newItems: QueueItem[]) => {
    if (typeof window === 'undefined') return;
    try {
      const toStore: StoredItem[] = await Promise.all(
        newItems
          .filter(item => item.status !== 'saved') // 已入库的不存
          .map(async (item) => ({
            id: item.id,
            name: item.name,
            base64: await fileToBase64(item.file),
            mimeType: item.file.type,
            status: item.status,
            result: item.result,
            error: item.error,
          }))
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.error('Failed to save upload queue:', e);
    }
  }, []);

  // 更新 items 并同步存储
  const updateItems = useCallback((updater: (prev: QueueItem[]) => QueueItem[]) => {
    setItems(prev => {
      const next = updater(prev);
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: QueueItem[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
      status: 'pending' as ItemStatus,
    }));
    const allItems = [...items, ...newItems];
    setItems(allItems);
    await saveToStorage(allItems);
  };

  const removeItem = (id: string) => {
    updateItems(prev => prev.filter(it => it.id !== id));
  };

  const runPreview = useCallback(async (item: QueueItem) => {
    updateItems(prev => prev.map((it) => (it.id === item.id ? { ...it, status: 'processing', error: undefined } : it)));
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
      updateItems(prev =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'ready', result: merged, error: undefined } : it)),
      );
    } catch (err: any) {
      updateItems(prev =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'error', error: err?.message || '解析失败' } : it)),
      );
    }
  }, [updateItems]);

  const runAll = async () => {
    setIsUploading(true);
    for (const it of items) {
      if (it.status === 'pending' || it.status === 'error') {
        await runPreview(it);
      }
    }
    setIsUploading(false);
  };

  const ingestItem = async (item: QueueItem) => {
    updateItems(prev => prev.map((it) => (it.id === item.id ? { ...it, status: 'ingesting', error: undefined } : it)));
    try {
      await questionApi.ingest(item.file);
      updateItems(prev =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'saved', error: undefined } : it)),
      );
    } catch (err: any) {
      updateItems(prev =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'error', error: err?.userMessage || err?.message || '入库失败' } : it)),
      );
    }
  };

  const ingestAll = async () => {
    setIsUploading(true);
    for (const it of items) {
      if (it.status === 'pending' || it.status === 'error') {
        await ingestItem(it);
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
    updateItems(prev => prev.map((it) => (it.id === item.id ? { ...it, status: 'processing' } : it)));
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
      updateItems(prev => prev.map((it) => (it.id === item.id ? { ...it, status: 'saved' } : it)));
    } catch (err: any) {
      alert(err?.userMessage || '入库失败');
      updateItems(prev =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'ready', error: err?.message } : it)),
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const clearSaved = () => {
    updateItems(prev => prev.filter(it => it.status !== 'saved'));
  };

  if (!loaded) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      </DashboardLayout>
    );
  }

  const savedCount = items.filter(it => it.status === 'saved').length;
  const pendingItems = items.filter(it => it.status !== 'saved');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">题目上传</h1>
          <p className="text-muted-foreground">上传题目图片，AI 自动识别并入库</p>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <p className="font-medium text-foreground mb-2">拖拽或点击选择图片文件</p>
            <input
              type="file"
              multiple
              accept="image/*"
              className="mt-2"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              onClick={runAll}
              disabled={isUploading || pendingItems.length === 0}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 font-medium"
            >
              {isUploading ? '处理中…' : '解析预览'}
            </button>
            <button
              onClick={ingestAll}
              disabled={isUploading || pendingItems.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
            >
              {isUploading ? '处理中…' : '✨ 快速入库（无需预览）'}
            </button>
            {savedCount > 0 && (
              <button
                onClick={clearSaved}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-secondary"
              >
                清除已入库 ({savedCount})
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            💡 上传的文件会保存在本地，刷新页面不会丢失。入库后自动清除。
          </p>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-card p-4 rounded-xl border border-border">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    状态：{item.status === 'pending' ? '待处理' :
                      item.status === 'processing' ? '解析中...' :
                        item.status === 'ingesting' ? '入库中...' :
                          item.status === 'ready' ? '已解析' :
                            item.status === 'saved' ? '✅ 已入库' :
                              '❌ 失败'}
                  </div>
                  {item.error && <div className="text-xs text-destructive">错误：{item.error}</div>}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="px-3 py-1 border border-destructive text-destructive rounded-lg text-sm hover:bg-destructive/10"
                  >
                    删除
                  </button>
                  <button
                    onClick={() => runPreview(item)}
                    disabled={item.status === 'processing' || item.status === 'ingesting'}
                    className="px-3 py-1 border border-border rounded-lg text-sm hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    重新解析
                  </button>
                  <button
                    onClick={() => ingestItem(item)}
                    disabled={item.status === 'saved' || item.status === 'ingesting'}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
                  >
                    快速入库
                  </button>
                  <button
                    onClick={() => saveItem(item)}
                    disabled={!validateForSave(item.result) || item.status !== 'ready'}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    审核后入库
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
