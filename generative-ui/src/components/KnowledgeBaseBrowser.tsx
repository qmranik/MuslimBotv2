'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  FileText,
  Globe,
  Database,
  Clock,
  Phone,
  X,
  BookOpen,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  kbChat,
  kbListSources,
  kbVoiceSession,
  kbIngestUrl,
  kbDeleteSource,
  type KBSource,
} from '@/lib/api';

type DocSource = 'pdf' | 'web' | 'api' | 'other';

function sourceIcon(sourceType?: string): DocSource {
  const t = (sourceType || '').toLowerCase();
  if (t.includes('pdf') || t.includes('document') || t.includes('upload')) return 'pdf';
  if (t.includes('url') || t.includes('web') || t.includes('website')) return 'web';
  if (t.includes('api')) return 'api';
  return 'other';
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let color = 'text-secondary bg-surface-hover';
  if (s === 'ready' || s === 'completed' || s === 'success') color = 'text-success bg-success/10 border border-success/20';
  if (s === 'processing' || s === 'ingesting' || s === 'pending') color = 'text-warning bg-warning/10 border border-warning/20 animate-pulse';
  if (s === 'failed' || s === 'error') color = 'text-error bg-error/10 border border-error/20';
  
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}>
      {status}
    </span>
  );
}

export default function KnowledgeBaseBrowser() {
  const [sources, setSources] = useState<KBSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceInfo, setVoiceInfo] = useState<string | null>(null);
  
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestBusy, setIngestBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await kbListSources();
      setSources(res.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge sources');
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((s) => (s.title || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q));
  }, [sources, query]);

  async function onAsk() {
    if (!query.trim()) return;
    setChatBusy(true);
    setChatReply(null);
    try {
      const res = await kbChat(query.trim());
      setChatReply(res.reply || 'No reply');
    } catch (err) {
      setChatReply(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setChatBusy(false);
    }
  }

  async function onIngest() {
    if (!ingestUrl.trim()) return;
    setIngestBusy(true);
    setError(null);
    try {
      await kbIngestUrl(ingestUrl.trim());
      setIngestUrl('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest URL');
    } finally {
      setIngestBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this knowledge source?')) return;
    setDeleteBusyId(id);
    try {
      await kbDeleteSource(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source');
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function onCallMuslimbot() {
    setVoiceBusy(true);
    setVoiceInfo(null);
    try {
      const session = await kbVoiceSession('workspace-user');
      setVoiceInfo(
        `Voice session ready. Room ${session.room_name}. Connect your LiveKit client to ${session.url} with the minted token.`
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('muslimbot:voice-session', { detail: session })
        );
      }
    } catch (err) {
      setVoiceInfo(err instanceof Error ? err.message : 'Failed to start voice session');
    } finally {
      setVoiceBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Knowledge Hub</h1>
          <p className="mt-1 text-sm text-secondary">
            Manage your vector database sources for RAG. Ask questions or call the AI directly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onCallMuslimbot()}
          disabled={voiceBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:outline-none disabled:opacity-60 transition-colors shadow-sm"
        >
          {voiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          Call MuslimBot
        </button>
      </div>

      {/* Main Grid: Left Search/Results, Right Ingest */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 min-h-0">
        
        {/* Left Column (Search & List) */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sources or ask the knowledge base…"
                className="w-full rounded-lg border border-divider bg-surface py-2.5 pl-9 pr-3 text-sm text-primary placeholder:text-secondary focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onAsk();
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void onAsk()}
              disabled={chatBusy || !query.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {chatBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask KB'}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}
          {voiceInfo && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              {voiceInfo}
            </div>
          )}
          {chatReply && (
            <div className="rounded-xl border border-divider bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between bg-surface-hover px-4 py-2 border-b border-divider">
                <div className="flex items-center gap-2 font-semibold text-primary text-sm">
                  <BookOpen className="h-4 w-4 text-accent" /> AI Answer
                </div>
                <button type="button" onClick={() => setChatReply(null)} className="text-secondary hover:text-primary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 text-sm text-primary leading-relaxed whitespace-pre-wrap">
                {chatReply}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-divider bg-surface">
            {loading ? (
              <div className="flex h-48 items-center justify-center gap-2 text-secondary">
                <Loader2 className="h-5 w-5 animate-spin text-accent" /> Loading sources…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-8 text-sm text-secondary">
                <Database className="h-10 w-10 mb-3 opacity-20" />
                No knowledge sources found. <br/>
                Add a URL to ingest content into your RAG database.
              </div>
            ) : (
              <ul className="divide-y divide-divider">
                {filtered.map((doc) => {
                  const kind = sourceIcon(doc.source_type);
                  const Icon = kind === 'pdf' ? FileText : kind === 'web' ? Globe : Database;
                  const isDeleting = deleteBusyId === doc.id;
                  
                  return (
                    <li key={doc.id} className="group flex items-start gap-3 px-5 py-4 hover:bg-surface-hover transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-secondary border border-divider group-hover:text-accent group-hover:border-accent-border transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-primary text-sm">{doc.title || doc.url || doc.id}</div>
                        {doc.url && <div className="truncate text-xs text-secondary mt-0.5">{doc.url}</div>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-secondary">
                          <StatusBadge status={doc.status || 'unknown'} />
                          <span className="capitalize border border-divider px-2 py-0.5 rounded-full bg-surface-hover">{doc.source_type || 'source'}</span>
                          {doc.chunk_count !== undefined && (
                            <span className="border border-divider px-2 py-0.5 rounded-full bg-surface-hover">{doc.chunk_count} chunks</span>
                          )}
                          <span className="inline-flex items-center gap-1 border border-divider px-2 py-0.5 rounded-full bg-surface-hover capitalize">
                            <Clock className="h-3 w-3" /> {doc.visibility || 'private'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => void onDelete(doc.id)}
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 p-2 text-secondary hover:text-error hover:bg-error/10 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-error"
                        title="Delete source"
                      >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column (Actions) */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-divider bg-surface p-5 shadow-sm">
            <h3 className="font-semibold text-primary mb-1">Ingest URL</h3>
            <p className="text-xs text-secondary mb-4">
              Add a webpage to your knowledge base. The system will crawl and chunk the content.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="url"
                value={ingestUrl}
                onChange={(e) => setIngestUrl(e.target.value)}
                placeholder="https://example.com/docs"
                className="w-full rounded-lg border border-divider bg-surface py-2 px-3 text-sm text-primary placeholder:text-secondary focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onIngest();
                }}
              />
              <button
                type="button"
                onClick={() => void onIngest()}
                disabled={ingestBusy || !ingestUrl.trim()}
                className="inline-flex w-full justify-center items-center gap-2 rounded-lg bg-surface-hover border border-divider px-4 py-2 text-sm font-medium text-primary hover:bg-accent hover:text-background hover:border-accent disabled:opacity-50 transition-colors focus:ring-2 focus:ring-accent focus:outline-none"
              >
                {ingestBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Source
              </button>
            </div>
          </div>
          
          <div className="rounded-xl border border-divider bg-surface p-5 shadow-sm">
             <h3 className="font-semibold text-primary mb-1">Upload Document</h3>
             <p className="text-xs text-secondary mb-4">
               Upload PDFs, text files, or CSVs directly to the RAG database.
             </p>
             <button disabled className="w-full border-2 border-dashed border-divider rounded-lg py-6 text-sm text-secondary hover:border-accent-border hover:text-accent transition-colors flex flex-col items-center gap-2 bg-background">
               <Plus className="h-5 w-5" />
               <span>Click to browse</span>
               <span className="text-[10px] opacity-70">Coming soon in Phase 2</span>
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}
