'use client';

import { useEffect, useState, useCallback } from 'react';
import { QuestionUploader, QuestionAnalysisResult } from '@/components/question/QuestionUploader';
import { QuestionEditor } from '@/components/question/QuestionEditor';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';

export default function Home() {
  const [step, setStep] = useState<'upload' | 'edit' | 'success'>('upload');
  const [currentQuestion, setCurrentQuestion] = useState<QuestionAnalysisResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleAnalyzed = useCallback((data: QuestionAnalysisResult, file: File) => {
    setCurrentQuestion(data);
    setCurrentFile(file);
    setStep('edit');
  }, []);

  const handleSave = useCallback((savedData: QuestionAnalysisResult) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Saved:', savedData);
    }
    setStep('success');
  }, []);

  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        setStep('upload');
        setCurrentQuestion(null);
        setCurrentFile(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            题目上传
          </h1>
          <p className="text-muted-foreground">
            上传题目图片，AI 自动识别并结构化，一键存入题库
          </p>
        </div>

        {step === 'upload' && (
          <Card className="p-8">
            <QuestionUploader onAnalyzed={handleAnalyzed} />
          </Card>
        )}

        {step === 'edit' && currentQuestion && (
          <QuestionEditor
            initialData={currentQuestion}
            file={currentFile}
            onSave={handleSave}
            onCancel={() => {
              setStep('upload');
              setCurrentQuestion(null);
              setCurrentFile(null);
            }}
          />
        )}

        {step === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-green-900">题目入库成功！</h3>
            <p className="mt-2 text-sm text-green-600">
              正在跳转回上传页面...
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
