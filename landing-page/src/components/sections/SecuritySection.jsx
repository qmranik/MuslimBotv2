import React from 'react';
import { Shield, KeyRound, Server } from 'lucide-react';

export default function SecuritySection({ id }) {
  return (
    <section id={id} className="relative overflow-hidden border-t border-white/5 bg-[#050505] py-24">
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        <div className="mb-16 text-center">
          <h3 className="text-xs font-bold tracking-widest text-emerald-500 uppercase mb-4 font-mono">Data Sovereignty by Design</h3>
          <h2 className="text-3xl font-bold text-white md:text-5xl font-display">
            Secure Architecture.
          </h2>
          <p className="mt-4 text-[#F5F5F7]/70 max-w-2xl mx-auto leading-relaxed">
            MuslimBot is the operating system for the next generation of business: unified, intelligent, and fiercely sovereign. You own your data.
          </p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 p-8 transition-transform hover:-translate-y-1 hover:bg-white/5 hover:border-white/20">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-black/50 border border-white/10 shadow-inner">
              <KeyRound size={24} className="text-slate-300" />
            </div>
            <h4 className="mb-3 text-lg font-bold text-white">Zero-Trust Identity</h4>
            <p className="text-sm text-[#F5F5F7]/70 leading-relaxed">
              Secured by Traefik and Authentik. Features enterprise-grade SSO. One login grants secure, role-based access to the Generative UI, while the Go-Orchestrator handles all backend credentials.
            </p>
          </div>

          <div className="rounded-2xl bg-[#1C1C1E]/30 backdrop-blur-md border-t-2 border-emerald-500 border-x border-b border-white/10 shadow-[0_-4px_30px_-10px_rgba(16,185,129,0.2)] p-8 transition-transform hover:-translate-y-1 hover:bg-white/5">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Shield size={24} className="text-emerald-400" />
            </div>
            <h4 className="mb-3 text-lg font-bold text-white">Safe AI Execution</h4>
            <p className="text-sm text-[#F5F5F7]/70 leading-relaxed">
              The system employs a strict "Confirm-before-write" policy for critical actions, ensuring the AI acts as a brilliant assistant, not an unsupervised rogue operator.
            </p>
          </div>

          <div className="rounded-2xl bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 p-8 transition-transform hover:-translate-y-1 hover:bg-white/5 hover:border-white/20">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-black/50 border border-white/10 shadow-inner">
              <Server size={24} className="text-slate-300" />
            </div>
            <h4 className="mb-3 text-lg font-bold text-white">End-to-End Control</h4>
            <p className="text-sm text-[#F5F5F7]/70 leading-relaxed">
              Because the entire stack (Traefik, Authentik, Go, Frappe, Chatwoot, n8n, TryPost) is open-source and deployed via Docker Compose on your own VPS/Cloud, you never leak PII to public models.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
