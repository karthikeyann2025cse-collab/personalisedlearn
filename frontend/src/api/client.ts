import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('learnon_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-redirect on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('learnon_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    api.post('/auth/register', data),
  login: (email: string, password: string) => {
    const form = new FormData();
    form.append('username', email);
    form.append('password', password);
    return api.post<{ access_token: string }>('/auth/login', form);
  },
  me: () => api.get('/auth/me'),
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileApi = {
  get: () => api.get('/profile/'),
  update: (data: Record<string, unknown>) => api.patch('/profile/', data),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentsApi = {
  upload: (file: File, subject?: string, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    if (subject) form.append('subject', subject);
    return api.post('/documents/upload', form, {
      onUploadProgress: (evt) => {
        if (evt.total && onProgress) onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    });
  },
  list: () => api.get('/documents/'),
  get: (id: number) => api.get(`/documents/${id}`),
  pages: (id: number) => api.get(`/documents/${id}/pages`),
  delete: (id: number) => api.delete(`/documents/${id}`),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chatApi = {
  sendMessage: (data: {
    content: string;
    document_id?: number;
    conversation_id?: number;
    language?: string;
  }) => api.post('/chat/message', data),
  listConversations: () => api.get('/chat/conversations'),
  getMessages: (convId: number) => api.get(`/chat/conversations/${convId}/messages`),
  deleteConversation: (convId: number) => api.delete(`/chat/conversations/${convId}`),
};

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export const quizApi = {
  generate: (data: {
    document_id?: number;
    topic: string;
    num_questions?: number;
    question_type?: string;
    difficulty?: string;
    marks?: number;
  }) => api.post('/quiz/generate', data),
  submitAnswer: (data: {
    attempt_id: number;
    question_data: Record<string, unknown>;
    user_answer: string;
    time_taken_seconds?: number;
  }) => api.post('/quiz/submit-answer', data),
  completeAttempt: (attempt_id: number, correct_count: number, total_questions: number) =>
    api.post('/quiz/complete-attempt', null, { params: { attempt_id, correct_count, total_questions } }),
  getExamAnswer: (data: { document_id?: number; question: string; marks: number; language?: string }) =>
    api.post('/quiz/exam-answer', data),
  listAttempts: () => api.get('/quiz/attempts'),
  getMastery: () => api.get('/quiz/mastery'),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessionsApi = {
  start: (data: { subject?: string; topic?: string; document_id?: number; is_pomodoro?: boolean }) =>
    api.post('/sessions/start', data),
  stop: (session_id: number, duration_seconds: number) =>
    api.post('/sessions/stop', { session_id, duration_seconds }),
  pause: (id: number) => api.post(`/sessions/pause/${id}`),
  resume: (id: number) => api.post(`/sessions/resume/${id}`),
  addManual: (data: { subject?: string; topic?: string; start_time: string; end_time: string; notes?: string }) =>
    api.post('/sessions/manual', data),
  list: (params?: { from_dt?: string; to_dt?: string }) => api.get('/sessions/', { params }),
  delete: (id: number) => api.delete(`/sessions/${id}`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  summary: () => api.get('/analytics/summary'),
  dailyHours: (days?: number) => api.get('/analytics/daily-hours', { params: { days } }),
  subjectDist: () => api.get('/analytics/subject-distribution'),
  quizTrend: (limit?: number) => api.get('/analytics/quiz-trend', { params: { limit } }),
  topicMastery: () => api.get('/analytics/topic-mastery'),
  heatmap: (weeks?: number) => api.get('/analytics/heatmap', { params: { weeks } }),
};

// ─── Planner ──────────────────────────────────────────────────────────────────

export const plannerApi = {
  generate: (upcoming_deadlines?: unknown[]) =>
    api.post('/planner/generate', { upcoming_deadlines }),
  getCurrent: () => api.get('/planner/current'),
  updateTask: (task_id: number, status: string, postpone_days?: number) =>
    api.patch(`/planner/tasks/${task_id}`, { status, postpone_days }),
};

// ─── ML ───────────────────────────────────────────────────────────────────────

export const mlApi = {
  predictScore: (features: Record<string, number>) => api.post('/ml/predict-score', features),
  predictRisk: (data: Record<string, unknown>) => api.post('/ml/predict-risk', data),
  spacedRepetition: (data: Record<string, unknown>) => api.post('/ml/spaced-repetition', data),
  trainAll: () => api.post('/ml/train-all'),
  getDiagnosticReport: () => api.get('/ml/diagnostic/report'),
  analyzeTopic: (data: { topic_name: string; mastery_score?: number; quiz_accuracy?: number; attempts?: number; avg_response_time?: number }) =>
    api.post('/ml/diagnostic/analyze-topic', data),
  getDependencyGraph: () => api.get('/ml/diagnostic/dependency-graph'),
};
