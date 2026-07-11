import React, { useState } from 'react';
import { FileJson, Loader2 } from 'lucide-react';
import { addBulkImport } from '../../services/kbClient';

export function BulkImportPanel({ onUploaded }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      let pagesJson = '';
      const trimmed = content.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        pagesJson = trimmed.startsWith('[') ? trimmed : JSON.stringify([JSON.parse(trimmed)]);
      }
      const result = await addBulkImport(title.trim(), pagesJson ? '' : trimmed, pagesJson);
      setSuccess(`Bulk import queued: ${result.source}`);
      setTitle('');
      setContent('');
      onUploaded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <FileJson className="w-4 h-4 text-indigo-600" />
        Bulk / Scraped Data
      </h3>
      <p className="text-[11px] text-slate-500">
        Paste markdown text or JSON array of pages.
      </p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Bundle title"
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Markdown or JSON pages..."
        rows={6}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono resize-y"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
      <button
        type="submit"
        disabled={busy}
        className="self-start px-4 py-2 accent-gradient text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-40"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
        Import &amp; Index
      </button>
    </form>
  );
}
