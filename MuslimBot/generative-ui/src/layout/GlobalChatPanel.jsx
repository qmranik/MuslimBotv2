"use client";
import React, { useEffect, useRef, useState } from 'react';
import {
  Send, Sparkles, RefreshCw, MessageCircle, ChevronDown, ChevronUp, X, Mic,
} from 'lucide-react';
import { GenerativeMessageRenderer } from '../components/chat/GenerativeMessageRenderer';
import { VoiceCallPanel } from '../components/knowledge/VoiceCallPanel';
import { checkKbHealth, testChat } from '../services/kbClient';

const QUICK_REPLIES = [
  { label: 'Approve & Send', prompt: 'Create invoice for the first customer with one product' },
  { label: 'Modify Items', prompt: 'Show low stock items in a table' },
  { label: 'Analyze Trend', prompt: 'Show me a bar chart of monthly revenue vs expenses trend' },
];

function KbChatMessages({ messages, loading, expandedSources, onToggleSources }) {
  return (
    <>
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
          <div
            className={`max-w-[95%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-100 border border-indigo-200 text-slate-800'
                : 'panel-card text-slate-600'
            }`}
          >
            <p>{msg.text}</p>
            {msg.role === 'assistant' && msg.chunks?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => onToggleSources(msg.id)}
                  className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  {expandedSources[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Sources ({msg.chunksUsed ?? msg.chunks.length})
                </button>
                {expandedSources[msg.id] && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.chunks.map((chunk, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-2 py-1 bg-slate-100 border border-slate-200 rounded-full text-slate-600 truncate max-w-full"
                      >
                        {chunk.source || chunk.title || `Chunk ${idx + 1}`}
                      </span>
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
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Retrieving...
        </div>
      )}
    </>
  );
}

export function GlobalChatPanel({
  mode,
  open,
  onClose,
  isKnowledgeMode,
  chat,
}) {
  const endRef = useRef(null);
  const [kbMessages, setKbMessages] = useState([]);
  const [kbInput, setKbInput] = useState('');
  const [kbLoading, setKbLoading] = useState(false);
  const [kbSessionId, setKbSessionId] = useState('');
  const [kbHealth, setKbHealth] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const [showVoice, setShowVoice] = useState(false);

  const {
    messages,
    input,
    setInput,
    isLoading,
    erpConnected,
    dataSource,
    actionStates,
    handleSubmit,
    handleExecuteAction,
    handleCancelAction,
  } = chat;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, kbMessages, isLoading, kbLoading]);

  useEffect(() => {
    if (!isKnowledgeMode) return undefined;
    checkKbHealth().then(setKbHealth);
    const timer = setInterval(() => checkKbHealth().then(setKbHealth), 30000);
    return () => clearInterval(timer);
  }, [isKnowledgeMode]);

  const handleKbSubmit = async (e) => {
    e.preventDefault();
    const text = kbInput.trim();
    if (!text || kbLoading) return;
    setKbInput('');
    setKbMessages((prev) => [...prev, { id: Date.now(), role: 'user', text }]);
    setKbLoading(true);
    try {
      const result = await testChat(text, kbSessionId);
      if (result.session_id) setKbSessionId(result.session_id);
      setKbMessages((prev) => [
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
      setKbMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text: `Error: ${err.message}`, chunks: [] },
      ]);
    } finally {
      setKbLoading(false);
    }
  };

  const toggleSources = (id) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (mode === 'overlay' && !open) return null;

  const showPanel = mode === 'docked' || open;
  if (!showPanel) return null;

  const panelClasses =
    mode === 'docked'
      ? 'flex flex-col h-full min-h-0 bg-white'
      : 'fixed bottom-24 right-6 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(560px,calc(100vh-8rem))] panel-elevated rounded-2xl shadow-2xl flex flex-col overflow-hidden';

  return (
    <div className={panelClasses}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isKnowledgeMode ? 'Knowledge Chat' : 'Muslimbot Assistant'}
            </h3>
            {isKnowledgeMode && kbHealth && (
              <p className="text-[10px] text-slate-500">
                BFF: {kbHealth.status === 'ok' ? 'connected' : 'offline'}
                {kbHealth.indexed_sources != null ? ` · ${kbHealth.indexed_sources} indexed` : ''}
              </p>
            )}
          </div>
        </div>
        {mode === 'overlay' && (
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {isKnowledgeMode ? (
          kbMessages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">Ask a policy or FAQ question.</p>
          ) : (
            <KbChatMessages
              messages={kbMessages}
              loading={kbLoading}
              expandedSources={expandedSources}
              onToggleSources={toggleSources}
            />
          )
        ) : messages.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
            <p className="text-xs text-slate-500">Ask anything about your ERP data.</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={(e) => handleSubmit(e, q.prompt)}
                  className="text-[10px] px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-semibold hover:bg-indigo-100"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) =>
            msg.sender === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="px-3 py-2 bg-indigo-100 border border-indigo-200 rounded-xl rounded-tr-sm text-xs text-slate-800 max-w-[90%]">
                  {msg.text}
                </div>
              </div>
            ) : (
              <GenerativeMessageRenderer
                key={msg.id}
                msg={msg}
                actionStates={actionStates}
                erpConnected={erpConnected}
                dataSource={dataSource}
                onExecuteAction={handleExecuteAction}
                onCancelAction={handleCancelAction}
              />
            )
          )
        )}
        {isLoading && !isKnowledgeMode && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Analyzing...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {isKnowledgeMode && showVoice && (
        <div className="border-t border-slate-200 p-2 max-h-48 overflow-hidden shrink-0">
          <VoiceCallPanel />
        </div>
      )}

      <form
        onSubmit={isKnowledgeMode ? handleKbSubmit : handleSubmit}
        className="p-3 border-t border-slate-200 flex gap-2 shrink-0"
      >
        {isKnowledgeMode && (
          <button
            type="button"
            onClick={() => setShowVoice((v) => !v)}
            className={`p-2 rounded-lg border ${
              showVoice ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
        <input
          type="text"
          value={isKnowledgeMode ? kbInput : input}
          onChange={(e) => (isKnowledgeMode ? setKbInput(e.target.value) : setInput(e.target.value))}
          disabled={isKnowledgeMode ? kbLoading : isLoading}
          placeholder={isKnowledgeMode ? 'Ask your knowledge base...' : 'Query ERP...'}
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-400"
        />
        <button
          type="submit"
          disabled={(isKnowledgeMode ? kbLoading : isLoading) || !(isKnowledgeMode ? kbInput.trim() : input.trim())}
          className="p-2 accent-gradient text-white rounded-xl disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
