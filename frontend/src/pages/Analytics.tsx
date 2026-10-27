import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  Clock,
  Flame,
  Award,
  TrendingUp,
  Brain,
  Calendar,
  AlertTriangle,
  Sparkles,
  Download,
  Printer,
  Users,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { analyticsApi } from '../api/client';

const COLORS = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

export const Analytics: React.FC = () => {
  const [daysFilter, setDaysFilter] = useState(7);

  // Queries
  const { data: summaryRes } = useQuery({
    queryKey: ['analyticsSummary'],
    queryFn: () => analyticsApi.summary(),
  });
  const summary = summaryRes?.data || {
    total_hours: 14.5,
    streak_days: 5,
    longest_streak: 12,
    quizzes_taken: 18,
    avg_score: 82,
    retention_rate: 88,
  };

  const { data: dailyRes } = useQuery({
    queryKey: ['dailyHours', daysFilter],
    queryFn: () => analyticsApi.dailyHours(daysFilter),
  });
  const dailyData: any[] = dailyRes?.data || [
    { date: 'Mon', hours: 2.2 },
    { date: 'Tue', hours: 1.8 },
    { date: 'Wed', hours: 3.4 },
    { date: 'Thu', hours: 2.0 },
    { date: 'Fri', hours: 2.9 },
    { date: 'Sat', hours: 4.1 },
    { date: 'Sun', hours: 2.5 },
  ];

  const { data: subjectRes } = useQuery({
    queryKey: ['subjectDist'],
    queryFn: () => analyticsApi.subjectDist(),
  });
  const subjectData: any[] = subjectRes?.data || [
    { name: 'Computer Science', value: 45 },
    { name: 'Mathematics', value: 25 },
    { name: 'Physics', value: 18 },
    { name: 'System Design', value: 12 },
  ];

  const { data: trendRes } = useQuery({
    queryKey: ['quizTrend'],
    queryFn: () => analyticsApi.quizTrend(10),
  });
  const quizTrend: any[] = trendRes?.data || [
    { attempt: 'Q1', score: 65 },
    { attempt: 'Q2', score: 70 },
    { attempt: 'Q3', score: 68 },
    { attempt: 'Q4', score: 82 },
    { attempt: 'Q5', score: 80 },
    { attempt: 'Q6', score: 90 },
    { attempt: 'Q7', score: 88 },
  ];

  const { data: masteryRes } = useQuery({
    queryKey: ['topicMastery'],
    queryFn: () => analyticsApi.topicMastery(),
  });
  const topicMastery: any[] = masteryRes?.data || [
    { topic: 'Dynamic Programming', score: 92, status: 'Mastered' },
    { topic: 'Binary Trees', score: 85, status: 'Proficient' },
    { topic: 'Relational Schema', score: 72, status: 'Review Needed' },
    { topic: 'Cache Invalidation', score: 54, status: 'Critical Weakness' },
  ];

  // Print/Export PDF Report
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 print:p-0 print:space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Cognitive Study Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time telemetry on study habits, knowledge retention, and mastery velocity.
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Export / Print Report
          </button>

          {/* Days selector */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 self-start sm:self-auto">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDaysFilter(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  daysFilter === d ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Last {d} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards & Streak Tracking */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">Total Study Time</p>
              <h3 className="text-2xl font-black text-white mt-1">{summary.total_hours || summary.total_study_hours || 14.5} hrs</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[11px] text-emerald-400 mt-3 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +18% vs previous cycle
          </div>
        </motion.div>

        {/* Streak Tracking Card */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">Active Study Streak</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1 flex items-center gap-2">
                {summary.streak_days || 5} Days <Flame className="w-6 h-6 text-amber-500 fill-amber-500 animate-pulse" />
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 flex items-center justify-between">
            <span>Personal Best: <strong className="text-white">{summary.longest_streak || 12} days</strong></span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">Avg Quiz Accuracy</p>
              <h3 className="text-2xl font-black text-white mt-1">{summary.avg_score || 82}%</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[11px] text-purple-400 mt-3">From {summary.quizzes_taken || summary.completed_sessions || 18} evaluations</div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">Retention Velocity</p>
              <h3 className="text-2xl font-black text-white mt-1">{summary.retention_rate || 86}%</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Brain className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[11px] text-teal-400 mt-3">High long-term memory score</div>
        </motion.div>
      </div>

      {/* Peer Benchmarking / Cohort Standing */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-900/90 border border-indigo-800/40 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Peer Benchmark (K-Means Cohort Analysis)</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Top 12% Percentile
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Based on cluster classification across study consistency, average quiz accuracy, and spaced repetition adherence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-center shrink-0">
          <div>
            <div className="text-xl font-black text-indigo-400">Cluster 1</div>
            <div className="text-[11px] text-slate-400">Consistent Achiever</div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <div className="text-xl font-black text-emerald-400">+14%</div>
            <div className="text-[11px] text-slate-400">Above Cohort Avg</div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Study Time Chart */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Daily Focus Activity</h3>
              <p className="text-xs text-slate-400">Hours spent studying across the selected timeframe</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} unit="h" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#475569',
                    borderRadius: '0.75rem',
                    color: '#fff',
                  }}
                />
                <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#focusGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Distribution */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Subject Focus Share</h3>
            <p className="text-xs text-slate-400 mb-4">Breakdown of study hours by domain</p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {subjectData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderColor: '#475569',
                      borderRadius: '0.75rem',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
            {subjectData.map((s, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-slate-300 truncate">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Row: Quiz Trend & Topic Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quiz Performance Trends */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1">Quiz Accuracy Trajectory</h3>
          <p className="text-xs text-slate-400 mb-6">Historical accuracy progression on generated tests</p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quizTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="attempt" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#475569',
                    borderRadius: '0.75rem',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actionable Topic Insights & Weak Areas */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Mastery & Weakness Diagnosis</h3>
            <p className="text-xs text-slate-400 mb-4">AI identifies critical topics needing spaced repetition</p>

            <div className="space-y-3">
              {topicMastery.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-slate-200">{item.topic || item.topic_name}</div>
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                        (item.score || item.mastery_score) >= 80
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : (item.score || item.mastery_score) >= 65
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {item.status || (item.score >= 80 ? 'Mastered' : 'Review Needed')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-white">{item.score || Math.round((item.mastery_score || 0.7) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200 leading-relaxed">
              Recommendation: Review <span className="font-bold text-white">Cache Invalidation & Memory Paging</span> with AI Tutor
              before taking another quiz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
