import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, BookOpen, Clock, Languages, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { profileApi } from '../api/client';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'English', 'History', 'Economics', 'Engineering', 'Medicine', 'Law', 'Other'];
const FORMATS = ['Visual diagrams', 'Step-by-step', 'Examples first', 'Theory first', 'Analogies', 'Practice problems'];
const LANGUAGES = ['English', 'Tamil'];

const steps = ['Goals', 'Subjects', 'Preferences', 'Done'];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    learning_goals: '',
    subjects: [] as string[],
    daily_study_minutes: 60,
    preferred_language: 'English',
    preferred_formats: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const toggle = (key: 'subjects' | 'preferred_formats', val: string) =>
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }));

  const handleFinish = async () => {
    setSaving(true);
    try {
      await profileApi.update({ ...form, onboarding_complete: true });
      navigate('/dashboard');
    } catch {
      navigate('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05081a] bg-mesh flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-violet-500' : 'bg-white/10'}`} />
              <p className={`text-xs mt-1 font-medium ${i === step ? 'text-violet-400' : 'text-slate-600'}`}>{s}</p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="glass-strong p-8 rounded-2xl">
              <Target size={32} className="text-violet-400 mb-4" />
              <h2 className="font-display font-bold text-2xl text-white mb-2">What are your learning goals?</h2>
              <p className="text-slate-400 text-sm mb-6">Tell us what you want to achieve. This helps personalize your experience.</p>
              <textarea
                value={form.learning_goals}
                onChange={e => setForm(f => ({ ...f, learning_goals: e.target.value }))}
                className="input resize-none h-32"
                placeholder="e.g. Prepare for university entrance exams in Mathematics and Physics. I want to understand concepts deeply, not just memorize."
              />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="glass-strong p-8 rounded-2xl">
              <BookOpen size={32} className="text-violet-400 mb-4" />
              <h2 className="font-display font-bold text-2xl text-white mb-2">Which subjects are you studying?</h2>
              <p className="text-slate-400 text-sm mb-6">Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button key={s} onClick={() => toggle('subjects', s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      form.subjects.includes(s)
                        ? 'bg-violet-600/30 border-violet-500 text-violet-300'
                        : 'bg-white/5 border-white/12 text-slate-400 hover:border-violet-500/50'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="glass-strong p-8 rounded-2xl space-y-6">
              <div>
                <Clock size={28} className="text-violet-400 mb-3" />
                <h2 className="font-display font-bold text-2xl text-white mb-1">Your study preferences</h2>
              </div>

              <div>
                <label className="label">Daily study time: <span className="text-violet-400">{form.daily_study_minutes} min</span></label>
                <input type="range" min={15} max={480} step={15} value={form.daily_study_minutes}
                  onChange={e => setForm(f => ({ ...f, daily_study_minutes: +e.target.value }))}
                  className="w-full accent-violet-500" />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>15 min</span><span>8 hours</span>
                </div>
              </div>

              <div>
                <label className="label flex items-center gap-2"><Languages size={16} /> Preferred explanation language</label>
                <div className="flex gap-2 mt-2">
                  {LANGUAGES.map(l => (
                    <button key={l} onClick={() => setForm(f => ({ ...f, preferred_language: l }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        form.preferred_language === l ? 'bg-violet-600/30 border-violet-500 text-violet-300' : 'bg-white/5 border-white/12 text-slate-400'
                      }`}>
                      {l === 'Tamil' ? '🇮🇳 தமிழ்' : '🇬🇧 English'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Preferred learning formats</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {FORMATS.map(f => (
                    <button key={f} onClick={() => toggle('preferred_formats', f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        form.preferred_formats.includes(f)
                          ? 'bg-violet-600/30 border-violet-500 text-violet-300'
                          : 'bg-white/5 border-white/12 text-slate-400 hover:border-violet-500/50'
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-strong p-10 rounded-2xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
                <Sparkles size={32} className="text-violet-400" />
              </div>
              <h2 className="font-display font-bold text-3xl text-white mb-3">You're all set!</h2>
              <p className="text-slate-400 mb-8">Your personalized learning environment is ready. Upload your first PDF to get started.</p>
              <button onClick={handleFinish} disabled={saving} className="btn-primary px-10 py-3.5 text-base">
                {saving ? 'Saving...' : 'Go to Dashboard'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex justify-between mt-5">
            <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
              className="btn-secondary py-2 px-5 disabled:opacity-30">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={() => setStep(s => s + 1)} className="btn-primary py-2 px-5">
              {step === 2 ? 'Almost done' : 'Continue'} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
