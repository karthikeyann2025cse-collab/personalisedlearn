import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  MessageSquare,
  Sparkles,
  Trash2,
  Plus,
  Volume2,
  VolumeX,
  Download,
  FileText,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import { chatApi, documentsApi } from '../api/client';
import type { ChatMessage, Conversation, Document } from '../types';

export function Chat() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [convId, setConvId] = useState<number | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState('English');
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<{ page_number?: number; excerpt?: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], refetch: refetchConvs } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => chatApi.listConversations().then((r) => r.data),
  });

  const { data: docs = [] } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send initial message from navigation state (e.g. from KnowledgeMap)
  useEffect(() => {
    const stateMsg = (location.state as any)?.initialMessage;
    if (stateMsg) {
      // Clear state so refreshing doesn't resend
      window.history.replaceState({}, '');
      sendMessage(stateMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConversation = async (id: number) => {
    setConvId(id);
    const res = await chatApi.getMessages(id);
    setMessages(res.data);
  };

  const newChat = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeakingMsgId(null);
    setConvId(undefined);
    setMessages([]);
  };

  const sendMessage = async (overrideContent?: string) => {
    const content = (overrideContent || input).trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', content, created_at: new Date().toISOString() },
    ]);
    try {
      const res = await chatApi.sendMessage({
        content,
        document_id: docId ? Number(docId) : undefined,
        conversation_id: convId,
        language,
      });
      const newMsg = res.data;
      setMessages((prev) => [...prev, newMsg]);
      // Track conversation for multi-turn continuity
      if (!convId && newMsg?.conversation_id) {
        setConvId(newMsg.conversation_id);
      }
      if (!convId) refetchConvs();
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Error: ${e?.response?.data?.detail || 'Unable to connect to AI tutor.'}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Text-to-speech
  const toggleSpeech = (id: number, text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingMsgId(id);
    }
  };

  // Copy to clipboard
  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export conversation as Markdown
  const exportConversation = () => {
    if (messages.length === 0) return;
    const title = `# LearnOn AI Tutoring Session\nDate: ${new Date().toLocaleString()}\nLanguage: ${language}\n\n---\n\n`;
    const body = messages
      .map(
        (m) =>
          `### ${m.role === 'user' ? 'Student' : 'LearnOn AI Tutor'}\n${m.content}\n${
            m.sources && m.sources.length > 0
              ? `\n*Citations: Pages ${m.sources.map((s) => s.page_number).join(', ')}*\n`
              : ''
          }\n`
      )
      .join('\n');

    const blob = new Blob([title + body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LearnOn_Notes_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const QUICK = ['Simplify', 'Explain Deeper', 'Give Example', 'Show Formula', 'Summarize', 'Generate Quiz'];
  const readyDocs = docs.filter((d) => d.status === 'ready');

  return (
    <div className="flex h-full">
      {/* Sidebar — conversations */}
      <div className="w-64 border-r border-white/8 flex flex-col bg-surface-900 shrink-0">
        <div className="p-3 border-b border-white/8">
          <button onClick={newChat} className="btn-primary w-full justify-center py-2 text-sm flex items-center gap-2">
            <Plus size={15} /> New Chat
          </button>
        </div>

        {readyDocs.length > 0 && (
          <div className="p-3 border-b border-white/8">
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Chat with document</p>
            {readyDocs.slice(0, 5).map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  newChat();
                  navigate(`/chat/${d.id}`);
                }}
                className="w-full text-left text-xs px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/6 truncate transition-colors flex items-center gap-1.5"
              >
                <FileText size={13} className="shrink-0 text-indigo-400" />
                <span className="truncate">{d.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-xs text-slate-500 font-medium px-2 py-1 uppercase tracking-wide">History</p>
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-600 px-2 py-3">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-all mb-0.5 ${
                  convId === c.id
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/6'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={12} />
                  <span className="truncate">{c.title || 'Chat'}</span>
                </div>
                <span className="text-slate-600 ml-4">{c.mode}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-surface-900 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-700 flex items-center justify-center">
            <Bot size={16} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white text-sm">LearnOn AI Tutor</p>
            <p className="text-xs text-slate-500">
              {docId ? 'Document-grounded answers with citations' : 'General tutoring mode'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={exportConversation}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                title="Export conversation as Markdown"
              >
                <Download size={13} /> Export Notes
              </button>
            )}

            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-xs bg-white/6 border border-white/10 rounded-lg px-2 py-1 text-slate-300"
            >
              <option>English</option>
              <option>Tamil</option>
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={26} className="text-violet-400" />
                </div>
                <h2 className="font-display font-bold text-xl text-white mb-2">Ask me anything</h2>
                <p className="text-sm text-slate-400 mb-5">
                  {docId
                    ? "I'll answer using your uploaded document and cite the source pages."
                    : "I'm your general AI tutor. Ask me about any topic."}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Explain the main concept', 'Summarize this topic', 'Create a quiz for me'].map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === 'user' ? 'bg-violet-600' : 'bg-gradient-to-br from-violet-700 to-blue-700'
                }`}
              >
                {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
              </div>
              <div className={`${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'} group relative`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Citations */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-white/10">
                    <span className="text-[11px] text-slate-400 font-semibold self-center mr-1">Citations:</span>
                    {msg.sources.map((s, si) => (
                      <button
                        key={si}
                        onClick={() => setSelectedCitation(s)}
                        className="source-citation hover:bg-indigo-600/30 transition-all flex items-center gap-1 text-xs"
                      >
                        📄 Page {s.page_number}
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer Controls: Audio Narration & Copy */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between mt-2 pt-2 text-xs text-slate-500">
                    <div>
                      {msg.mastery_level_used && (
                        <span>
                          Level: <span className="text-violet-400 capitalize">{msg.mastery_level_used}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleSpeech(msg.id || i, msg.content)}
                        className={`p-1 rounded hover:bg-white/10 transition-colors ${
                          speakingMsgId === (msg.id || i) ? 'text-indigo-400' : 'text-slate-400'
                        }`}
                        title="Listen to response"
                      >
                        {speakingMsgId === (msg.id || i) ? <VolumeX size={13} /> : <Volume2 size={13} />}
                      </button>
                      <button
                        onClick={() => handleCopy(msg.id || i, msg.content)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 transition-colors"
                        title="Copy text"
                      >
                        {copiedId === (msg.id || i) ? (
                          <Check size={13} className="text-emerald-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-700 to-blue-700 flex items-center justify-center mt-1 shrink-0">
                <Bot size={13} />
              </div>
              <div className="chat-bubble-ai flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Citation Detail Modal/Drawer */}
        <AnimatePresence>
          {selectedCitation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mx-5 mb-2 p-3.5 bg-slate-800 border border-indigo-500/40 rounded-xl shadow-lg flex items-start justify-between gap-3 text-xs"
            >
              <div>
                <span className="font-bold text-indigo-300">Source Excerpt (Page {selectedCitation.page_number}):</span>
                <p className="text-slate-300 mt-1 italic leading-relaxed">
                  "{selectedCitation.excerpt || 'Referenced passage from uploaded study material.'}"
                </p>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                className="text-slate-400 hover:text-white shrink-0 p-1"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick commands */}
        <div className="px-5 py-2 flex gap-2 overflow-x-auto border-t border-white/6 shrink-0">
          {QUICK.map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendMessage(cmd)}
              className="shrink-0 text-xs px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-5 pb-5 pt-2 shrink-0">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask a question or type a command..."
              className="input flex-1"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className="btn-primary px-4 disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-2 text-center">
            Answers grounded in your documents &bull; Source citations & voice audio narration included
          </p>
        </div>
      </div>
    </div>
  );
}
