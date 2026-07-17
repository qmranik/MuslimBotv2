"use client";
import React, { useEffect, useState } from 'react';
import { Globe, Loader2, Link2 } from 'lucide-react';
import { addUrlSource, classifyUrl } from '../../services/kbClient';

const TYPE_LABELS = {
  website: 'Website',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  document: 'Document',
  unknown: 'URL',
};

export function UrlSourcePanel({ onUploaded }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [classification, setClassification] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || trimmed.length < 8) {
      setClassification(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await classifyUrl(trimmed);
        setClassification(result);
        if (depth === null) {
          setDepth(result.depth_default ?? 1);
        }
      } catch {
        setClassification(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [url, depth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('URL is required.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await addUrlSource({
        title: title.trim(),
        url: url.trim(),
        depth: classification?.url_type === 'website' ? depth : undefined,
      });
      setSuccess(
        `Queued (${TYPE_LABELS[result.url_type] || result.url_type}): ${result.source}`,
      );
      setTitle('');
      setUrl('');
      setDepth(null);
      setClassification(null);
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
        <Globe className="w-4 h-4 text-indigo-600" />
        Add URL
      </h3>
      <p className="text-[11px] text-slate-500">
        Paste any link — websites are scraped, YouTube transcripts fetched, social pages use public metadata.
      </p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/faq or YouTube / social link"
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
      />
      {classification && (
        <span className="self-start text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border text-indigo-700 border-indigo-200 bg-indigo-50">
          Detected: {TYPE_LABELS[classification.url_type] || classification.url_type}
        </span>
      )}
      {classification?.url_type === 'website' && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} crawl depth
          </button>
          {showAdvanced && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[10px] text-slate-500">Depth</label>
              <input
                type="number"
                min={0}
                max={3}
                value={depth ?? classification.depth_default}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
      <button
        type="submit"
        disabled={busy}
        className="self-start px-4 py-2 accent-gradient text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-40"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
        Add URL &amp; Index
      </button>
    </form>
  );
}
