import React from 'react';

export function SystemStatus() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center space-x-3 shadow-lg">
        <div className="h-2 w-2 rounded-full bg-[#00FF00] animate-pulse shadow-[0_0_8px_rgba(0,255,0,0.5)]"></div>
        <span className="text-xs font-mono text-[#F5F5F7] tracking-wider">System Online v1.0.4</span>
      </div>
    </div>
  );
}
