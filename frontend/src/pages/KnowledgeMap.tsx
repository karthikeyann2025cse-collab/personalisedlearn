import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Zap,
  Layers,
  GitBranch,
  ShieldAlert,
  Compass,
  RefreshCw,
  Target,
  Activity,
  Check,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mlApi } from '../api/client';
import { DiagnosticReportResponse, DiagnosticTopicReport } from '../types';

export const KnowledgeMap: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'detector' | 'graph'>('detector');
  const [selectedTopicName, setSelectedTopicName] = useState<string>('Backpropagation & Computational Graphs');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Query Diagnostic Report
  const {
    data: diagnosticReport,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<DiagnosticReportResponse>({
    queryKey: ['diagnostic-report'],
    queryFn: () => mlApi.getDiagnosticReport().then((r) => r.data),
    staleTime: 60_000,
  });

  const topics = diagnosticReport?.topics || [];
  const summary = diagnosticReport?.summary || {
    total_concepts: 9,
    mastered_count: 2,
    knowledge_gaps_count: 4,
    active_misconceptions_count: 2,
    prerequisite_blocked_count: 1,
    readiness_index: 22.2,
  };

  const selectedTopic: DiagnosticTopicReport | undefined =
    topics.find((t) => t.topic === selectedTopicName) || topics[0];

  const categories = ['All', ...Array.from(new Set(topics.map((t) => t.category)))];

  const filteredTopics = topics.filter((t) => {
    const matchesCat = filterCategory === 'All' || t.category === filterCategory;
    const matchesSearch =
      t.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'gaps' && (t.status === 'gap_detected' || t.status === 'prerequisite_blocked')) ||
      (statusFilter === 'misconceptions' && t.status === 'misconception_alert') ||
      (statusFilter === 'mastered' && t.status === 'mastered');
    return matchesCat && matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'mastered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={12} /> Mastered
          </span>
        );
      case 'misconception_alert':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <ShieldAlert size={12} /> Misconception Alert
          </span>
        );
      case 'prerequisite_blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle size={12} /> Prereq Blocked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertCircle size={12} /> Knowledge Gap
          </span>
        );
    }
  };

  // Node layout coordinates for the Topic Dependency Graph canvas
  const nodePositions: Record<string, { x: number; y: number }> = {
    'Linear Algebra & Vectors': { x: 80, y: 120 },
    'Calculus & Gradients': { x: 80, y: 280 },
    'Probability & Statistics': { x: 80, y: 440 },
    'Loss Functions & Optimization': { x: 340, y: 200 },
    'Supervised Learning & Regression': { x: 340, y: 360 },
    'Neural Network Architectures': { x: 580, y: 140 },
    'Backpropagation & Computational Graphs': { x: 580, y: 320 },
    'Transformer & Attention Mechanisms': { x: 820, y: 220 },
    'Large Language Model Alignment': { x: 1060, y: 220 },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 pb-16 animate-fade-in">
      {/* ─── Header & Top Control Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-400 mb-1">
            <Brain size={14} /> Cognitive ML Diagnostic System
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Knowledge Gap & Misconception Detector
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Trained with <strong className="text-slate-200">Decision Trees</strong>,{' '}
            <strong className="text-slate-200">Topic Dependency Graphs (DAG)</strong>, and{' '}
            <strong className="text-slate-200">Rule-Based Cognitive Diagnosis</strong> to detect unmastered concepts, root-cause prerequisites, and misconceptions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="btn-secondary text-xs px-4 py-2.5 flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={14} className={isRefetching ? 'animate-spin text-violet-400' : ''} />
            <span>{isRefetching ? 'Diagnosing...' : 'Run Diagnostic Scan'}</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface-900 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('detector')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'detector'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Diagnostic Studio
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'graph'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dependency Graph (DAG)
            </button>
          </div>
        </div>
      </div>

      {/* ─── Diagnostic Metrics KPI Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass p-4 rounded-2xl border border-white/8 relative overflow-hidden">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Analyzed Concepts</p>
          <p className="text-2xl font-extrabold text-white mt-1">{summary.total_concepts}</p>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
            <Compass size={12} className="text-blue-400" /> Syllabus DAG
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Mastered</p>
          <p className="text-2xl font-extrabold text-emerald-300 mt-1">{summary.mastered_count}</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400/80 mt-2">
            <CheckCircle2 size={12} /> ≥ 80% Retention
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 relative overflow-hidden">
          <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Knowledge Gaps</p>
          <p className="text-2xl font-extrabold text-rose-300 mt-1">{summary.knowledge_gaps_count}</p>
          <div className="flex items-center gap-1 text-[11px] text-rose-400/80 mt-2">
            <AlertCircle size={12} /> Foundational Deficit
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 relative overflow-hidden">
          <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Misconceptions</p>
          <p className="text-2xl font-extrabold text-purple-300 mt-1">{summary.active_misconceptions_count}</p>
          <div className="flex items-center gap-1 text-[11px] text-purple-400/80 mt-2">
            <ShieldAlert size={12} /> Cognitive Distortion
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 relative overflow-hidden">
          <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Blocked by Prereq</p>
          <p className="text-2xl font-extrabold text-amber-300 mt-1">{summary.prerequisite_blocked_count}</p>
          <div className="flex items-center gap-1 text-[11px] text-amber-400/80 mt-2">
            <GitBranch size={12} /> Upstream Failure
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 relative overflow-hidden">
          <p className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">Readiness Index</p>
          <p className="text-2xl font-extrabold text-violet-300 mt-1">{summary.readiness_index}%</p>
          <div className="flex items-center gap-1 text-[11px] text-violet-400/80 mt-2">
            <Activity size={12} /> Exam Preparedness
          </div>
        </div>
      </div>

      {/* ─── Search & Quick Filter Bar ──────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between glass p-3 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {['all', 'gaps', 'misconceptions', 'mastered'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap capitalize transition-all ${
                statusFilter === filter
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {filter === 'all' ? 'All Concepts' : filter.replace('_', ' ')}
            </button>
          ))}
          <span className="w-px h-5 bg-white/10 mx-1 hidden md:block" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                filterCategory === cat
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts or rules..."
            className="input pl-9 text-xs py-2 w-full"
          />
        </div>
      </div>

      {/* ─── TAB 1: DIAGNOSTIC STUDIO (Detector & Decision Tree) ────────────────── */}
      {activeTab === 'detector' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Concept List with Diagnostic Badges */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} /> Diagnostic Concept Queue ({filteredTopics.length})
              </h3>
              <span className="text-[11px] text-slate-500">Sorted by Topological Dependency</span>
            </div>

            <div className="space-y-2.5 max-h-[760px] overflow-y-auto pr-1">
              {filteredTopics.map((item) => {
                const isSelected = selectedTopic?.topic === item.topic;
                return (
                  <motion.div
                    key={item.topic}
                    onClick={() => setSelectedTopicName(item.topic)}
                    whileHover={{ scale: 1.01 }}
                    className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-violet-950/40 border-violet-500/80 shadow-lg shadow-violet-950/40'
                        : 'glass border-white/10 hover:border-violet-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {item.category} · Lvl {item.complexity}
                        </span>
                        <h4 className="font-semibold text-white text-sm mt-0.5">{item.topic}</h4>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {item.description}
                    </p>

                    {/* Quick Metric Bar */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-surface-900/80 border border-white/5 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Mastery</span>
                        <span className="font-bold text-slate-200">{item.mastery_score}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Accuracy</span>
                        <span className="font-bold text-slate-200">{item.quiz_accuracy}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Prereq Health</span>
                        <span
                          className={`font-bold ${
                            item.prerequisite_health < 60 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {item.prerequisite_health}%
                        </span>
                      </div>
                    </div>

                    {/* Root causes warning badge */}
                    {item.root_causes.length > 0 && (
                      <div className="mt-2 text-[11px] text-amber-300/90 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        <GitBranch size={12} className="shrink-0" />
                        <span className="truncate">
                          Root Cause Gap: <strong>{item.root_causes[0].topic}</strong> ({item.root_causes[0].mastery_score * 100}%)
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Deep-Dive Diagnostic Analysis Engine */}
          <div className="lg:col-span-7 space-y-6">
            {selectedTopic ? (
              <div className="glass p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6">
                {/* Topic Header & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-violet text-xs">{selectedTopic.category}</span>
                      <span className="text-xs text-slate-500">Complexity Level {selectedTopic.complexity}</span>
                    </div>
                    <h2 className="text-2xl font-black text-white">{selectedTopic.topic}</h2>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{selectedTopic.description}</p>
                  </div>
                  <div className="shrink-0">{getStatusBadge(selectedTopic.status)}</div>
                </div>

                {/* 1. Technology 1: Decision Tree Classifier Card */}
                <div className="p-5 rounded-2xl bg-surface-900 border border-violet-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                      <Brain size={16} /> Technology 1: Decision Tree Classifier
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Model Confidence:{' '}
                      <strong className="text-white">
                        {(selectedTopic.decision_tree.confidence * 100).toFixed(0)}%
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/25">
                    <div>
                      <span className="text-[10px] text-violet-300 font-bold uppercase">Classified State</span>
                      <p className="text-base font-black text-white">
                        {selectedTopic.decision_tree.predicted_state.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-xs text-slate-300">
                      Evaluated on: Mastery, Accuracy, Speed ({selectedTopic.avg_response_time}s), Prerequisite Health
                    </div>
                  </div>

                  {/* Decision Tree Branch Tracing */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Interpretable Decision Path:
                    </p>
                    <div className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-violet-300 border border-slate-800 leading-relaxed overflow-x-auto">
                      {selectedTopic.decision_tree.decision_path}
                    </div>
                  </div>
                </div>

                {/* 2. Technology 2: Topic Dependency Graph (DAG) Prerequisite Analysis */}
                <div className="p-5 rounded-2xl bg-surface-900 border border-blue-500/20 space-y-3">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <GitBranch size={16} /> Technology 2: Topic Dependency Graph & Root Cause
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 block mb-1">Prerequisite Health Score:</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              selectedTopic.prerequisite_health < 60 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${selectedTopic.prerequisite_health}%` }}
                          />
                        </div>
                        <span className="font-bold text-white">{selectedTopic.prerequisite_health}%</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 block mb-1">Immediate Prerequisites:</span>
                      <span className="text-white font-medium">
                        {selectedTopic.prerequisites.length > 0
                          ? selectedTopic.prerequisites.join(', ')
                          : 'None (Foundational Topic)'}
                      </span>
                    </div>
                  </div>

                  {/* Root Cause Gaps */}
                  {selectedTopic.root_causes.length > 0 ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Root-Cause Prerequisite Gaps Identified:
                      </p>
                      <div className="space-y-1.5">
                        {selectedTopic.root_causes.map((rc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-slate-950/70 p-2.5 rounded-lg border border-amber-500/20"
                          >
                            <span className="font-semibold text-white">
                              {rc.distance_upstream} Level(s) Upstream: <strong>{rc.topic}</strong>
                            </span>
                            <span className="text-amber-400 font-bold">
                              {(rc.mastery_score * 100).toFixed(0)}% Mastery
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Remediating these upstream concepts will immediately unblock comprehension in{' '}
                        <strong className="text-slate-200">{selectedTopic.topic}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 size={14} /> No blocking root-cause prerequisite gaps detected.
                    </div>
                  )}

                  {/* Downstream Vulnerabilities */}
                  {selectedTopic.downstream_risks.length > 0 && (
                    <div className="text-xs text-slate-400 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                      <span className="text-slate-300 font-semibold block mb-1">
                        Downstream Topics at Risk of Cascade Failure:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedTopic.downstream_risks.map((risk) => (
                          <span
                            key={risk}
                            className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px]"
                          >
                            {risk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Technology 3: Rule-Based Cognitive Diagnosis & Misconceptions */}
                <div className="p-5 rounded-2xl bg-surface-900 border border-purple-500/20 space-y-4">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert size={16} /> Technology 3: Rule-Based Cognitive Misconception Diagnosis
                  </h4>

                  {selectedTopic.rule_diagnoses.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTopic.rule_diagnoses.map((diag, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/25 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm flex items-center gap-1.5">
                              <AlertCircle size={14} className="text-purple-400" /> {diag.title}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                diag.severity === 'CRITICAL'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {diag.severity} Severity
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">{diag.explanation}</p>

                          <div className="p-2.5 rounded-lg bg-surface-900 border border-white/5 text-xs text-slate-300">
                            <strong className="text-purple-300">Prescriptive Remediation:</strong>{' '}
                            {diag.prescriptive_action}
                          </div>

                          {/* Quick AI Tutor Action */}
                          <button
                            onClick={() =>
                              navigate('/chat', {
                                state: {
                                  initialMessage: `${diag.ai_tutor_prompt}`,
                                },
                              })
                            }
                            className="btn-primary text-xs w-full py-2 flex items-center justify-center gap-2 mt-2"
                          >
                            <Sparkles size={14} /> Resolve this Misconception with AI Tutor
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 size={16} /> No cognitive distortions or active misconceptions diagnosed for this concept.
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() =>
                      navigate('/chat', {
                        state: {
                          initialMessage: `I want to fix my knowledge gaps and master ${selectedTopic.topic}. Can you explain its foundational logic step-by-step?`,
                        },
                      })
                    }
                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-xs font-semibold shadow-lg shadow-violet-900/30"
                  >
                    <Sparkles size={16} /> Ask AI Tutor Deep Explanation
                  </button>

                  <button
                    onClick={() => navigate('/quiz')}
                    className="flex-1 btn-secondary py-3 flex items-center justify-center gap-2 text-xs font-semibold"
                  >
                    <Brain size={16} className="text-violet-400" /> Launch Diagnostic Practice Quiz
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass p-12 text-center text-slate-500 text-xs rounded-3xl">
                Select a concept from the left panel to inspect its Decision Tree and Misconception Diagnosis.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── TAB 2: TOPIC DEPENDENCY GRAPH (Interactive Canvas) ───────────────── */
        <div className="space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-x-auto shadow-2xl min-h-[560px]">
            {/* Grid Pattern */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(#8b5cf6 1px, transparent 1px), radial-gradient(#8b5cf6 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 12px 12px',
              }}
            />

            {/* SVG Connecting Edges */}
            <svg className="absolute inset-0 w-[1300px] h-[600px] pointer-events-none">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
                </marker>
                <marker
                  id="arrowhead-blocked"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                </marker>
              </defs>

              {topics.map((node) =>
                node.prerequisites.map((pName) => {
                  const parentPos = nodePositions[pName];
                  const childPos = nodePositions[node.topic];
                  if (!parentPos || !childPos) return null;

                  const isBlocked = node.status === 'prerequisite_blocked';

                  return (
                    <line
                      key={`${pName}-${node.topic}`}
                      x1={parentPos.x + 190}
                      y1={parentPos.y + 40}
                      x2={childPos.x}
                      y2={childPos.y + 40}
                      stroke={isBlocked ? '#f59e0b' : '#475569'}
                      strokeWidth={isBlocked ? '2.5' : '1.8'}
                      strokeDasharray={isBlocked ? '6 4' : 'none'}
                      markerEnd={isBlocked ? 'url(#arrowhead-blocked)' : 'url(#arrowhead)'}
                    />
                  );
                })
              )}
            </svg>

            {/* Nodes Container */}
            <div className="relative w-[1300px] h-[580px]">
              {topics.map((node) => {
                const pos = nodePositions[node.topic] || { x: 100, y: 100 };
                const isSelected = selectedTopic?.topic === node.topic;

                let borderClass = 'border-slate-700 bg-slate-900/80';
                if (node.status === 'mastered') {
                  borderClass = 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300';
                } else if (node.status === 'misconception_alert') {
                  borderClass = 'border-purple-500/80 bg-purple-950/50 text-purple-300';
                } else if (node.status === 'prerequisite_blocked') {
                  borderClass = 'border-amber-500/80 bg-amber-950/50 text-amber-300';
                } else {
                  borderClass = 'border-rose-500/80 bg-rose-950/40 text-rose-300';
                }

                return (
                  <motion.div
                    key={node.topic}
                    onClick={() => {
                      setSelectedTopicName(node.topic);
                    }}
                    whileHover={{ scale: 1.04 }}
                    className={`absolute cursor-pointer rounded-2xl border px-4 py-3 backdrop-blur-md shadow-xl transition-all ${borderClass} ${
                      isSelected ? 'ring-2 ring-white shadow-violet-500/50 scale-[1.02]' : ''
                    }`}
                    style={{ left: `${pos.x}px`, top: `${pos.y}px`, width: '190px' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
                        {node.category}
                      </span>
                      <span className="text-xs font-black">{node.mastery_score}%</span>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                      {node.topic}
                    </h4>

                    <div className="mt-2 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          node.status === 'mastered'
                            ? 'bg-emerald-400'
                            : node.status === 'misconception_alert'
                            ? 'bg-purple-400'
                            : node.status === 'prerequisite_blocked'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                        style={{ width: `${node.mastery_score}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="capitalize opacity-80">{node.status.replace('_', ' ')}</span>
                      {node.rule_diagnoses.length > 0 && (
                        <span className="font-bold text-purple-300">
                          {node.rule_diagnoses.length} issue(s)
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Graph Legend & Guide */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 glass p-4 rounded-2xl text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
              <span><strong>Mastered</strong> (≥ 80% Retention)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-400 shrink-0" />
              <span><strong>Knowledge Gap</strong> (Foundational missing)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-400 shrink-0" />
              <span><strong>Misconception Alert</strong> (Active distortion)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
              <span><strong>Prerequisite Blocked</strong> (Upstream deficit)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
