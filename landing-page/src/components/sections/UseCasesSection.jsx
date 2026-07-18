import React from 'react';
import { MessageSquare, Zap, Database, UserCheck, PauseCircle, PackageCheck, Box, MessageCircle, Mic, CalendarCheck, FileText, ArrowRight } from 'lucide-react';

export default function UseCasesSection({ id }) {
  const cases = [
    {
      title: 'Workflow A: The "Unhappy VIP" Save',
      description: 'Instant sentiment triage and high-value customer routing.',
      beforeAfter: {
        before: "An angry high-value customer sends a WhatsApp message. It sits in a generic queue for 12 hours. The customer churns.",
        after: "Go-Orchestrator reads the WhatsApp, fetches the $10k+ LTV from ERPNext, immediately routes to a Tier-3 human agent, and pauses their retargeting ads in TryPost to avoid tone-deaf marketing."
      },
      nodes: [
        { icon: <MessageSquare size={20} className="neon-icon text-blue-400" />, label: 'WhatsApp', sub: 'Ingest Message' },
        { icon: <Zap size={20} className="text-[#00FF00]" />, label: 'Go-Orchestrator', sub: 'Analyze Sentiment' },
        { icon: <Database size={20} className="neon-icon text-slate-300" />, label: 'ERPNext', sub: 'Fetch LTV: $10k+' },
        { icon: <UserCheck size={20} className="neon-icon text-amber-400" />, label: 'Tier 3 Support', sub: 'Assign Agent' },
        { icon: <PauseCircle size={20} className="neon-icon text-rose-400" />, label: 'TryPost', sub: 'Pause Ads' },
      ]
    },
    {
      title: 'Workflow B: End-to-End Content Engine',
      description: 'From warehouse receipt to live multi-channel campaign.',
      beforeAfter: {
        before: "Warehouse receives new stock. 3 days later, someone emails marketing. Marketing spends 2 hours writing posts.",
        after: "ERPNext logs the receipt. n8n triggers the orchestrator. Gemini AI automatically drafts 3 social posts. A manager taps 'Approve' in TryPost, and the campaign is live."
      },
      nodes: [
        { icon: <PackageCheck size={20} className="neon-icon text-emerald-400" />, label: 'ERPNext', sub: 'Receipt Completed' },
        { icon: <Zap size={20} className="text-[#00FF00]" />, label: 'n8n Event', sub: 'Broadcast Trigger' },
        { icon: <Box size={20} className="neon-icon text-cyan-400" />, label: 'Gemini AI', sub: 'Draft Campaign' },
        { icon: <MessageCircle size={20} className="neon-icon text-white" />, label: 'TryPost MCP', sub: 'Manager Approval' },
      ]
    },
    {
      title: 'Workflow C: Voice-Agent Lead Capture',
      description: 'Zero-latency (<800ms) phone booking integrated directly into the ERP.',
      beforeAfter: {
        before: "A customer calls to reorder. They wait on hold for 10 minutes, get frustrated, and hang up.",
        after: "LiveKit answers in <800ms. The Gemini Voice Agent speaks naturally, checks ERPNext for past orders, confirms the reorder, and sends a WhatsApp receipt via Chatwoot."
      },
      nodes: [
        { icon: <Mic size={20} className="neon-icon text-purple-400" />, label: 'LiveKit', sub: 'Answer SIP Call' },
        { icon: <Database size={20} className="neon-icon text-slate-300" />, label: 'ERP API', sub: 'Check History' },
        { icon: <CalendarCheck size={20} className="neon-icon text-emerald-400" />, label: 'Chatwoot MCP', sub: 'WhatsApp Confirm' },
        { icon: <FileText size={20} className="neon-icon text-amber-400" />, label: 'CRM', sub: 'Create Order' },
      ]
    }
  ];

  return (
    <section id={id} className="py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        
        <div className="mb-24 text-center">
          <div className="mb-6 inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-[#F5F5F7]/50">
            Node-Based Orchestration
          </div>
          <h2 className="text-4xl font-extrabold text-white md:text-6xl tracking-tight mb-6 font-display">
            Watch the <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-500">data flow.</span>
          </h2>
          <p className="mt-6 text-[#F5F5F7]/70 max-w-2xl mx-auto text-lg leading-relaxed">
            Complex, multi-system workflows executed entirely by autonomous agents. No glue code required.
          </p>
        </div>

        <div className="space-y-24">
          {cases.map((useCase, index) => (
            <div key={index} className="relative">
              
              <div className="mb-12">
                <h3 className="text-3xl font-bold text-white mb-3 font-display">{useCase.title}</h3>
                <p className="text-[#F5F5F7]/70 text-lg mb-8">{useCase.description}</p>
                
                {/* Before / After Narrative Card */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50"></div>
                    <h4 className="text-red-400 font-mono text-sm uppercase tracking-wider mb-2">Before</h4>
                    <p className="text-[#F5F5F7]/60 leading-relaxed text-sm">{useCase.beforeAfter.before}</p>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-900/30 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                    <h4 className="text-emerald-400 font-mono text-sm uppercase tracking-wider mb-2">With MuslimBot</h4>
                    <p className="text-[#F5F5F7]/90 leading-relaxed text-sm">{useCase.beforeAfter.after}</p>
                  </div>
                </div>
              </div>
              
              {/* Node Graph Container */}
              <div className="bg-[#1C1C1E]/30 backdrop-blur-md border border-white/10 p-8 md:p-12 rounded-3xl relative">
                
                {/* Connecting Line Background (Desktop) */}
                <div className="hidden md:block absolute top-1/2 left-24 right-24 h-[2px] -translate-y-1/2 z-0">
                  <svg width="100%" height="2" xmlns="http://www.w3.org/2000/svg">
                    <line x1="0" y1="1" x2="100%" y2="1" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                    <line x1="0" y1="1" x2="100%" y2="1" stroke="rgba(0,255,0,0.6)" strokeWidth="2" strokeDasharray="8 32" className="animate-flow" filter="drop-shadow(0 0 4px rgba(0,255,0,0.8))" />
                  </svg>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                  {useCase.nodes.map((node, i) => (
                    <React.Fragment key={i}>
                      {/* Node Card */}
                      <div className="group relative flex flex-col items-center w-full md:w-auto">
                        <div className="absolute -inset-4 rounded-xl bg-white/5 blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
                        <div className="relative bg-[#1C1C1E] border border-white/10 p-5 rounded-2xl shadow-xl hover:border-white/30 transition-colors w-40 text-center flex flex-col items-center">
                          <div className="mb-3 p-3 bg-white/5 rounded-xl border border-white/10">
                            {node.icon}
                          </div>
                          <div className="text-sm font-bold text-[#F5F5F7] mb-1">{node.label}</div>
                          <div className="text-[10px] font-mono text-[#F5F5F7]/40 uppercase tracking-wide leading-tight">{node.sub}</div>
                        </div>
                      </div>

                      {/* Arrow Down (Mobile) */}
                      {i < useCase.nodes.length - 1 && (
                        <div className="md:hidden h-8 w-px bg-white/20 relative">
                           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 border-r border-b border-white/40"></div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
