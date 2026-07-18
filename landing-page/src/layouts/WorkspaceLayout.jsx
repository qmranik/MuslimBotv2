import React from 'react';
import { Home, Briefcase, FileText, Settings, Sparkles } from 'lucide-react';

export default function WorkspaceLayout({ children }) {
  return (
    // The Light Theme Background (Warm Cream/Off-White)
    <div className="min-h-screen bg-[#f8f6f0] text-slate-900 font-sans flex">
      
      {/* Spatial Floating Navigation Pill */}
      <aside className="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col items-center justify-between rounded-full bg-white/70 py-6 px-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl border border-white/40 h-[600px] w-[72px] z-50">
        
        {/* User Avatar */}
        <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform">
          {/* Using a div as a placeholder for the image to avoid external dependencies in mockup */}
          <div className="h-full w-full bg-gradient-to-tr from-emerald-400 to-cyan-500" />
        </div>

        {/* Primary Navigation Icons */}
        <nav className="flex flex-col space-y-8">
          <button className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#1e4b3f] text-white shadow-md transition-transform hover:scale-105">
            <Home size={20} />
            <span className="absolute left-16 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100">Dashboard</span>
          </button>
          
          <button className="group relative flex h-12 w-12 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <Briefcase size={20} />
            <span className="absolute left-16 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100">ERP Sync</span>
          </button>
          
          <button className="group relative flex h-12 w-12 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <FileText size={20} />
            <span className="absolute left-16 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100">Knowledge Base</span>
          </button>
          
          <button className="group relative flex h-12 w-12 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <Sparkles size={20} />
            <span className="absolute left-16 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100">AI Assist</span>
          </button>
        </nav>

        {/* Bottom Action (Settings) */}
        <button className="group relative flex h-12 w-12 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
          <Settings size={20} />
          <span className="absolute left-16 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100">Settings</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="ml-[120px] flex-1 p-10 max-w-7xl">
        {/* Dynamic header could go here, reading Headers from Traefik for user greeting */}
        {children}
      </main>
      
    </div>
  );
}
