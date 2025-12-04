import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;

export interface QuestionPayload {
  questionText: string;
  options?: string[] | null;
  answer: string;
  explanation?: string | null;
  hasGeometry: boolean;
  geometrySvg?: string | null;
  geometryTikz?: string | null;
  knowledgePoints?: string[];
  difficulty?: string;
  questionType?: string;
  source?: string | null;
  year?: number | null;
  aiGenerated?: boolean;
}

export interface PaperQuestionInput {
  questionId: string;
  order: number;
  score: number;
  customLabel?: string;
}

export interface PaperPayload {
  title: string;
  description?: string;
  templateType: string;
  questions: PaperQuestionInput[];
  totalScore?: number;
  timeLimit?: number;
  tags?: string[];
  subject?: string;
  gradeLevel?: string;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
  },
});

// 题目相关 API
export const questionApi = {
  // 上传图片并分析
  analyze: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/teacher/questions/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data as unknown;
  },

  // 上传并生成预览（解析 + latex + svg png）
  preview: async (file: File, opts?: { includeAnswer?: boolean; includeExplanation?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(
      '/api/teacher/questions/preview',
      formData,
      {
        params: {
          format: 'json',
          include_answer: opts?.includeAnswer ?? true,
          include_explanation: opts?.includeExplanation ?? false,
        },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data as unknown;
  },

  // 下载单题 PDF 预览
  previewPdf: async (file: File, opts?: { includeAnswer?: boolean; includeExplanation?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(
      '/api/teacher/questions/preview',
      formData,
      {
        params: {
          format: 'pdf',
          include_answer: opts?.includeAnswer ?? true,
          include_explanation: opts?.includeExplanation ?? false,
        },
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data as Blob;
  },

  // 保存题目
  create: async (data: QuestionPayload) => {
    const response = await api.post('/api/teacher/questions', data);
    return response.data;
  },

  // 获取题目列表
  list: async (params?: Record<string, unknown>) => {
    const response = await api.get('/api/teacher/questions', { params });
    return response.data;
  },
};

// 试卷相关 API
export const paperApi = {
  create: async (data: PaperPayload) => {
    const response = await api.post('/api/teacher/papers', data);
    return response.data;
  },

  list: async (params?: Record<string, unknown>) => {
    const response = await api.get('/api/teacher/papers', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/api/teacher/papers/${id}`);
    return response.data;
  },
};
