import React from 'react';
import { Network, Bot, ShieldCheck, Zap } from 'lucide-react';

export default function SolutionSection({ id }) {
  const values = [
    {
      icon: <Network className="neon-icon text-emerald-400" size={24} />,
      title: 'Total Unification',
      desc: 'Instead of tab-switching between five SaaS tools, interact with a single Generative UI that dynamically renders what you need.'
    },
    {
      icon: <Bot className="neon-icon text-emerald-400" size={24} />,
      title: 'Actionable AI',
      desc: 'The AI doesn’t just chat; it executes. Use strict "confirm-before-write" safeguards to generate invoices or schedule marketing posts.'
    },
    {
      icon: <ShieldCheck className="neon-icon text-emerald-400" size={24} />,
      title: '100% Sovereignty',
      desc: 'Deploy via self-hosted Docker. Your data never trains public models, and PII is masked locally before any AI processing.'
    },
    {
      icon: <Zap className="neon-icon text-emerald-400" size={24} />,
      title: 'Autonomous Operations',
      desc: 'Repetitive tasks are handled by autonomous AI agents and complex n8n workflows running silently in the background.'
    }
  ];

  return (
    <section id={id} className="py-24 relative overflow-hidden bg-slate-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-3xl border border-emerald-900/50 bg-slate-900/50 p-8 md:p-16 shadow-[0_0_60px_rgba(16,185,129,0.05)] relative overflow-hidden glass-panel card-aurora">
          
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="mb-16 text-center relative z-10">
            <h2 className="text-3xl font-bold text-white md:text-5xl mb-6 font-display">
              The <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">MuslimBot</span> Solution.
            </h2>
            <p className="mt-4 text-[#F5F5F7]/70 max-w-3xl mx-auto text-lg leading-relaxed">
              Not just another app. A highly capable, sovereign, AI-first operating system built for SMB operators in pharmacy, tech retail, and emerging markets.
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-2 relative z-10">
            {values.map((val, i) => (
              <div key={i} className="flex gap-6 items-start group">
                <div className="flex-shrink-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] group-hover:bg-emerald-500/20 transition-colors">
                  {val.icon}
                </div>
                <div>
                  <h4 className="mb-3 text-xl font-bold text-white">{val.title}</h4>
                  <p className="text-slate-400 leading-relaxed">{val.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
