import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { authApi } from '../api/client';
import { useAuthStore } from '../store';

export function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '', full_name: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await authApi.register(form);
      const res = await authApi.login(form.email, form.password);
      setToken(res.data.access_token);
      const me = await authApi.me();
      setUser(me.data);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05081a] bg-mesh flex items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-2xl text-white">LearnOn</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">Start your personalized learning journey</p>
        </div>

        <div className="glass-strong p-8 rounded-2xl">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-5">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-name" type="text" value={form.full_name} onChange={set('full_name')}
                  className="input pl-10" placeholder="Jane Smith" />
              </div>
            </div>
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-username" type="text" required value={form.username} onChange={set('username')}
                  className="input pl-10" placeholder="janesmith" />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-email" type="email" required value={form.email} onChange={set('email')}
                  className="input pl-10" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="label">Password <span className="text-slate-500 font-normal">(min 8 chars)</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-password" type={showPw ? 'text' : 'password'} required value={form.password} onChange={set('password')}
                  className="input pl-10 pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button id="reg-submit" type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? <span className="animate-spin border-2 border-white/20 border-t-white rounded-full w-4 h-4" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
