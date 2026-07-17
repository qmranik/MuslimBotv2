"use client";
import React, { useCallback, useRef, useState } from 'react';
import {
  BookOpen, UploadCloud, FolderUp, Link2, Globe, FileText,
  Loader2, CheckCircle2, XCircle, Lock, Users,
} from 'lucide-react';
import { uploadDocument, addUrlSource, addScrapeSource } from '../services/kbClient';
import { SourceList } from '../components/knowledge/SourceList';
import { KbAgentWidget } from '../components/knowledge/KbAgentWidget';

const SCOPES = [
  {
    id: 'private',
    label: 'Private Knowledge',
    icon: Lock,
    blurb: 'Internal-only. Visible to staff and authenticated members of this organization.',
  },
  {
    id: 'public',
    label: 'Public Knowledge',
    icon: Users,
    blurb: 'Customer-facing. Powers the support bot and public portals.',
  },
];

const MODES = [
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'folder', label: 'Folder', icon: FolderUp },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'website', label: 'Website', icon: Globe },
];

const ACCEPTED = '.pdf,.doc,.docx,.txt,.md,.markdown,.csv,.xlsx,.pptx,.json,.html';

// Crawl presets → depth. "Entire website" follows links across the domain.
const CRAWL_PRESETS = [
  { id: 'page', label: 'Single page', depth: 0, hint: 'Only the exact URL.' },
  { id: 'section', label: 'This section', depth: 1, hint: 'The page plus links one hop away.' },
  { id: 'site', label: 'Entire website', depth: 3, hint: 'Crawl the domain, following links to build a full knowledge base.' },
];

