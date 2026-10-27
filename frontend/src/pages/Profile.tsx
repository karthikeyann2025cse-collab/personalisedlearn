import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  GraduationCap,
  Target,
  Clock,
  Sparkles,
  Save,
  CheckCircle2,
  Key,
  Globe,
  LogOut,
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { profileApi, authApi } from '../api/client';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [targetDegree, setTargetDegree] = useState('B.S. Computer Science');
  const [targetGpa, setTargetGpa] = useState('3.8');
  const [dailyTargetHours, setDailyTargetHours] = useState(3.0);
  const [learningStyle, setLearningStyle] = useState('Intuitive & Analogies');
  const [language, setLanguage] = useState('English');
  const [customApiKey, setCustomApiKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch Current Profile
  const { data: profileRes, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => profileApi.get(),
  });

  const { data: authMeRes } = useQuery({
    queryKey: ['authMe'],
    queryFn: () => authApi.me(),
  });

  useEffect(() => {
    if (profileRes?.data) {
      const p = profileRes.data;
      if (p.full_name) setFullName(p.full_name);
      if (p.target_degree) setTargetDegree(p.target_degree);
      if (p.target_gpa) setTargetGpa(p.target_gpa.toString());
      if (p.daily_target_hours) setDailyTargetHours(p.daily_target_hours);
      if (p.learning_style) setLearningStyle(p.learning_style);
      if (p.preferred_language) setLanguage(p.preferred_language);
    }
    if (authMeRes?.data?.email) {
      setEmail(authMeRes.data.email);
      if (!fullName && authMeRes.data.full_name) {
        setFullName(authMeRes.data.full_name);
      }
    }
  }, [profileRes, authMeRes]);

  // Update Profile Mutation
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => profileApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      full_name: fullName,
      target_degree: targetDegree,
      target_gpa: parseFloat(targetGpa) || 3.8,
      daily_target_hours: dailyTargetHours,
      learning_style: learningStyle,
      preferred_language: language,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('learnon_token');
    navigate('/login');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Student Profile & Study Preferences
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Personalize your AI tutor tone, target goals, and daily study quotas.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold transition-all self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl font-bold">
              {fullName ? fullName[0]?.toUpperCase() : 'S'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{fullName || 'Student'}</h3>
              <p className="text-xs text-slate-400">{email || 'student@learnon.ai'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full bg-slate-800/40 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Academic Targets */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-400" /> Academic Goals
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Degree / Major</label>
              <input
                type="text"
                value={targetDegree}
                onChange={(e) => setTargetDegree(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Target GPA</label>
              <input
                type="text"
                value={targetGpa}
                onChange={(e) => setTargetGpa(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Daily Study Target</label>
              <select
                value={dailyTargetHours}
                onChange={(e) => setDailyTargetHours(parseFloat(e.target.value))}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={1.5}>1.5 Hours / Day</option>
                <option value={3.0}>3.0 Hours / Day</option>
                <option value={5.0}>5.0 Hours / Day (Intensive)</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Tutor Persona Customization */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" /> AI Tutor Persona & Pedagogy
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Learning & Explanation Style</label>
              <select
                value={learningStyle}
                onChange={(e) => setLearningStyle(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Intuitive & Analogies">Intuitive (Everyday analogies & mental models)</option>
                <option value="Mathematical Rigor">Formal & Mathematical (Proofs, formulas & theorem derivation)</option>
                <option value="Code-First">Code-First (Practical implementation in Python/C++)</option>
                <option value="Socratic Questions">Socratic (Questions prompting self-discovery)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Explanation Language</label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Hindi">Hindi / Hinglish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          {saveSuccess ? (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Preferences saved successfully!
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving Changes...' : 'Save Profile Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
