import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Clock,
  Sparkles,
  BookOpen,
  Volume2,
  VolumeX,
  Plus,
  Flame,
  Calendar,
} from 'lucide-react';
import { sessionsApi, documentsApi } from '../api/client';

export const Timer: React.FC = () => {
  const queryClient = useQueryClient();

  // Mode: 'pomodoro' | 'shortBreak' | 'longBreak' | 'stopwatch'
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'shortBreak' | 'longBreak' | 'stopwatch'>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  // Focus context tags
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<number | ''>('');

  // Audio white noise generator simulation using Web Audio API
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  // Queries
  const { data: docsRes } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list(),
  });
  const documents: any[] = docsRes?.data?.items || docsRes?.data || [];

  const { data: sessionsRes } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
  });
  const pastSessions: any[] = sessionsRes?.data || [];

  // Mutations
  const startSessionMutation = useMutation({
    mutationFn: (data: { subject?: string; topic?: string; document_id?: number; is_pomodoro?: boolean }) =>
      sessionsApi.start(data),
    onSuccess: (res) => {
      setActiveSessionId(res.data?.id || res.data?.session_id);
    },
  });

  const stopSessionMutation = useMutation({
    mutationFn: ({ sessionId, duration }: { sessionId: number; duration: number }) =>
      sessionsApi.stop(sessionId, duration),
    onSuccess: () => {
      setActiveSessionId(null);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['analyticsSummary'] });
    },
  });

  // Switch mode helper
  const switchMode = (mode: 'pomodoro' | 'shortBreak' | 'longBreak' | 'stopwatch') => {
    setIsRunning(false);
    setTimerMode(mode);
    if (mode === 'pomodoro') setTimeLeft(25 * 60);
    else if (mode === 'shortBreak') setTimeLeft(5 * 60);
    else if (mode === 'longBreak') setTimeLeft(15 * 60);
    else if (mode === 'stopwatch') setTimeLeft(0);
  };

  // Timer Tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        if (timerMode === 'stopwatch') {
          setTimeLeft((prev) => prev + 1);
        } else {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(interval!);
              handleTimerComplete();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timerMode]);

  // Harmonic Bell Chime using Web Audio API
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.3); // E5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(783.99, now); // G5
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.4); // C6

      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.5);
      osc2.stop(now + 2.5);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  };

  // Handle Complete
  const handleTimerComplete = () => {
    setIsRunning(false);
    playChime();
    if (activeSessionId) {
      stopSessionMutation.mutate({ sessionId: activeSessionId, duration: 25 * 60 });
    }
  };

  // Play / Pause Handlers
  const toggleStartPause = () => {
    if (!isRunning) {
      if (!activeSessionId && timerMode !== 'shortBreak' && timerMode !== 'longBreak') {
        startSessionMutation.mutate({
          subject: subject.trim() || 'General Study',
          topic: topic.trim() || 'Focus Session',
          document_id: selectedDocId ? Number(selectedDocId) : undefined,
          is_pomodoro: timerMode === 'pomodoro',
        });
      }
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  };

  const handleStopAndSave = () => {
    const elapsed = timerMode === 'stopwatch' ? timeLeft : 25 * 60 - timeLeft;
    setIsRunning(false);
    if (activeSessionId && elapsed > 10) {
      stopSessionMutation.mutate({ sessionId: activeSessionId, duration: elapsed });
    } else {
      setActiveSessionId(null);
    }
    switchMode(timerMode);
  };

  // Web Audio Pink Noise Generator
  const toggleSound = () => {
    if (isAudioPlaying) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      setIsAudioPlaying(false);
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 0.15; // gentle volume
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        noise.connect(ctx.destination);
        noise.start(0);

        audioCtxRef.current = ctx;
        noiseNodeRef.current = noise;
        setIsAudioPlaying(true);
      } catch (e) {
        console.error('Audio not supported:', e);
      }
    }
  };

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalModeDuration =
    timerMode === 'pomodoro' ? 25 * 60 : timerMode === 'shortBreak' ? 5 * 60 : timerMode === 'longBreak' ? 15 * 60 : 60;
  const progressPercent =
    timerMode === 'stopwatch' ? 100 : Math.min(100, Math.max(0, ((totalModeDuration - timeLeft) / totalModeDuration) * 100));

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Focus Timer & Pomodoro
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Deep focus intervals with ambient acoustics and automated study logging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Chime sound test */}
          <button
            onClick={playChime}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
            title="Preview interval completion chime"
          >
            🔔 Test Bell
          </button>

          {/* Ambient Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
              isAudioPlaying
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {isAudioPlaying ? <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
            {isAudioPlaying ? 'Deep Focus Sound On' : 'Ambient Noise'}
          </button>
        </div>
      </div>

      {/* Main Focus Console */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Mode Selector Tabs */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60">
            <button
              onClick={() => switchMode('pomodoro')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                timerMode === 'pomodoro'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pomodoro (25m)
            </button>
            <button
              onClick={() => switchMode('shortBreak')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                timerMode === 'shortBreak'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Short Break (5m)
            </button>
            <button
              onClick={() => switchMode('longBreak')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                timerMode === 'longBreak'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Long Break (15m)
            </button>
            <button
              onClick={() => switchMode('stopwatch')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                timerMode === 'stopwatch'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stopwatch
            </button>
          </div>
        </div>

        {/* Circular Progress & Digits */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="stroke-slate-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className={`transition-all duration-1000 ${
                  timerMode === 'pomodoro'
                    ? 'stroke-indigo-500'
                    : timerMode === 'shortBreak'
                    ? 'stroke-emerald-400'
                    : timerMode === 'longBreak'
                    ? 'stroke-purple-400'
                    : 'stroke-cyan-400'
                }`}
                strokeWidth="8"
                strokeDasharray="1000"
                strokeDashoffset={1000 - (1000 * progressPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl sm:text-7xl font-mono font-black text-white tracking-tight">
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold mt-2">
                {isRunning ? 'Session Active' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={toggleStartPause}
            className={`px-8 py-4 rounded-2xl font-bold text-base flex items-center gap-3 shadow-xl transition-all ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 fill-current" /> Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" /> Start Focus
              </>
            )}
          </button>

          {(isRunning || timeLeft !== totalModeDuration) && (
            <button
              onClick={handleStopAndSave}
              className="px-6 py-4 rounded-2xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Save & Reset
            </button>
          )}

          <button
            onClick={() => switchMode(timerMode)}
            className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white border border-slate-700/60 transition-all"
            title="Reset timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Focus tagging footer */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Associate Document</label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">None / General</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title || doc.filename}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Computer Architecture"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Target Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Cache Coherence"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Recent Study Sessions Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Completed Focus Logs</h3>
          </div>
          <span className="text-xs text-slate-400">{pastSessions.length} sessions logged</span>
        </div>

        {pastSessions.length > 0 ? (
          <div className="divide-y divide-slate-800/80">
            {pastSessions.slice(0, 5).map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{s.topic || s.subject || 'Deep Study Session'}</p>
                  <p className="text-xs text-slate-500">{new Date(s.start_time || s.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-indigo-400">
                    {Math.round((s.duration_seconds || 0) / 60)} mins
                  </span>
                  <div className="text-[10px] text-slate-500">{s.is_pomodoro ? 'Pomodoro Cycle' : 'Standard'}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-6 text-center">No focus sessions logged yet today.</p>
        )}
      </div>
    </div>
  );
};
