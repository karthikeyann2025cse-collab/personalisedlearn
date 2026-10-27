import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { Reader } from './pages/Reader';
import { Chat } from './pages/Chat';
import { QuizStudio } from './pages/QuizStudio';
import { Timer } from './pages/Timer';
import { Analytics } from './pages/Analytics';
import { Planner } from './pages/Planner';
import { KnowledgeMap } from './pages/KnowledgeMap';
import { Insights } from './pages/Insights';
import { Profile } from './pages/Profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected — all inside AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/library/:docId" element={<Reader />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:docId" element={<Chat />} />
            <Route path="/quiz" element={<QuizStudio />} />
            <Route path="/timer" element={<Timer />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/knowledge-map" element={<KnowledgeMap />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
