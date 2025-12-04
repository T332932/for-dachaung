import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
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
    return response.data;
  },

  // 保存题目
  create: async (data: any) => {
    const response = await api.post('/api/teacher/questions', data);
    return response.data;
  },

  // 获取题目列表
  list: async (params: any) => {
    const response = await api.get('/api/teacher/questions', { params });
    return response.data;
  },
};

// 试卷相关 API
export const paperApi = {
  create: async (data: any) => {
    const response = await api.post('/api/teacher/papers', data);
    return response.data;
  },

  list: async (params: any) => {
    const response = await api.get('/api/teacher/papers', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/api/teacher/papers/${id}`);
    return response.data;
  },
};

