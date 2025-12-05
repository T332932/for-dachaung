'use client';

import { useCallback, useState } from 'react';
import { questionApi } from '@/lib/api-client';
import { MathText } from '@/components/ui/MathText';
import { QuestionAnalysisResult } from '@/components/question/QuestionUploader';

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
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h1 className="text-2xl font-bold mb-4">批量上传 / 预览 / 入库</h1>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-gray-600 cursor-pointer hover:border-blue-400"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <p className="font-medium">拖拽或点击选择多个图片文件</p>
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? '解析中…' : '解析全部'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">状态：{item.status}</div>
                  {item.error && <div className="text-xs text-red-500">错误：{item.error}</div>}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => runPreview(item)}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
                  >
                    重新生成
                  </button>
                  <button
                    onClick={() => saveItem(item)}
                    disabled={!validateForSave(item.result) || item.status !== 'ready'}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50"
                  >
                    入库
                  </button>
                </div>
              </div>

              {item.result && (
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <div className="font-semibold text-gray-700">题干</div>
                    <div className="p-2 border rounded bg-gray-50">
                      <MathText>{item.result.questionText || ''}</MathText>
                    </div>
                  </div>
                  {item.result.options && item.result.options.length > 0 && (
                    <div>
                      <div className="font-semibold text-gray-700">选项</div>
                      <div className="p-2 border rounded bg-gray-50 space-y-1">
                        {item.result.options.map((opt, idx) => (
                          <MathText key={idx}>{opt}</MathText>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-700">答案</div>
                    <div className="p-2 border rounded bg-gray-50">
                      <MathText>{item.result.answer || ''}</MathText>
                    </div>
                  </div>
                  {item.result.svgPng && (
                    <div>
                      <div className="font-semibold text-gray-700">几何图预览</div>
                      <div className="p-2 border rounded bg-white flex justify-center">
                        <img src={item.result.svgPng} className="max-h-64" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center text-sm text-gray-500">尚未添加文件</div>
          )}
        </div>
      </div>
    </main>
  );
}
