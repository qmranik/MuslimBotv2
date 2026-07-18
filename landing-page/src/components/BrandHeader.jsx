import React from 'react';

export function BrandHeader() {
  return (
    <div className="fixed top-6 left-6 z-50 flex items-center space-x-3 bg-[#1C1C1E]/80 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 shadow-lg">
      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
      <span className="font-bold tracking-tight text-white text-lg">
        MuslimBot <span className="font-mono text-[10px] text-cyan-400 align-top uppercase ml-1 tracking-widest">OS</span>
      </span>
    </div>
  );
}
