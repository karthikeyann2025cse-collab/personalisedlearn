import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, MessageSquare, Brain,
  Clock, BarChart3, Map, BookOpen, Settings,
  ChevronLeft, ChevronRight, Sparkles, LogOut, Zap,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library',      icon: FileText,         label: 'PDF Library' },
  { to: '/chat',         icon: MessageSquare,    label: 'AI Tutor' },
  { to: '/quiz',         icon: Brain,            label: 'Quiz Studio' },
  { to: '/timer',        icon: Clock,            label: 'Study Timer' },
  { to: '/analytics',    icon: BarChart3,        label: 'Analytics' },
  { to: '/planner',      icon: BookOpen,         label: 'Study Planner' },
  { to: '/knowledge-map',icon: Map,              label: 'Knowledge Map' },
  { to: '/insights',     icon: Sparkles,         label: 'AI Insights' },
  { to: '/profile',      icon: Settings,         label: 'Profile' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-full bg-surface-900 border-r border-white/8 overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/50">
          <Zap size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="overflow-hidden">
              <p className="font-display font-bold text-white text-lg leading-none">LearnOn</p>
              <p className="text-[10px] text-violet-400 font-medium tracking-wide">AI LEARNING</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to} to={to}
            className={({ isActive }) =>
              clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/6')
            }
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="overflow-hidden whitespace-nowrap">{label}</motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0 text-sm font-bold text-white">
            {user?.username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.username}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Logout">
                <LogOut size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-surface-700 border border-white/15
                   flex items-center justify-center text-slate-400 hover:text-white hover:bg-violet-600 
                   transition-all duration-200 z-10 shadow-lg"
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
