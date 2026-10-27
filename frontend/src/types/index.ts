// TypeScript types for LearnOn

export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  role: 'student' | 'admin';
}

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  role: string;
  learning_goals?: string;
  preferred_language: string;
  subjects: string[];
  daily_study_minutes: number;
  preferred_formats: string[];
  onboarding_complete: boolean;
  timezone: string;
}

export interface Document {
  id: number;
  title: string;
  filename: string;
  file_size: number;
  page_count: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  summary?: string;
  subject?: string;
  created_at: string;
  error_message?: string;
}

export interface DocumentPage {
  page_number: number;
  text: string;
  heading?: string;
  chapter?: string;
}

export interface ChatMessage {
  id: number;
  conversation_id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{ page_number?: number; excerpt: string }>;
  mastery_level_used?: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  title?: string;
  mode: 'document' | 'general';
  document_id?: number;
  updated_at: string;
}

export interface QuizQuestion {
  text: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'long_answer';
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  source_page?: number;
  topic_name?: string;
}

export interface QuizAttempt {
  id: number;
  topic_name?: string;
  total_questions: number;
  correct_count: number;
  score_percent: number;
  started_at: string;
  completed_at?: string;
}

export interface TopicMastery {
  topic_name: string;
  mastery_level: 'unknown' | 'beginner' | 'intermediate' | 'advanced';
  mastery_score: number;   // 0–100
  quiz_accuracy: number;   // 0–100
  attempts: number;
}

export interface StudySession {
  id: number;
  subject?: string;
  topic?: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  status: 'active' | 'paused' | 'completed';
  is_pomodoro: boolean;
  is_manual_entry: boolean;
}

export interface StudyTask {
  id: number;
  title: string;
  description?: string;
  topic_name?: string;
  scheduled_date?: string;
  estimated_minutes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'postponed';
  priority: number;
  reason?: string;
}

export interface StudyPlan {
  id: number;
  title: string;
  start_date?: string;
}

export interface AnalyticsSummary {
  total_study_hours: number;
  weekly_study_hours: number;
  today_study_hours: number;
  completed_sessions: number;
  average_quiz_score: number;
  mastered_topics: number;
  daily_average_minutes: number;
}

export interface DailyHours {
  date: string;
  hours: number;
}

export interface SubjectDistribution {
  subject: string;
  hours: number;
}

export interface QuizScoreTrend {
  date: string;
  score: number;
  topic: string;
  questions: number;
}

export interface HeatmapEntry {
  date: string;
  minutes: number;
}

export interface LearningInsight {
  id: number;
  insight_type: string;
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
  is_dismissed: boolean;
  created_at: string;
}

export interface MLScorePrediction {
  estimated_quiz_score: number;
  note: string;
  data_source_warning?: string;
}

export interface MLRiskPrediction {
  struggle_risk: 'low_risk' | 'medium_risk' | 'high_risk';
  probabilities: Record<string, number>;
  note: string;
}

export interface SRSResult {
  next_review_days: number;
  next_review_date: string;
  new_easiness_factor: number;
  new_repetition_number: number;
  quality_score: number;
  note: string;
}

export interface DiagnosticTopicReport {
  topic: string;
  category: string;
  complexity: number;
  description: string;
  status: 'mastered' | 'gap_detected' | 'misconception_alert' | 'prerequisite_blocked';
  mastery_score: number;
  quiz_accuracy: number;
  attempts: number;
  avg_response_time: number;
  prerequisites: string[];
  prerequisite_health: number;
  dependents: string[];
  root_causes: Array<{
    topic: string;
    mastery_score: number;
    distance_upstream: number;
    blocking_target: string;
    severity: string;
  }>;
  downstream_risks: string[];
  decision_tree: {
    predicted_state: string;
    confidence: number;
    probabilities: Record<string, number>;
    decision_path: string;
  };
  rule_diagnoses: Array<{
    rule_id: string;
    severity: string;
    title: string;
    explanation: string;
    prescriptive_action: string;
    ai_tutor_prompt: string;
  }>;
}

export interface DiagnosticReportResponse {
  summary: {
    total_concepts: number;
    mastered_count: number;
    knowledge_gaps_count: number;
    active_misconceptions_count: number;
    prerequisite_blocked_count: number;
    readiness_index: number;
  };
  topics: DiagnosticTopicReport[];
  dependency_edges: Array<{ from: string; to: string }>;
}