export function KnowledgeHub() {
  const [scope, setScope] = useState('private');
  const [mode, setMode] = useState('files');
  const [refreshKey, setRefreshKey] = useState(0);
  const [feed, setFeed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef(null);
  const folderRef = useRef(null);

  const pushFeed = useCallback((entry) => {
    setFeed((prev) => [{ id: `${Date.now()}-${Math.random()}`, ...entry }, ...prev].slice(0, 20));
  }, []);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const ingestFiles = useCallback(async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setBusy(true);
    for (const file of list) {
      const name = file.webkitRelativePath || file.name;
      try {
        await uploadDocument(file, name, 'document', scope);
        pushFeed({ name, state: 'queued', detail: `${(file.size / 1024 / 1024).toFixed(1)} MB` });
      } catch (err) {
        pushFeed({ name, state: 'error', detail: err.message });
      }
    }
    setBusy(false);
    refresh();
  }, [scope, pushFeed, refresh]);

  const ingestLink = useCallback(async (title, url) => {
    setBusy(true);
    try {
      const res = await addUrlSource({ title, url, visibility: scope });
      pushFeed({ name: url, state: 'queued', detail: res?.url_type || 'link' });
    } catch (err) {
      pushFeed({ name: url, state: 'error', detail: err.message });
    }
    setBusy(false);
    refresh();
  }, [scope, pushFeed, refresh]);

  const ingestWebsite = useCallback(async (title, url, depth) => {
    setBusy(true);
    try {
      await addScrapeSource(title || url, url, depth, scope);
      pushFeed({ name: url, state: 'queued', detail: `crawl depth ${depth}` });
    } catch (err) {
      pushFeed({ name: url, state: 'error', detail: err.message });
    } finally {
      setBusy(false);
      refresh();
    }
  }, [scope, pushFeed, refresh]);

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="p-8 md:p-12 space-y-8 max-w-6xl mx-auto pb-28">
        <header>
          <h1 className="text-3xl md:text-4xl font-display font-medium text-[var(--text-primary)] mb-2 tracking-tight flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            Knowledge Base
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ingest files, folders, links, and entire websites into the RAG engine — scoped
            <span className="font-semibold"> public</span> (customer-facing) or
            <span className="font-semibold"> private</span> (internal).
          </p>
        </header>

        {/* Scope switch — a segmented toggle with a sliding thumb */}
        <div>
          <div
            role="tablist"
            aria-label="Knowledge scope"
            className="relative flex max-w-md rounded-2xl bg-slate-100 p-1 dark:bg-gray-800"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm ring-1 ring-emerald-500/40 transition-transform duration-300 ease-out dark:bg-gray-900 ${
                scope === 'public' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            {SCOPES.map((s) => {
              const Icon = s.icon;
              const active = scope === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setScope(s.id)}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors duration-200 ${
                    active
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 transition-transform duration-300 ${active ? 'scale-110' : 'scale-100'}`} />
                  {s.label.split(' ')[0]}
                </button>
              );
            })}
          </div>
          {/* Cross-fading description for the active scope */}
          <div className="relative mt-2 h-8 max-w-md">
            {SCOPES.map((s) => (
              <p
                key={s.id}
                className={`absolute inset-0 text-xs text-slate-500 transition-opacity duration-300 dark:text-slate-400 ${
                  scope === s.id ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                {s.blurb}
              </p>
            ))}
          </div>
        </div>

        {/* Add knowledge card */}
        <div className="panel-card p-5 md:p-6 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
            <span className="ml-auto text-[11px] text-slate-400">
              Adding to <span className="font-semibold text-slate-600 dark:text-slate-300 capitalize">{scope}</span> knowledge
            </span>
          </div>

          {(mode === 'files' || mode === 'folder') && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); ingestFiles(e.dataTransfer.files); }}
              onClick={() => (mode === 'folder' ? folderRef.current : fileRef.current)?.click()}
              className={`flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all ${
                dragOver ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-300 dark:border-gray-700 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="hidden"
                onChange={(e) => ingestFiles(e.target.files)} />
              <input ref={(el) => { if (el) { el.webkitdirectory = true; folderRef.current = el; } }} type="file" multiple className="hidden"
                onChange={(e) => ingestFiles(e.target.files)} />
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center mb-3">
                {mode === 'folder' ? <FolderUp className="w-5 h-5 text-emerald-600" /> : <UploadCloud className="w-5 h-5 text-emerald-600" />}
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {mode === 'folder' ? 'Select a folder to ingest recursively' : 'Drop files or click to upload'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {mode === 'folder'
                  ? 'Every supported file in the folder tree is chunked, embedded and indexed.'
                  : 'PDF, Word, Excel, CSV, Markdown, TXT, HTML — up to 50 MB each.'}
              </p>
            </div>
          )}

          {mode === 'link' && <LinkForm busy={busy} onSubmit={ingestLink} />}
          {mode === 'website' && <WebsiteForm busy={busy} onSubmit={ingestWebsite} />}

          {feed.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {feed.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-xs">
                  {f.state === 'error'
                    ? <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  <span className="truncate text-slate-700 dark:text-slate-300 max-w-[420px]">{f.name}</span>
                  <span className={`ml-auto shrink-0 ${f.state === 'error' ? 'text-rose-500' : 'text-slate-400'}`}>{f.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live source list, scoped to the selected visibility */}
        <SourceList refreshKey={refreshKey} onRefresh={refresh} visibility={scope} />
      </div>

      {/* Test-agent widget: FAB → right-side popup, morphing send/voice button */}
      <KbAgentWidget scope={scope} />
    </div>
  );
}

function LinkForm({ busy, onSubmit }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) { onSubmit(title.trim(), url.trim()); setTitle(''); setUrl(''); } }}
      className="flex flex-col gap-3"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">
        A single link. YouTube links use the transcript; social/doc links use public metadata.
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required placeholder="https://example.com/faq"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
      <button type="submit" disabled={busy}
        className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
        Add link
      </button>
    </form>
  );
}

function WebsiteForm({ busy, onSubmit }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [preset, setPreset] = useState('site');
  const active = CRAWL_PRESETS.find((p) => p.id === preset) || CRAWL_PRESETS[0];
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) { onSubmit(title.trim(), url.trim(), active.depth); setTitle(''); setUrl(''); } }}
      className="flex flex-col gap-3"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Crawl a website into the knowledge base. &ldquo;Entire website&rdquo; follows links across the domain.
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required placeholder="https://docs.example.com"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
      <div className="flex flex-wrap gap-2">
        {CRAWL_PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => setPreset(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              preset === p.id
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{active.hint}</p>
      <button type="submit" disabled={busy}
        className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        Crawl &amp; index
      </button>
    </form>
  );
}
