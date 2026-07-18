import React from 'react';
import { Box, MessagesSquare, Share2, Workflow, Database, Mic, ShieldAlert } from 'lucide-react';

export default function EcosystemSection({ id }) {
  const subsystems = [
    {
      title: 'Command Center',
      subtitle: 'Generative UI & Go-Orchestrator',
      icon: <Box size={24} className="neon-icon text-cyan-400" />,
      desc: 'The central nervous system. A stunning Next.js workspace that dynamically renders what you ask for, powered by a hyper-fast Go BFF housing a 129+ tool AI executor.',
      span: 'md:col-span-2'
    },
    {
      title: 'System of Record',
      subtitle: 'Small ERP / Frappe',
      icon: <Database size={24} className="neon-icon text-slate-400" />,
      desc: 'The headless, rock-solid database holding your business truth. Inventory, orders, HR, and accounting, accessed instantly by the AI.',
      span: 'md:col-span-1'
    },
    {
      title: 'Omnichannel Support',
      subtitle: 'Chatwoot MCP',
      icon: <MessagesSquare size={24} className="neon-icon text-blue-400" />,
      desc: 'Unified inbox for WhatsApp, Email, Webchat. The AI can auto-read messages, query ERP status, and instantly reply.',
      span: 'md:col-span-1'
    },
    {
      title: 'AI-Driven Marketing',
      subtitle: 'TryPost Social MCP',
      icon: <Share2 size={24} className="neon-icon text-pink-400" />,
      desc: 'Tell MuslimBot to generate a campaign. It queries the ERP, drafts 5 posts, and queues them for LinkedIn, X, and Instagram.',
      span: 'md:col-span-1'
    },
    {
      title: 'Autonomous Workflows',
      subtitle: 'n8n',
      icon: <Workflow size={24} className="neon-icon text-amber-400" />,
      desc: 'The invisible glue. Triggers cross-system reactions—like pausing marketing if a VIP submits an angry support ticket.',
      span: 'md:col-span-1'
    },
    {
      title: 'Voice AI Agent',
      subtitle: 'LiveKit + Gemini Multimodal',
      icon: <Mic size={24} className="neon-icon text-purple-400" />,
      desc: 'Sub-800ms latency voice assistant. Takes calls, answers questions, and directly invokes ERP tool calls (like booking an appointment) over the phone.',
      span: 'md:col-span-2'
    },
    {
      title: 'Identity Edge',
      subtitle: 'Traefik + Authentik',
      icon: <ShieldAlert size={24} className="neon-icon text-emerald-400" />,
      desc: 'Enterprise-grade SSO and routing. Ensures every microservice is secured behind a zero-trust architecture before the AI can touch it.',
      span: 'md:col-span-1'
    }
  ];

  return (
    <section id={id} className="py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white md:text-5xl mb-6 font-display">
            The Unified <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">Ecosystem</span>.
          </h2>
          <p className="mt-4 text-[#F5F5F7]/70 max-w-2xl mx-auto text-lg leading-relaxed">
            Every subsystem—from Frappe to TryPost—is accessed centrally through the Generative UI, eliminating context switching completely. Exposed via the Model Context Protocol (MCP).
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {subsystems.map((sys, i) => (
            <div key={i} className={`group rounded-2xl border border-white/10 bg-[#1C1C1E]/50 p-8 backdrop-blur-sm transition-all hover:bg-white/5 hover:border-white/20 ${sys.span}`}>
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-black/50 border border-white/10 shadow-inner">
                {sys.icon}
              </div>
              <h3 className="text-xl font-bold text-[#F5F5F7] mb-1">{sys.title}</h3>
              <p className="text-xs font-mono text-cyan-500 mb-4">{sys.subtitle}</p>
              <p className="text-sm text-[#F5F5F7]/70 leading-relaxed">{sys.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
