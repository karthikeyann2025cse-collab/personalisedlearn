import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Send, Bot, User, FileText, ChevronLeft, ChevronRight, Loader2, BookOpen, Sparkles } from 'lucide-react';
import { documentsApi, chatApi } from '../api/client';
import type { Document, DocumentPage, ChatMessage } from '../types';

function SourceBadge({ page }: { page?: number }) {
  if (!page) return null;
  return <span className="source-citation">📄 Page {page}</span>;
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1
        ${isUser ? 'bg-violet-600' : 'bg-gradient-to-br from-violet-700 to-blue-700'}`}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {msg.sources.map((s, i) => <SourceBadge key={i} page={s.page_number} />)}
          </div>
        )}
        {!isUser && msg.mastery_level_used && (
          <p className="text-xs text-slate-600 mt-1.5">
            Explanation level: <span className="text-violet-500">{msg.mastery_level_used}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function Reader() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [convId, setConvId] = useState<number | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState('English');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: doc } = useQuery<Document>({
    queryKey: ['document', docId],
    queryFn: () => documentsApi.get(Number(docId)).then(r => r.data),
    enabled: !!docId,
  });

  const { data: pages = [] } = useQuery<DocumentPage[]>({
    queryKey: ['doc-pages', docId],
    queryFn: () => documentsApi.pages(Number(docId)).then(r => r.data),
    enabled: !!docId && doc?.status === 'ready',
  });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const currentPageData = pages.find(p => p.page_number === currentPage);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);

    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await chatApi.sendMessage({
        content,
        document_id: Number(docId),
        conversation_id: convId,
        language,
      });
      // Track conversation ID for follow-up messages
      if (!convId && res.data?.conversation_id) {
        setConvId(res.data.conversation_id);
      }
      setMessages(prev => [...prev, res.data]);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: Date.now() + 1, role: 'assistant',
        content: `Sorry, I couldn't answer that. ${e?.response?.data?.detail || 'Please try again.'}`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const QUICK_COMMANDS = ['Simplify', 'Explain Deeper', 'Give Example', 'Summarize', 'Generate Quiz'];

  return (
    <div className="flex h-full">
      {/* PDF Viewer panel */}
      <div className="flex-1 flex flex-col border-r border-white/8 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-surface-900 shrink-0">
          <button onClick={() => navigate('/library')} className="btn-ghost p-1.5">
            <ChevronLeft size={18} />
          </button>
          <div className="w-px h-4 bg-white/10" />
          <FileText size={16} className="text-violet-400" />
          <p className="font-medium text-white text-sm truncate flex-1">{doc?.title}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="btn-ghost p-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {currentPage} / {doc?.page_count || pages.length || '?'}
            </span>
            <button onClick={() => setCurrentPage(p => Math.min(doc?.page_count || pages.length, p + 1))}
              disabled={currentPage >= (doc?.page_count || pages.length)}
              className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-6">
          {pages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 size={28} className="animate-spin text-violet-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Loading document...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {currentPageData?.heading && (
                <h2 className="font-display font-bold text-lg text-violet-300 mb-3">{currentPageData.heading}</h2>
              )}
              {currentPageData?.chapter && (
                <p className="text-xs text-slate-500 mb-4 badge badge-violet">{currentPageData.chapter}</p>
              )}
              <div className="glass p-6 rounded-xl">
                <pre className="text-sm text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                  {currentPageData?.text || 'No text content on this page.'}
                </pre>
              </div>
              <p className="text-center text-xs text-slate-600 mt-4">Page {currentPage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="w-96 xl:w-[420px] flex flex-col bg-surface-900">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-700 flex items-center justify-center">
            <Bot size={14} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">AI Tutor</p>
            <p className="text-xs text-slate-500">Grounded in this document</p>
          </div>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            className="text-xs bg-white/6 border border-white/10 rounded-lg px-2 py-1 text-slate-300">
            <option>English</option>
            <option>Tamil</option>
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={22} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium text-white mb-1">Ask me anything</p>
              <p className="text-xs text-slate-400">I'll answer based on this document with source citations</p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {sending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-700 to-blue-700 flex items-center justify-center mt-1">
                <Bot size={13} />
              </div>
              <div className="chat-bubble-ai flex items-center gap-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
                <span className="text-xs text-slate-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick commands */}
        <div className="px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0">
          {QUICK_COMMANDS.map(cmd => (
            <button key={cmd} onClick={() => sendMessage(cmd)}
              className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-colors">
              {cmd}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-3 pb-4 shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about this document..."
              className="input flex-1 py-2.5 text-sm"
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
              className="btn-primary p-2.5 disabled:opacity-40">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
