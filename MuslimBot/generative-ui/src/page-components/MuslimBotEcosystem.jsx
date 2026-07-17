"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles, Database, Mic, ArrowRight } from 'lucide-react';

const EVENTS = [
  '[02:14:00] Ingesting Hadith and Fiqh source datasets... Vector database alignment verified.',
  '[02:14:15] Access token dispatched from Go Orchestrator Gateway via secure wildcard cookieflow.',
  '[02:14:32] n8n automation webhook invoked successfully. Sync pattern complete.',
  '[02:14:48] Muslimbot Voice Worker Engine running on LiveKit... Session Secure.',
  '[02:15:02] SSO connected vectors: n8n, Chatwoot, TryPost, liteERP.',
];

export function MuslimBotEcosystem({ onEnterAdmin }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#020408] text-slate-200 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-400" />
          <span className="font-display font-bold text-white tracking-tight">MuslimBot AI Ecosystem</span>
        </div>
        <button
          type="button"
          onClick={onEnterAdmin}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          Enter Admin OS
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16 space-y-20">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="w-24 h-24 mx-auto rounded-3xl border border-emerald-500/30 bg-emerald-950/40 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white max-w-3xl mx-auto leading-tight">
            The Convergence of Traditional Knowledge and Agentic Execution
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            LiveKit voice worker, Vertex RAG knowledge vault, and ERP synthesis in one intelligence layer.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 text-[11px] font-mono text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Muslimbot Voice Worker on LiveKit — Session Secure
          </div>
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            <button type="button" className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-500">
              Initialize Neural Gateway
            </button>
            <button type="button" onClick={onEnterAdmin} className="px-6 py-3 rounded-xl border border-white/10 text-sm font-semibold text-slate-300 hover:bg-white/5">
              Examine Architectural Map
            </button>
          </div>
        </motion.section>

        <section className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Database, title: 'Knowledge Vault (RAG Sync)', desc: 'PDF, markdown, and web scrapes indexed into semantic embeddings.' },
            { icon: Mic, title: 'Voice Framework Stream', desc: 'LiveKit WebRTC path with real-time ERP tool execution.' },
            { icon: Bot, title: 'Enterprise ERP Synthesis', desc: 'Human-in-the-loop validation for stock, orders, and POS checkout.' },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-5 rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl"
            >
              <card.icon className="w-6 h-6 text-emerald-400 mb-3" />
              <h3 className="text-sm font-bold text-white mb-2">{card.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Indexing Latency', value: '<14ms' },
            { label: 'Context Token Horizon', value: '2.5M Tokens' },
            { label: 'SSO Connected Vectors', value: '4 Services' },
          ].map((m) => (
            <div key={m.label} className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{m.label}</p>
              <p className="text-2xl font-display font-bold text-emerald-400">{m.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/5 bg-black/40 p-4 max-h-48 overflow-hidden">
          <div className="space-y-2 font-mono text-[11px] text-emerald-300/80">
            {[...EVENTS, ...EVENTS].slice(tick % EVENTS.length, tick % EVENTS.length + 4).map((line, i) => (
              <motion.p key={`${tick}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {line.startsWith('[') ? `✔ ${line}` : line}
              </motion.p>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
