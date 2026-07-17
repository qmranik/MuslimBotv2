"use client";
import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { uploadDocument } from '../../services/kbClient';

export function UploadPanel({ onUploaded }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const processFile = async (file) => {
    if (!file) {
      setError('Please select a file.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await uploadDocument(file, title || file.name, 'document');
      setSuccess(`Upload queued: ${result.source}`);
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      onUploaded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await processFile(fileRef.current?.files?.[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <Upload className="w-4 h-4 text-indigo-600" />
        Upload Document
      </h3>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 bg-slate-50 hover:border-indigo-300'
        }`}
      >
        <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">Drop files here or click to browse</p>
        <p className="text-[11px] text-slate-500 mt-1">PDF, DOCX, XLSX, CSV, MD, TXT</p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.md,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
      <button
        type="submit"
        disabled={busy}
        className="self-start px-4 py-2 accent-gradient text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-40"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        Upload & Index
      </button>
    </form>
  );
}
