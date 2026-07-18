import React from 'react';
import { Check } from 'lucide-react';

export default function PricingSection({ id }) {
  return (
    <section id={id} className="py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 relative z-10">
        
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white md:text-5xl tracking-tight mb-6 font-display">
            A Whole Team for the <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">Price of Software</span>.
          </h2>
          <p className="mt-4 text-[#F5F5F7]/70 text-lg leading-relaxed">
            Simple, transparent pricing. No per-seat fees. You bring the compute, we bring the brain.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
          
          {/* Starter */}
          <div className="bg-[#1C1C1E]/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl transition-transform hover:-translate-y-1">
            <h3 className="text-2xl font-bold text-white mb-2 font-display">Starter</h3>
            <div className="flex items-baseline mb-2">
              <span className="text-4xl font-bold text-white font-display">$49</span>
              <span className="text-[#F5F5F7]/50 ml-2">/mo</span>
            </div>
            <p className="text-sm text-cyan-400 font-mono mb-8">The Digital Clerk.</p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Powered by headless ERPNext APIs</span>
              </li>
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Traefik + Authentik identity edge</span>
              </li>
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Omnichannel Text Inbox (Chatwoot)</span>
              </li>
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Base 5 AI Agents</span>
              </li>
            </ul>
            
            <button className="w-full py-3 rounded-full bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors">
              Get Started
            </button>
          </div>

          {/* Growth */}
          <div className="relative rounded-3xl p-[1px] overflow-hidden transform lg:scale-105 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-400 via-emerald-500 to-transparent opacity-50"></div>
            
            <div className="relative bg-[#0A0A0A] p-8 rounded-3xl h-full border border-white/10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-3 py-1 rounded-b-lg text-xs font-bold tracking-widest uppercase">
                Most Popular
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2 mt-4 font-display">Growth</h3>
              <div className="flex items-baseline mb-2">
                <span className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-display">$149</span>
                <span className="text-[#F5F5F7]/50 ml-2">/mo</span>
              </div>
              <p className="text-sm text-emerald-400 font-mono mb-8">The Digital Manager.</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start text-sm text-white font-medium">
                  <Check size={18} className="text-emerald-400 mr-3 flex-shrink-0" />
                  <span>Everything in Starter</span>
                </li>
                <li className="flex items-start text-sm text-white font-medium">
                  <Check size={18} className="text-emerald-400 mr-3 flex-shrink-0" />
                  <span>LiveKit + Gemini Voice Agent</span>
                </li>
                <li className="flex items-start text-sm text-[#F5F5F7]/90">
                  <Check size={18} className="text-emerald-400 mr-3 flex-shrink-0" />
                  <span>Full 129-tool catalog execution</span>
                </li>
                <li className="flex items-start text-sm text-[#F5F5F7]/90">
                  <Check size={18} className="text-emerald-400 mr-3 flex-shrink-0" />
                  <span>TryPost Social Automation</span>
                </li>
              </ul>
              
              <button className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold hover:opacity-90 transition-opacity">
                Start Free Trial
              </button>
            </div>
          </div>

          {/* Enterprise */}
          <div className="bg-[#1C1C1E]/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl transition-transform hover:-translate-y-1">
            <h3 className="text-2xl font-bold text-white mb-2 font-display">Enterprise</h3>
            <div className="flex items-baseline mb-2">
              <span className="text-4xl font-bold text-white font-display">$399</span>
              <span className="text-[#F5F5F7]/50 ml-2">/mo</span>
            </div>
            <p className="text-sm text-blue-400 font-mono mb-8">The Digital Executive.</p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Everything in Growth</span>
              </li>
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Strict per-tenant isolation</span>
              </li>
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Nextcloud SOP grounding (RAG)</span>
              </li>
              <li className="flex items-start text-sm text-[#F5F5F7]/80">
                <Check size={18} className="text-emerald-500 mr-3 flex-shrink-0" />
                <span>Custom n8n MCP integrations</span>
              </li>
            </ul>
            
            <button className="w-full py-3 rounded-full bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors">
              Talk to Sales
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
