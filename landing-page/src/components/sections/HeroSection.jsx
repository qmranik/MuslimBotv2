import React, { useState, useEffect } from 'react';
import { Terminal, ArrowRight, Play } from 'lucide-react';
import { UnifiedCommandCenterPreview } from '../UnifiedCommandCenterPreview';

export default function HeroSection({ id }) {
  const [placeholderText, setPlaceholderText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const phrases = [
    "Summarize today's Chatwoot tickets...",
    "Fetch the latest inventory from ERP...",
    "Pause social campaigns for customer +8801...",
    "Draft a post for the new summer collection..."
  ];

  useEffect(() => {
    let timer;
    const currentPhrase = phrases[phraseIndex];

    if (isDeleting) {
      timer = setTimeout(() => {
        setPlaceholderText(currentPhrase.substring(0, placeholderText.length - 1));
        if (placeholderText.length <= 1) {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      }, 50);
    } else {
      timer = setTimeout(() => {
        setPlaceholderText(currentPhrase.substring(0, placeholderText.length + 1));
        if (placeholderText.length === currentPhrase.length) {
          timer = setTimeout(() => setIsDeleting(true), 2000);
        }
      }, 80);
    }

    return () => clearTimeout(timer);
  }, [placeholderText, isDeleting, phraseIndex]);

  return (
    <section id={id} className="relative overflow-hidden pt-40 pb-24 text-center min-h-screen flex flex-col justify-center border-b border-white/10">
      
      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-white md:text-7xl leading-tight font-display">
          Manage outcomes, <br className="hidden md:block" />
          <span className="bg-white text-black px-4 leading-[1.2] inline-block mt-2">
            not software.
          </span>
        </h1>
        
        <p className="mt-6 mb-10 text-lg md:text-xl text-[#F5F5F7]/70 max-w-3xl mx-auto">
          The open-source, AI-first sovereign command center uniting ERP, support, and marketing for growing SMEs.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button className="flex items-center space-x-2 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-slate-200 transition-colors">
            <span>Book a live demo</span>
            <ArrowRight size={18} />
          </button>
          <a href="#solution" className="flex items-center space-x-2 bg-white/5 border border-white/10 text-white px-8 py-4 rounded-full font-bold hover:bg-white/10 transition-colors">
            <Play size={18} className="text-cyan-400" />
            <span>See how it works</span>
          </a>
        </div>
        
        {/* The Omni-Input */}
        <div className="mx-auto max-w-2xl relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-white/10 to-white/0 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex items-center bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl transition-all duration-300 focus-within:border-[#00FF00]/50 focus-within:shadow-[0_0_30px_rgba(0,255,0,0.15)] focus-within:bg-white/[0.04]">
            <Terminal size={24} className="text-white/50 mr-4 group-focus-within:text-[#00FF00] transition-colors" />
            <input 
              type="text" 
              readOnly
              placeholder={placeholderText} 
              className="bg-transparent border-none outline-none w-full text-lg text-white font-mono placeholder:text-white/40 focus:ring-0"
            />
            <div className="ml-4 flex h-6 w-12 items-center justify-center rounded border border-white/20 bg-white/10 text-xs font-mono text-white/50 group-focus-within:border-[#00FF00]/30 group-focus-within:text-[#00FF00] transition-colors">
              ↵
            </div>
          </div>
        </div>
      </div>

      {/* Admin OS Dashboard Mockup */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 mt-20">
        <UnifiedCommandCenterPreview />
        <p className="mt-6 text-sm font-mono text-[#F5F5F7]/40 uppercase tracking-widest">
          Three panes of unified orchestration: Ingest → Orchestrate → Act
        </p>
      </div>
    </section>
  );
}
