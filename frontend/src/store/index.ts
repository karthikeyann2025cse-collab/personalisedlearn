import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserProfile, StudySession } from '../types';

// ─── Auth store ───────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  user: User | null;
  profile: UserProfile | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setProfile: (profile: UserProfile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      profile: null,
      setToken: (token) => {
        localStorage.setItem('learnon_token', token);
        set({ token });
      },
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      logout: () => {
        localStorage.removeItem('learnon_token');
        set({ token: null, user: null, profile: null });
      },
    }),
    {
      name: 'learnon-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

// ─── Timer store (persists across page navigations) ───────────────────────────

interface TimerState {
  activeSessionId: number | null;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  startTimestamp: number | null;   // Date.now() when timer last started/resumed
  accumulatedSeconds: number;      // seconds before last pause
  subject?: string;
  topic?: string;
  isPomodoro: boolean;
  pomodoroWork: number;            // minutes
  pomodoroBreak: number;           // minutes
  pomodoroPhase: 'work' | 'break';

  startTimer: (sessionId: number, subject?: string, topic?: string, isPomodoro?: boolean) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  tick: () => void;
  setPomodoro: (work: number, brk: number) => void;
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  activeSessionId: null,
  isRunning: false,
  isPaused: false,
  elapsedSeconds: 0,
  startTimestamp: null,
  accumulatedSeconds: 0,
  subject: undefined,
  topic: undefined,
  isPomodoro: false,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  pomodoroPhase: 'work',

  startTimer: (sessionId, subject, topic, isPomodoro = false) =>
    set({
      activeSessionId: sessionId,
      isRunning: true,
      isPaused: false,
      elapsedSeconds: 0,
      startTimestamp: Date.now(),
      accumulatedSeconds: 0,
      subject,
      topic,
      isPomodoro,
      pomodoroPhase: 'work',
    }),

  pauseTimer: () => {
    const { startTimestamp, accumulatedSeconds } = get();
    const elapsed = startTimestamp ? Math.floor((Date.now() - startTimestamp) / 1000) : 0;
    set({ isPaused: true, isRunning: false, accumulatedSeconds: accumulatedSeconds + elapsed, startTimestamp: null });
  },

  resumeTimer: () => set({ isRunning: true, isPaused: false, startTimestamp: Date.now() }),

  stopTimer: () =>
    set({
      activeSessionId: null,
      isRunning: false,
      isPaused: false,
      elapsedSeconds: 0,
      startTimestamp: null,
      accumulatedSeconds: 0,
    }),

  tick: () => {
    const { startTimestamp, accumulatedSeconds, isRunning } = get();
    if (!isRunning || !startTimestamp) return;
    const current = Math.floor((Date.now() - startTimestamp) / 1000) + accumulatedSeconds;
    set({ elapsedSeconds: current });
  },

  setPomodoro: (work, brk) => set({ pomodoroWork: work, pomodoroBreak: brk }),
}));

// ─── UI store ─────────────────────────────────────────────────────────────────

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebar: (v) => set({ sidebarCollapsed: v }),
}));
