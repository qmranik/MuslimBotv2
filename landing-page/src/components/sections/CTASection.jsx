import React from 'react';
import { ArrowRight, GitBranch } from 'lucide-react';

export default function CTASection({ id }) {
  return (
    <section id={id} className="pt-32 pb-12 relative overflow-hidden bg-[#050505]">
      
      {/* CTA Block */}
      <div className="mx-auto max-w-5xl px-6 relative z-10 mb-32">
        <div className="relative bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-12 md:p-20 text-center overflow-hidden shadow-2xl">
          
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>

          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 relative z-10 font-display">
            Ready to step into the <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Agentic Era?</span>
          </h2>
          <p className="text-[#F5F5F7]/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 relative z-10">
            Join the forward-thinking businesses that replaced manual admin work with intelligent, autonomous execution.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button className="flex items-center space-x-2 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-slate-200 transition-colors w-full sm:w-auto justify-center">
              <span>Schedule Your Live Demo</span>
              <ArrowRight size={18} />
            </button>
            <a href="https://github.com/qmranik/MuslimBot" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 bg-white/5 border border-white/10 text-white px-8 py-4 rounded-full font-bold hover:bg-white/10 transition-colors w-full sm:w-auto justify-center">
              <GitBranch size={18} className="text-[#F5F5F7]/70" />
              <span>View Source Code</span>
            </a>
          </div>
        </div>
      </div>

      {/* Real Footer */}
      <footer className="mx-auto max-w-7xl px-6 border-t border-white/5 pt-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-[#F5F5F7]/50">
          <div className="mb-4 md:mb-0">
            <span className="font-bold text-white mr-2">MuslimBot OS</span>
            <span>© {new Date().getFullYear()} liteERP. Sovereign by Design.</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#" className="hover:text-emerald-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Data Sovereignty</a>
            <a href="https://github.com/qmranik/MuslimBot" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <GitBranch size={18} />
            </a>
          </div>
        </div>
      </footer>
    </section>
  );
}
