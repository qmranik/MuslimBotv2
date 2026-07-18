import React, { useState, useEffect } from 'react';
import { Sparkles, Package, User, BarChart2 } from 'lucide-react';

export default function GenerativeUISection({ id }) {
  const [step, setStep] = useState(0);

  // Animation cycle (0-3: Inventory, 4-7: Chart)
  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev >= 7 ? 0 : prev + 1));
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id={id} className="py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        
        <div className="mb-24 text-center max-w-3xl mx-auto">
          <div className="mb-6 inline-flex items-center space-x-2 rounded-full border border-[#1C1C1E] bg-[#1C1C1E]/50 px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-[#F5F5F7]/70">
            <Sparkles size={14} className="text-cyan-400" />
            <span>The Generative Interface</span>
          </div>
          <h2 className="text-4xl font-extrabold text-white md:text-6xl tracking-tight mb-6 font-display">
            Ask for a UI.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-emerald-400">Get a UI.</span>
          </h2>
          <p className="mt-6 text-[#F5F5F7]/70 text-lg leading-relaxed">
            Stop clicking through complex menus in Frappe, Chatwoot, or TryPost. The Go-Orchestrator routes your intent to the right tools, and dynamically generates the exact dashboard, table, or actionable card you need, directly inside the chat.
          </p>
        </div>

        {/* Mock Chat Interface */}
        <div className="max-w-4xl mx-auto bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl transition-all duration-500">
          
          <div className="space-y-8">
            
            {/* User Message */}
            <div className={`flex items-start space-x-4 transition-all duration-700 ease-out opacity-100 translate-y-0`}>
              <div className="h-10 w-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="bg-[#2C2C2E] rounded-2xl rounded-tl-none p-4 inline-block shadow-md">
                  <p className="text-[#F5F5F7] font-medium transition-opacity duration-300">
                    {step < 4 ? "Show me the Frappe inventory for the new Summer Collection." : "Show yesterday's sales vs last week."}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Loading State */}
            <div className={`flex items-start space-x-4 transition-all duration-500 ease-out ${(step === 1 || step === 5) ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex-shrink-0"></div>
              <div className="flex-1 flex items-center h-10 space-x-2">
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></div>
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse delay-75"></div>
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse delay-150"></div>
                <span className="text-xs font-mono text-cyan-400/50 ml-2">
                  {step < 4 ? "Querying ERPNext Headless API..." : "Analyzing sales data via Go-Orchestrator..."}
                </span>
              </div>
            </div>

            {/* AI Response (Generative UI Component) */}
            <div className={`flex items-start space-x-4 transition-all duration-700 ease-out ${(step >= 2 && step <= 3) || step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden'}`}>
              <div className={`h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex-shrink-0 opacity-100`}></div>
              
              <div className="flex-1 w-full overflow-hidden">
                
                {/* Condition 1: Inventory Table */}
                {step < 4 && (
                  <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 shadow-xl w-full max-w-2xl animate-fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                          <Package size={18} className="text-slate-300" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold">Frappe ERP Inventory</h4>
                          <p className="text-xs text-[#F5F5F7]/50">Filtered: Summer Collection</p>
                        </div>
                      </div>
                      <button className="px-3 py-1.5 text-xs font-mono bg-white/5 border border-white/10 rounded-md text-[#F5F5F7] hover:bg-white/10 transition-colors">
                        Export CSV
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-colors">
                        <span className="text-[#F5F5F7] font-medium">Linen Blend Shirt</span>
                        <span className="text-emerald-400 font-mono font-bold">450 Units</span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-colors">
                        <span className="text-[#F5F5F7] font-medium">Pleated Shorts</span>
                        <span className="text-amber-400 font-mono font-bold">12 Units (Low)</span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-colors">
                        <span className="text-[#F5F5F7] font-medium">Canvas Tote Bag</span>
                        <span className="text-emerald-400 font-mono font-bold">890 Units</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Condition 2: Sales Chart Card */}
                {step >= 4 && (
                  <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 shadow-xl w-full max-w-md animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-500/20">
                          <BarChart2 size={18} className="text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold">Sales Volume</h4>
                          <p className="text-xs text-[#F5F5F7]/50">Yesterday vs Last Week</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-end space-x-4 h-32 mb-4 border-b border-white/10 pb-4">
                      {/* Bar 1: Last Week */}
                      <div className="flex-1 flex flex-col items-center justify-end h-full">
                        <div className="w-full bg-white/10 rounded-t-sm h-[60%] transition-all"></div>
                        <span className="text-xs text-white/50 mt-2 font-mono">$4.2k</span>
                      </div>
                      {/* Bar 2: Yesterday */}
                      <div className="flex-1 flex flex-col items-center justify-end h-full">
                        <div className="w-full bg-gradient-to-t from-emerald-500/50 to-emerald-400 rounded-t-sm h-[90%] transition-all"></div>
                        <span className="text-xs text-emerald-400 mt-2 font-mono font-bold">$7.8k</span>
                      </div>
                    </div>
                    
                    <div className="text-sm font-medium text-emerald-400 flex items-center">
                      <span className="mr-2">↑ +85% Increase</span>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
