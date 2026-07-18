import React from 'react';
import { Database, LayoutTemplate, Clock, ShieldAlert } from 'lucide-react';

export default function ProblemSection({ id }) {
  const problems = [
    {
      icon: <Database size={24} className="neon-icon text-red-400" />,
      title: 'Fragmented Data Silos',
      desc: 'Customer data is fractured. A support agent doesn’t know a customer’s lifetime value, and marketing doesn’t know if a customer has an open, angry support ticket.',
      color: 'border-red-900/30 bg-red-950/10 hover:border-red-900/50',
      iconBg: 'bg-red-500/10 border-red-500/20'
    },
    {
      icon: <LayoutTemplate size={24} className="neon-icon text-amber-400" />,
      title: 'Context Switching',
      desc: 'Employees waste countless hours switching between tabs, copying and pasting data from the ERP to the support desk to the marketing planner.',
      color: 'border-amber-900/30 bg-amber-950/10 hover:border-amber-900/50',
      iconBg: 'bg-amber-500/10 border-amber-500/20'
    },
    {
      icon: <Clock size={24} className="neon-icon text-orange-400" />,
      title: 'Reactive Operations',
      desc: 'Businesses act reactively instead of proactively. Workflows remain manual, error-prone, and painfully slow when scaling.',
      color: 'border-orange-900/30 bg-orange-950/10 hover:border-orange-900/50',
      iconBg: 'bg-orange-500/10 border-orange-500/20'
    },
    {
      icon: <ShieldAlert size={24} className="neon-icon text-rose-400" />,
      title: 'Data Privacy Risks',
      desc: 'Using public SaaS means handing over sensitive business data (PII, financials) to third-party clouds and public LLMs without sovereignty.',
      color: 'border-rose-900/30 bg-rose-950/10 hover:border-rose-900/50',
      iconBg: 'bg-rose-500/10 border-rose-500/20'
    }
  ];

  return (
    <section id={id} className="py-24 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>
      
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white md:text-5xl mb-6 font-display">
            The <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-500">Fracture</span> of Digital Business.
          </h2>
          <p className="text-lg text-[#F5F5F7]/70 leading-relaxed">
            Modern SMEs face a critical operational crisis. To run a business today, teams are forced to glue together a disjointed stack of SaaS tools, crushing efficiency and masking true insights.
          </p>
          <div className="mt-6 inline-flex items-center space-x-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-mono text-[#F5F5F7]/50">
            <span className="text-red-400">The Old Stack:</span>
            <span>ERP + Zendesk + Buffer + Zapier + Phone</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem, i) => (
            <div key={i} className={`group rounded-2xl border p-8 transition-all duration-300 glass-panel card-aurora ${problem.color}`}>
              <div className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl border ${problem.iconBg}`}>
                {problem.icon}
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">{problem.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{problem.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
