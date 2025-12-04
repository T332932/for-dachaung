'use client';

import { useState } from 'react';
import { QuestionUploader } from '@/components/question/QuestionUploader';
import { QuestionEditor } from '@/components/question/QuestionEditor';

export default function Home() {
  const [step, setStep] = useState<'upload' | 'edit' | 'success'>('upload');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);

  const handleAnalyzed = (data: any) => {
    setCurrentQuestion(data);
    setStep('edit');
  };

  const handleSave = (savedData: any) => {
    console.log('Saved:', savedData);
    setStep('success');
    // 3秒后返回上传页
    setTimeout(() => {
      setStep('upload');
      setCurrentQuestion(null);
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">
            AI 智能组卷平台
          </h1>
          <p className="mt-2 text-gray-600">
            上传题目图片，AI 自动识别并结构化，一键存入题库
          </p>
        </div>

        {step === 'upload' && (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <QuestionUploader onAnalyzed={handleAnalyzed} />
          </div>
        )}

        {step === 'edit' && currentQuestion && (
          <QuestionEditor
            initialData={currentQuestion}
            onSave={handleSave}
            onCancel={() => setStep('upload')}
          />
        )}

        {step === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
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
    </main>
  );
}
