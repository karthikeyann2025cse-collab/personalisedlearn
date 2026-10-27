import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Trash2, MessageSquare, Eye, Clock, CheckCircle2, XCircle, Loader2, BookOpen } from 'lucide-react';
import { documentsApi } from '../api/client';
import type { Document } from '../types';

function StatusBadge({ status }: { status: Document['status'] }) {
  const map = {
    pending:    { label: 'Pending',    cls: 'badge-blue',   icon: Clock },
    processing: { label: 'Processing', cls: 'badge-yellow', icon: Loader2 },
    ready:      { label: 'Ready',      cls: 'badge-green',  icon: CheckCircle2 },
    failed:     { label: 'Failed',     cls: 'badge-red',    icon: XCircle },
  };
  const { label, cls, icon: Icon } = map[status];
  return (
    <span className={`${cls} flex items-center gap-1`}>
      <Icon size={11} className={status === 'processing' ? 'animate-spin' : ''} />
      {label}
    </span>
  );
}

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [subject, setSubject] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    setProgress(0);
    try {
      await documentsApi.upload(file, subject.trim() || undefined, setProgress);
      setSubject('');
      onUploaded();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Upload failed. Please ensure backend is running.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDrop = useCallback(async (accepted: File[]) => {
    if (accepted && accepted.length > 0) {
      await handleUploadFile(accepted[0]);
    }
  }, [subject, onUploaded]);

  const onDropRejected = useCallback((rejections: any[]) => {
    if (rejections && rejections.length > 0) {
      const firstErr = rejections[0]?.errors?.[0]?.message || 'File rejected. Supported: PDF, TXT, MD up to 50MB.';
      setError(firstErr);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/x-pdf': ['.pdf'],
      'text/plain': ['.txt', '.text'],
      'text/markdown': ['.md'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: uploading,
  });

  const onManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className="glass p-6 rounded-2xl mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Upload size={18} className="text-violet-400" /> Upload Study Material
        </h2>
        <span className="text-xs text-slate-400 font-mono">PDF · TXT · MD (Max 50MB)</span>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          disabled={uploading}
          className="input flex-1"
          placeholder="Subject or module name (optional, e.g. Machine Learning, Physics)"
        />
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-violet-500 bg-violet-500/15 scale-[1.01]' : 'border-white/15 hover:border-violet-500/60 hover:bg-violet-500/5'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div>
            <Loader2 size={32} className="animate-spin text-violet-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-medium mb-2">Processing & Indexing Document...</p>
            <div className="progress-bar max-w-xs mx-auto">
              <div className="progress-fill" style={{ width: `${Math.max(progress, 15)}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{progress}% uploaded</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 text-violet-400 mx-auto flex items-center justify-center">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-200 font-semibold">
                {isDragActive ? 'Drop your file right here!' : 'Drag & drop your study document here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">or click anywhere in this box to select from your device</p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="btn-primary text-xs py-2 px-4 shadow-md inline-flex items-center gap-1.5"
              >
                <BookOpen size={14} /> Browse File Directly
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.text,application/pdf"
                className="hidden"
                onChange={onManualFileSelect}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <XCircle size={16} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export function Library() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then(r => r.data),
    refetchInterval: (q) => q.state.data?.some(d => d.status === 'processing' || d.status === 'pending') ? 3000 : false,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const fmt = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">PDF Library</h1>
        <p className="page-subtitle">Upload, manage, and study your documents</p>
      </div>

      <UploadZone onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />

      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="empty-state glass rounded-2xl">
          <div className="empty-state-icon"><BookOpen size={24} /></div>
          <p className="font-medium text-white mb-1">No documents yet</p>
          <p className="text-sm text-slate-400">Upload your first PDF to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {docs.map((doc) => (
              <motion.div key={doc.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass p-4 rounded-xl flex items-center gap-4 hover:border-violet-500/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-violet-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{doc.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{fmt(doc.file_size)}</span>
                    {doc.page_count > 0 && <span>{doc.page_count} pages</span>}
                    {doc.subject && <span className="badge-violet">{doc.subject}</span>}
                  </div>
                  {doc.summary && (
                    <p className="text-xs text-slate-400 mt-1 truncate">{doc.summary}</p>
                  )}
                  {doc.error_message && (
                    <p className="text-xs text-red-400 mt-1">{doc.error_message}</p>
                  )}
                </div>

                <StatusBadge status={doc.status} />

                <div className="flex items-center gap-1 shrink-0">
                  {doc.status === 'ready' && (
                    <>
                      <button onClick={() => navigate(`/library/${doc.id}`)}
                        className="btn-ghost p-2" title="Read">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => navigate(`/chat/${doc.id}`)}
                        className="btn-ghost p-2" title="Chat">
                        <MessageSquare size={16} />
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteMut.mutate(doc.id)}
                    className="btn-ghost p-2 hover:text-red-400" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
