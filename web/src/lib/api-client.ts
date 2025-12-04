import axios from 'axios';

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:8000';
};

const API_URL = getBaseUrl();
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
  timeout: 30000, // 30秒超时，AI分析可能需要较长时间
});

// 添加响应拦截器，统一处理错误
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 处理网络错误
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      error.userMessage = '请求超时，请检查网络连接或稍后重试';
    } else if (error.response) {
      // 处理HTTP错误响应
      const status = error.response.status;
      let data = error.response.data;

      // 如果返回的是 Blob，尝试读取文本
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          data = JSON.parse(text);
        } catch {
          /* ignore */
        }
      }
      
      if (status === 400) {
        error.userMessage = data?.detail || '请求参数错误';
      } else if (status === 401) {
        error.userMessage = '未授权，请重新登录';
      } else if (status === 403) {
        error.userMessage = '权限不足';
      } else if (status === 404) {
        error.userMessage = '请求的资源不存在';
      } else if (status === 422) {
        // 验证错误
        error.userMessage = data?.detail || '数据验证失败，请检查输入';
      } else if (status >= 500) {
        error.userMessage = '服务器错误，请稍后重试';
      } else {
        error.userMessage = data?.detail || data?.error || '请求失败';
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      error.userMessage = '网络错误，请检查网络连接';
    } else {
      error.userMessage = '请求失败，请重试';
    }
    
    return Promise.reject(error);
  }
);

// 题目相关 API
export const questionApi = {
  // 上传图片并分析
  analyze: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/teacher/questions/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 上传并生成预览（解析 + latex + svg png）
  preview: async (file: File, opts?: { includeAnswer?: boolean; includeExplanation?: boolean }): Promise<{
    analysis?: Record<string, unknown>;
    latex?: string;
    svgPng?: string | null;
  }> => {
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
    return response.data as {
      analysis?: Record<string, unknown>;
      latex?: string;
      svgPng?: string | null;
    };
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
