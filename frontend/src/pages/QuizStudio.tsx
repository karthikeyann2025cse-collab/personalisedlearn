import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  Award,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Brain,
  Zap,
  Layers,
  Volume2,
  VolumeX,
  Timer as TimerIcon,
  Lightbulb,
  Bookmark,
  Share2,
} from 'lucide-react';
import { quizApi, documentsApi, mlApi } from '../api/client';

export const QuizStudio: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'generate' | 'active' | 'flashcards' | 'results' | 'exam' | 'history'>('generate');

  // Generator form
  const [selectedDocId, setSelectedDocId] = useState<number | ''>('');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questionType, setQuestionType] = useState('mcq');
  const [difficulty, setDifficulty] = useState('medium');
  const [quizMode, setQuizMode] = useState<'quiz' | 'flashcards'>('quiz');
  const [timedMode, setTimedMode] = useState<number>(0); // 0 = untimed, 30 = 30s, 60 = 60s

  // Active quiz state
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; percentage: number } | null>(null);

  // Question Timer state
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number>(0);

  // Flashcards state
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardRatings, setFlashcardRatings] = useState<Record<number, string>>({});
  const [srsMessage, setSrsMessage] = useState<string | null>(null);

  // Exam Q&A State
  const [examDocId, setExamDocId] = useState<number | ''>('');
  const [examQuestion, setExamQuestion] = useState('');
  const [examMarks, setExamMarks] = useState(5);
  const [examResponse, setExamResponse] = useState<any>(null);

  // Queries
  const { data: docsRes } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list(),
  });
  const documents: any[] = docsRes?.data?.items || docsRes?.data || [];

  const { data: attemptsRes } = useQuery({
    queryKey: ['quizAttempts'],
    queryFn: () => quizApi.listAttempts(),
    enabled: activeTab === 'history',
  });
  const attempts: any[] = attemptsRes?.data || [];

  const { data: masteryRes } = useQuery({
    queryKey: ['quizMastery'],
    queryFn: () => quizApi.getMastery(),
  });
  const topicMastery: any[] = masteryRes?.data || [];

  // Auto-select first document if available
  useEffect(() => {
    if (documents && documents.length > 0) {
      if (selectedDocId === '') setSelectedDocId(documents[0].id);
      if (examDocId === '') setExamDocId(documents[0].id);
    }
  }, [documents, selectedDocId, examDocId]);

  // Question Timer effect
  useEffect(() => {
    if (activeTab === 'active' && timedMode > 0) {
      setQuestionTimeLeft(timedMode);
      const timer = setInterval(() => {
        setQuestionTimeLeft((prev) => {
          if (prev <= 1) {
            // Auto advance or finish
            if (currentQIndex < quizQuestions.length - 1) {
              setCurrentQIndex((c) => c + 1);
              return timedMode;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeTab, currentQIndex, timedMode, quizQuestions.length]);

  const [generateError, setGenerateError] = useState<string | null>(null);

  // Generate Quiz Mutation
  const generateMutation = useMutation({
    mutationFn: () => {
      setGenerateError(null);
      return quizApi.generate({
        document_id: selectedDocId ? Number(selectedDocId) : undefined,
        topic: topic.trim() || 'General Subject Knowledge',
        num_questions: numQuestions,
        question_type: questionType,
        difficulty,
      });
    },
    onSuccess: (res) => {
      const generated = res.data?.questions || res.data || [];
      if (generated.length > 0) {
        setQuizQuestions(generated);
        setCurrentQIndex(0);
        setUserAnswers({});
        setFlashcardRatings({});
        setIsFlipped(false);
        setAttemptId(res.data?.attempt_id || null);

        if (quizMode === 'flashcards') {
          setActiveTab('flashcards');
        } else {
          setActiveTab('active');
        }
      } else {
        setGenerateError('No questions could be synthesized. Please try another topic or document.');
      }
    },
    onError: (err: any) => {
      setGenerateError(err?.response?.data?.detail || err?.message || 'Failed to generate questions.');
    },
  });

  // Exam Answer Mutation
  const examMutation = useMutation({
    mutationFn: () =>
      quizApi.getExamAnswer({
        document_id: examDocId ? Number(examDocId) : (documents[0]?.id ? Number(documents[0].id) : undefined),
        question: examQuestion,
        marks: examMarks,
      }),
    onSuccess: (res) => {
      setExamResponse(res.data);
    },
  });

  // Handle Answer Selection
  const handleSelectAnswer = (ans: string) => {
    setUserAnswers((prev) => ({ ...prev, [currentQIndex]: ans }));
  };

  // Flashcard Spaced Repetition rating
  const handleRateFlashcard = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    setFlashcardRatings((prev) => ({ ...prev, [currentQIndex]: rating }));

    const confMap = { again: 1, hard: 2, good: 3, easy: 5 };
    const scoreMap = { again: 0.2, hard: 0.5, good: 0.8, easy: 1.0 };

    try {
      const res = await mlApi.spacedRepetition({
        topic_name: topic || 'General Concept',
        performance_score: scoreMap[rating],
        confidence: confMap[rating],
        repetition_number: 1,
      });
      const days = res.data?.next_review_days || 1;
      setSrsMessage(`Scheduled review in ${days} day${days > 1 ? 's' : ''} (SM-2 Algorithm)`);
      setTimeout(() => setSrsMessage(null), 3500);
    } catch {
      // ignore
    }

    // Auto next card after rating
    if (currentQIndex < quizQuestions.length - 1) {
      setTimeout(() => {
        setIsFlipped(false);
        setCurrentQIndex((prev) => prev + 1);
      }, 300);
    }
  };

  // Complete Quiz & Grade
  const handleFinishQuiz = async () => {
    setIsEvaluating(true);
    let correct = 0;

    for (let idx = 0; idx < quizQuestions.length; idx++) {
      const q = quizQuestions[idx];
      const ans = userAnswers[idx] || '';
      const correctVal = q.correct_answer || q.answer || '';
      const ansTrimmed = ans.trim().toLowerCase();
      const correctTrimmed = correctVal.trim().toLowerCase();

      const isMatch =
        ansTrimmed === correctTrimmed ||
        (ansTrimmed.length > 0 && correctTrimmed.startsWith(ansTrimmed.slice(0, 2))) ||
        (correctTrimmed.length > 0 && ansTrimmed.startsWith(correctTrimmed.slice(0, 2)));

      if (isMatch) {
        correct += 1;
      }

      // Submit individual answer to update student Topic Mastery in database
      if (attemptId) {
        try {
          await quizApi.submitAnswer({
            attempt_id: attemptId,
            question_data: q,
            user_answer: ans || '(No answer provided)',
            time_taken_seconds: timedMode > 0 ? timedMode - questionTimeLeft : 30,
          });
        } catch {
          // ignore individual submission error
        }
      }
    }

    try {
      if (attemptId) {
        await quizApi.completeAttempt(attemptId, correct, quizQuestions.length);
      }
    } catch (e) {
      console.error(e);
    }

    setQuizResult({
      score: correct,
      total: quizQuestions.length,
      percentage: Math.round((correct / quizQuestions.length) * 100),
    });
    queryClient.invalidateQueries({ queryKey: ['quizMastery'] });
    queryClient.invalidateQueries({ queryKey: ['quizAttempts'] });
    queryClient.invalidateQueries({ queryKey: ['diagnostic-report'] });
    setIsEvaluating(false);
    setActiveTab('results');
  };

  // Audio Pronounce question
  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            AI Quiz & Flashcard Studio
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Adaptive tests, SM-2 flashcard drills, and exam-grade step-by-step solutions.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 backdrop-blur-sm self-start md:self-auto gap-1">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'generate'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('exam')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'exam'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Exam Answers
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {/* 1. QUIZ / FLASHCARD GENERATOR */}
        {activeTab === 'generate' && (
          <motion.div
            key="generate"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Form */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Generate Study Module</h2>
                  <p className="text-xs text-slate-400">Synthesizes targeted questions directly from your materials</p>
                </div>
              </div>

              {/* Mode Selector: Quiz vs Flashcards */}
              <div className="grid grid-cols-2 gap-3 mb-5 p-1 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setQuizMode('quiz')}
                  className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    quizMode === 'quiz'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Standard Quiz Mode
                </button>
                <button
                  type="button"
                  onClick={() => setQuizMode('flashcards')}
                  className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    quizMode === 'flashcards'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4" /> AI Flashcards (SM-2)
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Source Document
                  </label>
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">Select a document...</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title || doc.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Focus Topic or Concept
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Backpropagation, Dynamic Programming, Virtual Memory..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Count
                    </label>
                    <select
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Number(e.target.value))}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={3}>3 Items</option>
                      <option value={5}>5 Items</option>
                      <option value={10}>10 Items</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="easy">Easy (Foundational)</option>
                      <option value="medium">Medium (Analytical)</option>
                      <option value="hard">Hard (Synthesis)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Timer Per Item
                    </label>
                    <select
                      value={timedMode}
                      onChange={(e) => setTimedMode(Number(e.target.value))}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={0}>Untimed</option>
                      <option value={30}>30s Speed Run</option>
                      <option value={60}>60s Standard</option>
                    </select>
                  </div>
                </div>

                {generateError && (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2">
                    <XCircle size={16} className="text-red-400 shrink-0" />
                    <span>{generateError}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    disabled={generateMutation.isPending}
                    onClick={() => generateMutation.mutate()}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating {quizMode === 'flashcards' ? 'Flashcards' : 'Quiz'}...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Launch {quizMode === 'flashcards' ? 'Flashcard Deck' : 'Practice Quiz'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Topic Mastery Radar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4 text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                  <h3 className="font-bold text-slate-100">Topic Mastery Radar</h3>
                </div>
                <p className="text-xs text-slate-400 mb-5">
                  Your comprehension score updates dynamically after each completed quiz or flashcard review.
                </p>

                <div className="space-y-4">
                  {topicMastery.length > 0 ? (
                    topicMastery.slice(0, 5).map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">{item.topic || item.topic_name}</span>
                          <span className="text-indigo-400 font-bold">
                            {Math.round((item.mastery_score || item.quiz_accuracy || 0) * (item.mastery_score <= 1 ? 100 : 1))}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((item.mastery_score || 0) * (item.mastery_score <= 1 ? 100 : 1))
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      <Brain className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      Take your first quiz to generate mastery metrics!
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/40">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 mb-1">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  SM-2 Adaptive Spaced Repetition
                </div>
                <p className="text-[11px] text-slate-400">
                  Items you find difficult are scheduled sooner; well-understood concepts are spaced out to reinforce memory retention.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. FLASHCARD MODE */}
        {activeTab === 'flashcards' && quizQuestions.length > 0 && (
          <motion.div
            key="flashcards"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            {/* Header / Progress */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-lg border border-purple-500/30 uppercase">
                  Card {currentQIndex + 1} of {quizQuestions.length}
                </span>
                <span className="text-xs text-slate-400">{topic || 'Flashcard Deck'}</span>
              </div>
              <button
                onClick={() => handleSpeak(isFlipped ? (quizQuestions[currentQIndex]?.explanation || quizQuestions[currentQIndex]?.correct_answer) : (quizQuestions[currentQIndex]?.question || quizQuestions[currentQIndex]?.text))}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Listen to card audio"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* SRS Feedback notification */}
            {srsMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs text-center rounded-xl font-medium"
              >
                ✓ {srsMessage}
              </motion.div>
            )}

            {/* 3D Flip Card Container */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="cursor-pointer min-h-[320px] bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all hover:border-purple-500/50"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="uppercase tracking-wider">
                  {isFlipped ? 'Answer & Explanation' : 'Concept / Question'}
                </span>
                <span className="text-purple-400 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Tap card to flip
                </span>
              </div>

              <div className="my-auto py-6">
                {!isFlipped ? (
                  <h3 className="text-xl sm:text-2xl font-bold text-white text-center leading-relaxed">
                    {quizQuestions[currentQIndex]?.question || quizQuestions[currentQIndex]?.text}
                  </h3>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="inline-block px-4 py-1.5 bg-emerald-500/20 text-emerald-300 font-bold text-base rounded-full border border-emerald-500/40">
                      {quizQuestions[currentQIndex]?.correct_answer || quizQuestions[currentQIndex]?.answer || 'Answer Key'}
                    </div>
                    {quizQuestions[currentQIndex]?.explanation && (
                      <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                        💡 {quizQuestions[currentQIndex]?.explanation}
                      </p>
                    )}
                    {quizQuestions[currentQIndex]?.source_page && (
                      <span className="inline-block text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-md">
                        📄 Source: Page {quizQuestions[currentQIndex]?.source_page}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-slate-500">
                {!isFlipped ? 'Click anywhere to view answer' : 'Rate retention difficulty below'}
              </div>
            </div>

            {/* SM-2 Confidence Buttons */}
            {isFlipped && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-4 gap-2 pt-2"
              >
                <button
                  onClick={() => handleRateFlashcard('again')}
                  className="py-3 px-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-semibold text-xs rounded-xl transition-all"
                >
                  Again (1d)
                </button>
                <button
                  onClick={() => handleRateFlashcard('hard')}
                  className="py-3 px-2 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-300 font-semibold text-xs rounded-xl transition-all"
                >
                  Hard (2d)
                </button>
                <button
                  onClick={() => handleRateFlashcard('good')}
                  className="py-3 px-2 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-300 font-semibold text-xs rounded-xl transition-all"
                >
                  Good (4d)
                </button>
                <button
                  onClick={() => handleRateFlashcard('easy')}
                  className="py-3 px-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 font-semibold text-xs rounded-xl transition-all"
                >
                  Easy (7d)
                </button>
              </motion.div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                disabled={currentQIndex === 0}
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentQIndex((prev) => Math.max(0, prev - 1));
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <button
                onClick={() => setActiveTab('generate')}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Exit Deck
              </button>

              <button
                disabled={currentQIndex >= quizQuestions.length - 1}
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentQIndex((prev) => Math.min(quizQuestions.length - 1, prev + 1));
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. ACTIVE QUIZ TAKING */}
        {activeTab === 'active' && quizQuestions.length > 0 && (
          <motion.div
            key="active"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6"
          >
            {/* Header info & timer */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-lg border border-indigo-500/30 uppercase tracking-wide">
                  Question {currentQIndex + 1} of {quizQuestions.length}
                </span>
                <span className="text-xs text-slate-400">
                  Type: {quizQuestions[currentQIndex]?.question_type || 'Multiple Choice'}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {timedMode > 0 && (
                  <div className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                    questionTimeLeft <= 10 ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-slate-800 text-slate-300'
                  }`}>
                    <TimerIcon className="w-3.5 h-3.5" />
                    {questionTimeLeft}s
                  </div>
                )}
                <button
                  onClick={() => handleSpeak(quizQuestions[currentQIndex]?.question || quizQuestions[currentQIndex]?.text)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Listen to question"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
              {quizQuestions[currentQIndex]?.question || quizQuestions[currentQIndex]?.text}
            </h3>

            {/* Answer Options */}
            <div className="space-y-3">
              {quizQuestions[currentQIndex]?.options && quizQuestions[currentQIndex]?.options.length > 0 ? (
                quizQuestions[currentQIndex].options.map((option: string, oIdx: number) => {
                  const isSelected = userAnswers[currentQIndex] === option;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelectAnswer(option)}
                      className={`w-full text-left p-4 rounded-xl border transition-all text-sm font-medium flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>{option}</span>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div>
                  <textarea
                    rows={4}
                    value={userAnswers[currentQIndex] || ''}
                    onChange={(e) => handleSelectAnswer(e.target.value)}
                    placeholder="Type your explanation or conceptual answer here..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-40"
              >
                Previous
              </button>

              {currentQIndex < quizQuestions.length - 1 ? (
                <button
                  onClick={() => setCurrentQIndex((prev) => prev + 1)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl flex items-center gap-2 transition-all"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled={isEvaluating}
                  onClick={handleFinishQuiz}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {isEvaluating ? 'Evaluating...' : 'Finish & Evaluate'}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* 4. RESULTS WITH EXPLANATION BREAKDOWNS */}
        {activeTab === 'results' && quizResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl"
          >
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mx-auto mb-4 text-indigo-400">
              <Award className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Quiz Completed!</h2>
            <p className="text-slate-400 text-sm mb-6">Automated concept evaluation & deep-dive explanation breakdown:</p>

            <div className="inline-block p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 mb-8 min-w-[240px]">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
                {quizResult.percentage}%
              </div>
              <div className="text-slate-400 text-xs font-medium mt-1">
                {quizResult.score} out of {quizResult.total} Correct
              </div>
            </div>

            {/* Answer review */}
            <div className="text-left space-y-4 mb-8">
              <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Comprehensive Review & Key Takeaways</h4>
              {quizQuestions.map((q, idx) => {
                const ans = userAnswers[idx];
                const correctAns = q.correct_answer || q.answer;
                const isCorrect = ans && ans.toLowerCase().trim() === correctAns?.toLowerCase()?.trim();

                return (
                  <div key={idx} className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      {isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-200">{q.question || q.text}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400 mt-1.5">
                          <span>
                            Your answer: <span className={isCorrect ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>{ans || 'None'}</span>
                          </span>
                          {!isCorrect && (
                            <span>
                              &bull; Correct:{' '}
                              <span className="text-emerald-400 font-semibold">{correctAns}</span>
                            </span>
                          )}
                        </div>

                        {q.explanation && (
                          <div className="mt-2 text-xs text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 space-y-1">
                            <p className="font-semibold text-indigo-400 flex items-center gap-1">
                              <Lightbulb className="w-3.5 h-3.5" /> Core Concept & Rationale:
                            </p>
                            <p className="leading-relaxed">{q.explanation}</p>
                            {q.source_page && (
                              <p className="text-[11px] text-slate-500 pt-1">
                                Source Page: Page {q.source_page}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setActiveTab('generate')}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30"
              >
                Create Another Module
              </button>
            </div>
          </motion.div>
        )}

        {/* 5. EXAM-STYLE STEP-BY-STEP MODEL ANSWERS */}
        {activeTab === 'exam' && (
          <motion.div
            key="exam"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Exam-Style Step-by-Step Answer</h2>
                  <p className="text-xs text-slate-400">
                    Generates exact mark-weighted points, formulas, diagrams, and structure
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Reference Document
                  </label>
                  <select
                    value={examDocId}
                    onChange={(e) => setExamDocId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a document...</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title || doc.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Exam Marks Weight
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[2, 5, 10].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExamMarks(m)}
                        className={`py-2.5 rounded-xl border font-bold text-sm transition-all ${
                          examMarks === m
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {m} Marks
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Exam Question Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={examQuestion}
                    onChange={(e) => setExamQuestion(e.target.value)}
                    placeholder="e.g., Explain the difference between supervised and unsupervised learning with real-world examples."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <button
                  disabled={!examQuestion.trim() || examMutation.isPending}
                  onClick={() => examMutation.mutate()}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {examMutation.isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating Model Answer...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate {examMarks}-Mark Model Answer
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Answer Display */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                Examiner-Approved Solution
              </h3>

              {examResponse ? (
                <div className="flex-1 overflow-y-auto space-y-4 max-h-[500px] pr-2">
                  <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-xl text-xs text-purple-300">
                    Target Marks: <span className="font-bold">{examMarks}</span> | Key Rubric Criteria: Full conceptual
                    definition + structured points.
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {examResponse.answer || examResponse.content || JSON.stringify(examResponse, null, 2)}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-8">
                  <BookOpen className="w-10 h-10 mb-3 text-slate-600" />
                  Enter an exam question and choose the marks value on the left to synthesize a structured answer key.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 6. HISTORY */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl"
          >
            <h2 className="text-xl font-bold text-white mb-4">Past Quiz & Flashcard Attempts</h2>
            {attempts.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {attempts.map((att: any) => (
                  <div key={att.id} className="py-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">{att.topic || att.topic_name || 'General Practice'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(att.started_at || att.created_at || Date.now()).toLocaleDateString()} &bull; {att.total_questions} Questions
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-indigo-400">
                        {Math.round((att.correct_count / (att.total_questions || 1)) * 100)}%
                      </span>
                      <div className="text-[11px] text-slate-500">
                        {att.correct_count}/{att.total_questions} correct
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm py-8 text-center">No quiz attempts recorded yet.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
