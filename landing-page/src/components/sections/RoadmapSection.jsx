import React from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

export default function RoadmapSection({ id }) {
  const shipped = [
    "Go-Orchestrator Backend",
    "Frappe ERPNext Headless Integration",
    "Generative UI Engine (React/Tailwind)",
    "Chatwoot MCP for Omnichannel",
    "TryPost Social MCP",
    "n8n Webhook Triggers",
    "Traefik + Authentik SSO Edge",
    "Docker Compose Deployment"
  ];

  const next = [
    "LiveKit + Gemini Multimodal Voice (<800ms)",
    "Local Nextcloud SOP Grounding",
    "Vertex RAG Knowledge Architecture",
    "Custom App Builder via GenUI",
    "Automated Database Backups UI",
    "Multi-tenant strict resource isolation"
  ];

  return (
    <section id={id} className="py-32 relative overflow-hidden bg-[#050505] border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white md:text-5xl tracking-tight mb-6 font-display">
            What's Live & What's Next.
          </h2>
          <p className="mt-4 text-[#F5F5F7]/70 text-lg leading-relaxed">
            We build in the open. Our roadmap is focused on deepening autonomous capabilities and strict data sovereignty.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          {/* Shipped Column */}
          <div className="bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-10">
            <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-white/10">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white font-display">Shipped</h3>
            </div>
            
            <ul className="space-y-4">
              {shipped.map((item, i) => (
                <li key={i} className="flex items-start space-x-3 text-[#F5F5F7]/80">
                  <CheckCircle2 size={18} className="text-emerald-500/70 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Next Column */}
          <div className="bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-10">
            <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-white/10">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <CircleDashed size={24} className="text-cyan-400 animate-[spin_10s_linear_infinite]" />
              </div>
              <h3 className="text-2xl font-bold text-white font-display">In Development</h3>
            </div>
            
            <ul className="space-y-4">
              {next.map((item, i) => (
                <li key={i} className="flex items-start space-x-3 text-[#F5F5F7]/60">
                  <div className="h-4 w-4 rounded-full border-2 border-cyan-500/40 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
