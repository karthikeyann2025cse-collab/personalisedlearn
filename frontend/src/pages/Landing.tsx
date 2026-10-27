import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Upload, Brain, BarChart3, BookOpen, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';

const FEATURES = [
  { icon: Upload,    title: 'Smart PDF Studio',       desc: 'Upload textbooks and lecture notes. Get summaries, chapter explanations, key formulas, and exam-ready answers.' },
  { icon: Brain,     title: 'AI Tutor Chat',          desc: 'Ask anything. RAG-powered answers grounded in your documents with source citations and adaptive explanations.' },
  { icon: Sparkles,  title: 'Adaptive Understanding', desc: 'Your personal explanation depth — beginner, intermediate, or advanced — adapts per topic as you learn.' },
  { icon: BarChart3, title: 'Deep Analytics',         desc: 'Study heatmaps, quiz trends, mastery progression, and ML-powered insights from your real learning data.' },
  { icon: BookOpen,  title: 'Personalized Roadmap',  desc: 'AI-generated daily plans based on your mastery, deadlines, and available time. Spaced repetition built-in.' },
];

const STEPS = [
  'Upload your PDF study material',
  'Ask the AI tutor questions grounded in your document',
  'Take adaptive quizzes that update your topic mastery',
  'Track sessions and see your progress in real analytics',
];

export function Landing() {
  return (
    <div className="min-h-screen bg-[#05081a] bg-mesh text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-[#05081a]/80 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl">LearnOn</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
          <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold mb-6">
            <Sparkles size={12} /> AI-Powered Adaptive Learning Platform
          </div>
          <h1 className="font-display font-black text-5xl md:text-7xl leading-tight mb-6 max-w-4xl mx-auto">
            Upload. Understand.<br />
            <span className="text-gradient">Practice. Improve.</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            LearnOn is your intelligent study companion. Upload PDFs, chat with an AI tutor grounded in your materials, take adaptive quizzes, and watch your understanding grow — tracked in real analytics.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-primary px-8 py-3.5 text-base">
              Start Learning Free <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn-secondary px-8 py-3.5 text-base">
              Sign In
            </Link>
          </div>
        </motion.div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
          className="mt-16 max-w-5xl mx-auto rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-violet-900/30"
        >
          <div className="bg-surface-900 px-4 py-3 flex items-center gap-2 border-b border-white/8">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <span className="text-slate-500 text-xs ml-2">learnon.app — AI Tutor</span>
          </div>
          <div className="bg-surface-800 p-6 grid md:grid-cols-2 gap-4 text-left min-h-64">
            <div className="space-y-3">
              <div className="glass p-4 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">You asked</p>
                <p className="text-sm text-slate-200">"Explain the difference between supervised and unsupervised learning"</p>
              </div>
              <div className="glass p-4 rounded-xl border border-violet-500/20">
                <p className="text-xs text-violet-400 mb-1">LearnOn AI · Beginner Mode</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Think of it like teaching a child to sort fruits 🍎🍋. In <strong>supervised learning</strong>, you show examples with labels ("this is an apple"). In <strong>unsupervised learning</strong>, the model finds patterns on its own without labels...
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="source-citation">📄 Page 12</span>
                  <span className="source-citation">📄 Page 15</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="glass p-3 rounded-xl border border-green-500/20">
                <p className="text-xs text-green-400 mb-1">Quiz Result</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Machine Learning Basics</span>
                  <span className="text-green-400 font-bold">87%</span>
                </div>
                <div className="progress-bar mt-2">
                  <div className="progress-fill" style={{ width: '87%' }} />
                </div>
              </div>
              <div className="glass p-3 rounded-xl">
                <p className="text-xs text-slate-500 mb-2">Topic Mastery</p>
                {[['Neural Networks', 72], ['Regression', 91], ['Clustering', 45]].map(([t, s]) => (
                  <div key={t} className="mb-1.5">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">{t}</span>
                      <span className="text-violet-400">{s}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${s}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-display font-bold text-4xl text-white mb-3">Everything you need to master any subject</h2>
          <p className="text-slate-400 text-lg">Powered by RAG, spaced repetition, and machine learning</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div key={title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }} viewport={{ once: true }}
              className="card-hover">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mb-4">
                <Icon size={20} className="text-violet-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 max-w-3xl mx-auto text-center">
        <h2 className="font-display font-bold text-4xl text-white mb-3">How it works</h2>
        <p className="text-slate-400 mb-10">Four steps to measurable improvement</p>
        <div className="space-y-4 text-left">
          {STEPS.map((step, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }} viewport={{ once: true }}
              className="flex items-center gap-4 glass p-4 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {i + 1}
              </div>
              <p className="text-slate-200 font-medium">{step}</p>
              <CheckCircle size={18} className="text-violet-400 ml-auto shrink-0" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto glass-strong p-10 rounded-3xl glow-border">
          <h2 className="font-display font-bold text-4xl text-white mb-4">Ready to learn smarter?</h2>
          <p className="text-slate-400 mb-8">Join students who are already learning with AI-powered personalization.</p>
          <Link to="/register" className="btn-primary px-10 py-4 text-base">
            Create Free Account <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 px-6 text-center text-slate-500 text-sm">
        <p>© 2026 LearnOn · Upload. Understand. Practice. Improve.</p>
      </footer>
    </div>
  );
}
