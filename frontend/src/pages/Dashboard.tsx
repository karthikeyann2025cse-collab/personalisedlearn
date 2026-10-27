import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, Brain, BarChart3, Target, BookOpen, Zap, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/client';
import { useAuthStore } from '../store';
import type { AnalyticsSummary } from '../types';

function StatCard({ icon: Icon, label, value, sub, color = 'violet' }: any) {
  const colors: Record<string, string> = {
    violet: 'from-violet-600/20 to-violet-500/5 border-violet-500/30',
    blue:   'from-blue-600/20 to-blue-500/5 border-blue-500/30',
    green:  'from-green-600/20 to-green-500/5 border-green-500/30',
    amber:  'from-amber-600/20 to-amber-500/5 border-amber-500/30',
  };
  const iconColors: Record<string, string> = {
    violet: 'text-violet-400', blue: 'text-blue-400', green: 'text-green-400', amber: 'text-amber-400',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className={`glass p-5 rounded-2xl bg-gradient-to-br ${colors[color]} border`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center ${iconColors[color]}`}>
          <Icon size={18} />
        </div>
        <TrendingUp size={14} className="text-slate-600" />
      </div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      <p className="text-sm font-medium text-slate-300 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

export function Dashboard() {
  const { user } = useAuthStore();
  const { data: summary, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.summary().then(r => r.data),
  });

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title font-display">
          {greeting()}, {user?.full_name?.split(' ')[0] || user?.username} 👋
        </h1>
        <p className="page-subtitle">Here's your learning overview for today</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard icon={Clock}   label="Total Study Hours"   value={`${summary?.total_study_hours ?? 0}h`}   sub={`${summary?.today_study_hours ?? 0}h today`} color="violet" />
            <StatCard icon={Brain}   label="Avg Quiz Score"       value={`${summary?.average_quiz_score ?? 0}%`}  sub={`${summary?.completed_sessions ?? 0} sessions`} color="blue" />
            <StatCard icon={Target}  label="Topics Mastered"      value={summary?.mastered_topics ?? 0}           sub="≥ 80% mastery" color="green" />
            <StatCard icon={BarChart3}label="Weekly Study"        value={`${summary?.weekly_study_hours ?? 0}h`} sub="last 7 days" color="amber" />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {[
          { to: '/library', icon: BookOpen, title: 'Upload & Study PDF', desc: 'Add a new document to your library', color: 'violet' },
          { to: '/chat',    icon: Zap,      title: 'Ask AI Tutor',       desc: 'Get answers from your documents',    color: 'blue' },
          { to: '/quiz',    icon: Brain,    title: 'Take a Quiz',         desc: 'Practice and test your knowledge',  color: 'green' },
        ].map(({ to, icon: Icon, title, desc, color }) => (
          <Link key={to} to={to}
            className="card-hover group flex items-center gap-4 p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors
              ${color === 'violet' ? 'bg-violet-500/15 text-violet-400 group-hover:bg-violet-500/25' :
                color === 'blue'   ? 'bg-blue-500/15 text-blue-400 group-hover:bg-blue-500/25' :
                                     'bg-green-500/15 text-green-400 group-hover:bg-green-500/25'}`}>
              <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-slate-600 group-hover:text-white transition-colors shrink-0" />
          </Link>
        ))}
      </div>

      {/* Today's plan preview */}
      <div className="glass p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Today's Study Plan</h2>
          <Link to="/planner" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {summary?.completed_sessions === 0 ? (
          <div className="empty-state py-8">
            <div className="empty-state-icon">
              <BookOpen size={24} />
            </div>
            <p className="font-medium text-white mb-1">No plan yet</p>
            <p className="text-sm text-slate-400 mb-4">Generate a personalized study plan based on your documents and goals</p>
            <Link to="/planner" className="btn-primary py-2 px-5 text-sm">Generate Plan</Link>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Your tasks will appear here once you generate a plan.</p>
        )}
      </div>
    </div>
  );
}
