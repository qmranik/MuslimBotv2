import React from 'react';
import { Activity, MessageSquare, Database, Sparkles, Workflow } from 'lucide-react';

export function UnifiedCommandCenterPreview() {
  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black shadow-2xl overflow-hidden glass-panel">
      {/* OS Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex space-x-2">
          <div className="h-3 w-3 rounded-full bg-white/20"></div>
          <div className="h-3 w-3 rounded-full bg-white/20"></div>
          <div className="h-3 w-3 rounded-full bg-white/20"></div>
        </div>
        
        {/* Floating Pill Tabs */}
        <div className="flex space-x-1 bg-black rounded-full border border-white/10 p-1">
          <button className="px-4 py-1.5 rounded-full text-xs font-bold text-black bg-white transition-colors">
            Omnichannel
          </button>
          <button className="px-4 py-1.5 rounded-full text-xs font-medium text-white/50 hover:text-white transition-colors">
            ERP Hub
          </button>
          <button className="px-4 py-1.5 rounded-full text-xs font-medium text-white/50 hover:text-white transition-colors">
            Workflows
          </button>
        </div>
        
        <div className="flex items-center space-x-2 text-xs font-mono text-white/40">
          <Activity size={14} className="text-[#00FF00]" />
          <span>99.9% Uptime</span>
        </div>
      </div>

      {/* 3-Pane Orchestration View */}
      <div className="grid grid-cols-1 md:grid-cols-3 h-[400px]">
        
        {/* Pane 1: Ingestion */}
        <div className="border-r border-white/5 p-6 flex flex-col justify-center relative">
          <div className="absolute top-4 left-4 text-[10px] font-mono tracking-widest text-white/30 uppercase">Ingestion Stream</div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg transform -rotate-1 hover:rotate-0 transition-transform">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-[#25D366]/20 rounded-lg text-[#25D366]">
                <MessageSquare size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">WhatsApp</div>
                <div className="text-[10px] text-white/50">+880 171 234 ****</div>
              </div>
            </div>
            <p className="text-sm text-slate-300 font-medium">
              "My last order arrived damaged. What can you do?"
            </p>
          </div>
        </div>

        {/* Pane 2: AI Processing */}
        <div className="border-r border-white/5 p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-4 left-4 text-[10px] font-mono tracking-widest text-white/30 uppercase">Orchestrator</div>
          
          {/* Glowing Badge */}
          <div className="relative group flex justify-center items-center">
            <div className="absolute w-32 h-32 bg-[#00FF00]/20 rounded-full blur-2xl animate-pulse-slow"></div>
            <div className="relative h-20 w-20 bg-black border border-[#00FF00]/50 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,255,0,0.2)]">
              <Sparkles className="text-[#00FF00]" size={32} />
            </div>
          </div>
          
          <div className="mt-8 space-y-2 w-full max-w-[200px]">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/50">Sentiment</span>
              <span className="text-rose-400">Negative</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400 w-3/4"></div>
            </div>
            
            <div className="flex items-center justify-between text-xs font-mono pt-2">
              <span className="text-white/50">Action</span>
              <span className="text-[#00FF00]">Escalate</span>
            </div>
          </div>
        </div>

        {/* Pane 3: System of Record */}
        <div className="p-6 flex flex-col justify-center relative">
          <div className="absolute top-4 left-4 text-[10px] font-mono tracking-widest text-white/30 uppercase">ERP Mutation</div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg transform translate-x-2">
            <div className="flex items-center space-x-3 mb-4 border-b border-white/10 pb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Database size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">ERPNext API</div>
                <div className="text-[10px] text-[#00FF00] font-mono">200 OK</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/40 font-mono">Order ID</span>
                <span className="text-white font-mono">#SO-00435</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/40 font-mono">LTV</span>
                <span className="text-amber-400 font-bold">$12,450.00</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/40 font-mono">Status</span>
                <span className="text-white px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[10px] uppercase font-bold">Replacement Auth</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
