"use client";
import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { checkKbHealth, testChat } from '../../services/kbClient';

export function KbTestChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const endRef = useRef(null);

  useEffect(() => {
    checkKbHealth().then(setHealth);
    const timer = setInterval(() => checkKbHealth().then(setHealth), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const result = await testChat(text, sessionId);
      if (result.session_id) setSessionId(result.session_id);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: result.reply,
          chunks: result.chunks || [],
          chunksUsed: result.chunks_used ?? (result.chunks?.length || 0),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text: `Error: ${err.message}`, chunks: [], chunksUsed: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSources = (id) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="glass-panel rounded-xl border border-purple-500/20 flex flex-col h-full min-h-[420px] max-h-[calc(100vh-8rem)]">
      <div className="p-4 border-b border-slate-900/80">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-purple-400" />
          Test Knowledge Chat
        </h3>
        <div className="flex flex-wrap gap-2 mt-2">
          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
              health?.status === 'ok'
                ? 'text-emerald-400 border-emerald-800/50 bg-emerald-950/30'
                : 'text-rose-400 border-rose-800/50 bg-rose-950/30'
            }`}
          >
            BFF: {health?.status === 'ok' ? 'connected' : 'offline'}
          </span>
          {health?.status === 'ok' && (
            <span className="text-[10px] font-mono text-slate-500">
              Indexed: {health.indexed_sources ?? 0}
              {health.vertex_configured ? ' · Vertex RAG' : ' · Local dev'}
            </span>
          )}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-8">
            Ask a policy or FAQ question to verify your knowledge base is working.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            <div
              className={`max-w-[95%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-purple-600/20 border border-purple-500/30 text-slate-100'
                  : 'bg-slate-950/60 border border-slate-800 text-slate-300'
              }`}
            >
              <p>{msg.text}</p>
              {msg.role === 'assistant' && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => toggleSources(msg.id)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    {expandedSources[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Sources ({msg.chunksUsed ?? 0})
                  </button>
                  {expandedSources[msg.id] && msg.chunks?.length > 0 && (
                    <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                      {msg.chunks.map((chunk, idx) => (
                        <p key={idx} className="text-[10px] text-slate-500 bg-slate-900/50 p-2 rounded line-clamp-3">
                          {chunk.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Retrieving &amp; generating...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-900/80 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="e.g. What is your return policy?"
          className="flex-grow px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 rounded-lg text-white"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
