"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Mic, Send, X, Loader2, BookOpen, ArrowLeft } from 'lucide-react';
import { testChat } from '../../services/kbClient';
import { VoiceCallPanel } from './VoiceCallPanel';

const SUGGESTIONS = [
  'What is our return policy?',
  'Summarize the latest document',
  'What are the delivery timeframes?',
  'Key points from the handbook',
];

/**
 * Floating "Test Agent" widget for the Knowledge Hub.
 * - Closed: a FAB launcher (agent icon) at bottom-right.
 * - Open: a popup chat widget on the right.
 * - The action button morphs: Mic (voice) when the input is empty →
 *   Send when the user types. Voice mode reuses VoiceCallPanel.
 */
export function KbAgentWidget({ scope = 'private' }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' | 'voice'
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((p) => [...p, { id: Date.now(), role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await testChat(q, sessionId);
      if (res.session_id) setSessionId(res.session_id);
      setMessages((p) => [...p, {
        id: Date.now() + 1,
        role: 'assistant',
        text: res.reply || res.answer || '(no answer returned)',
        chunks: res.chunks_used ?? (res.chunks?.length || 0),
      }]);
    } catch (err) {
      setMessages((p) => [...p, { id: Date.now() + 1, role: 'assistant', text: `Error: ${err.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const hasText = input.trim().length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open test agent"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-white shadow-lg shadow-emerald-900/30 transition-transform hover:scale-105"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-semibold">Test Agent</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-gray-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">Test Agent</p>
          <p className="text-[10px] capitalize text-slate-400">{scope} knowledge · RAG</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close"
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      {view === 'voice' ? (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <button type="button" onClick={() => setView('chat')}
            className="mb-2 inline-flex items-center gap-1 self-start text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to chat
          </button>
          <div className="min-h-0 flex-1"><VoiceCallPanel /></div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                  <BookOpen className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ask your knowledge base</p>
                <p className="text-xs text-slate-400">Type a question, or tap the mic to talk to the agent.</p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-gray-700 dark:text-slate-300">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-emerald-600 text-white'
                      : m.error
                        ? 'border border-rose-200 bg-rose-50 text-rose-700'
                        : 'rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-gray-800 dark:text-slate-100'
                  }`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.role === 'assistant' && !m.error && m.chunks > 0 && (
                      <p className="mt-1 text-[10px] opacity-60">{m.chunks} source{m.chunks > 1 ? 's' : ''} used</p>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-gray-800">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); if (hasText) send(); }}
            className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-gray-800"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the knowledge base…"
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-gray-700 dark:bg-gray-800"
            />
            {hasText ? (
              <button type="submit" disabled={loading} aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform hover:scale-105 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={() => setView('voice')} aria-label="Talk to the agent"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform hover:scale-105">
                <Mic className="h-4 w-4" />
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}
