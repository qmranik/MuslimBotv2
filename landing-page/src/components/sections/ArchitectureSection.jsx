import React from 'react';
import { Smartphone, Shield, Zap, Database, ArrowDown } from 'lucide-react';

export default function ArchitectureSection({ id }) {
  return (
    <section id={id} className="py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <div className="mb-6 inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-[#F5F5F7]/50">
            Self-Hosted Stack
          </div>
          <h2 className="text-4xl font-extrabold text-white md:text-5xl tracking-tight mb-6 font-display">
            How it runs.
          </h2>
          <p className="mt-4 text-[#F5F5F7]/70 text-lg leading-relaxed">
            A containerized, open-source architecture that runs on your own hardware or cloud VPS. Deployed in minutes via a single Docker Compose file.
          </p>
        </div>

        <div className="max-w-4xl mx-auto flex flex-col items-center">
          
          {/* Layer 1: Clients */}
          <div className="w-full bg-[#1C1C1E]/50 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-lg flex justify-center space-x-8 items-center text-white font-medium">
            <div className="flex flex-col items-center"><Smartphone size={24} className="mb-2 text-cyan-400" /> Web / Mobile Clients</div>
            <div className="flex flex-col items-center"><Database size={24} className="mb-2 text-cyan-400" /> ERP Next / REST APIs</div>
          </div>

          <div className="h-10 w-px bg-white/20 relative flex items-center justify-center">
            <ArrowDown size={14} className="text-white/40 absolute bottom-0 translate-y-1/2" />
          </div>

          {/* Layer 2: Identity Edge */}
          <div className="w-full max-w-3xl bg-emerald-950/20 backdrop-blur-md border border-emerald-900/30 p-6 rounded-2xl shadow-lg flex flex-col items-center text-white relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-2xl"></div>
            <Shield size={28} className="mb-3 text-emerald-400" />
            <h3 className="font-bold text-lg">Identity & Routing Edge</h3>
            <p className="text-sm text-[#F5F5F7]/50 mt-1 font-mono">Traefik Reverse Proxy + Authentik SSO</p>
          </div>

          <div className="h-10 w-px bg-white/20 relative flex items-center justify-center">
            <ArrowDown size={14} className="text-white/40 absolute bottom-0 translate-y-1/2" />
          </div>

          {/* Layer 3: Orchestrator */}
          <div className="w-full max-w-2xl bg-blue-950/20 backdrop-blur-md border border-blue-900/30 p-8 rounded-3xl shadow-lg flex flex-col items-center text-white relative">
            <div className="absolute inset-0 bg-blue-500/5 blur-xl rounded-3xl"></div>
            <Zap size={32} className="mb-3 text-blue-400 relative z-10" />
            <h3 className="font-bold text-xl font-display relative z-10">Go-Orchestrator</h3>
            <p className="text-sm text-[#F5F5F7]/70 mt-2 text-center max-w-md relative z-10">
              The AI brain. Houses the 129+ tool catalog, manages context, and executes workflows via LLM APIs.
            </p>
          </div>

          <div className="h-12 w-px bg-white/20 relative flex items-center justify-center">
             <div className="absolute bottom-0 w-48 h-px bg-white/20 translate-y-1/2"></div>
             <ArrowDown size={14} className="text-white/40 absolute bottom-0 translate-y-1/2 -translate-x-24" />
             <ArrowDown size={14} className="text-white/40 absolute bottom-0 translate-y-1/2 translate-x-24" />
          </div>

          {/* Layer 4: Subsystems */}
          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 p-5 rounded-xl text-center hover:border-white/20 transition-colors">
              <h4 className="font-bold text-slate-200">Frappe</h4>
              <p className="text-xs text-[#F5F5F7]/40 mt-1 font-mono">Headless ERP</p>
            </div>
            <div className="bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 p-5 rounded-xl text-center hover:border-white/20 transition-colors">
              <h4 className="font-bold text-slate-200">Chatwoot</h4>
              <p className="text-xs text-[#F5F5F7]/40 mt-1 font-mono">Omnichannel</p>
            </div>
            <div className="bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 p-5 rounded-xl text-center hover:border-white/20 transition-colors">
              <h4 className="font-bold text-slate-200">TryPost</h4>
              <p className="text-xs text-[#F5F5F7]/40 mt-1 font-mono">Social Auto</p>
            </div>
            <div className="bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 p-5 rounded-xl text-center hover:border-white/20 transition-colors">
              <h4 className="font-bold text-slate-200">n8n</h4>
              <p className="text-xs text-[#F5F5F7]/40 mt-1 font-mono">Workflows</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
