'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Plus, 
  LayoutDashboard, 
  BookOpen, 
  Settings, 
  Zap,
  MessageSquare,
  BarChart2,
  HelpCircle,
  FileText
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const isRouteActive = (path: string) => pathname === path;

  return (
    <div className="w-64 h-full flex flex-col justify-between border-r border-slate-800/60 p-4 bg-[#0d1527]/40 backdrop-blur-md shrink-0">
      <div className="flex flex-col space-y-6">
        {/* Logo Brand Header */}
        <div>
          <h1 className="font-bold tracking-tight text-white text-lg leading-tight">liteERP</h1>
          <p className="text-xs tracking-wider uppercase font-medium text-indigo-400">UNIFIED GENUI</p>
        </div>

        {/* Action Interface Trigger Button */}
        <button className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        {/* Navigation Sections */}
        <div className="flex flex-col space-y-6">
          {/* Tier A: WORKSPACES */}
          <div className="flex flex-col space-y-2">
            <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase px-2">Workspaces</span>
            
            <Link 
              href="/command-center" 
              className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                isRouteActive('/command-center') 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm font-medium">Command Center</span>
            </Link>
            
            <Link 
              href="/knowledge-hub" 
              className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                isRouteActive('/knowledge-hub') 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Knowledge Hub</span>
            </Link>
          </div>

          {/* Tier B: CONNECTED SYSTEMS */}
          <div className="flex flex-col space-y-2">
            <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase px-2">Connected Systems</span>
            
            {[
              { label: 'liteERP /ops', path: '/lite-erp', icon: <Settings className="w-4 h-4" /> },
              { label: 'n8n Automations', path: '/n8n-workflows', icon: <Zap className="w-4 h-4" /> },
              { label: 'Support Chatwoot', path: '/chatwoot-hub', icon: <MessageSquare className="w-4 h-4" /> },
              { label: 'Postiz Marketing', path: '/postiz-social', icon: <BarChart2 className="w-4 h-4" /> },
            ].map((system) => (
              <Link 
                key={system.path}
                href={system.path} 
                className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  isRouteActive(system.path) 
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent'
                }`}
              >
                {system.icon}
                <span className="text-sm font-medium">{system.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        {/* DATA SNAPSHOT Micro-Card */}
        <div className="bg-[#121826]/80 border border-slate-700/50 rounded-lg p-4 flex flex-col space-y-3">
          <h4 className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Data Snapshot</h4>
          <div className="flex flex-col space-y-2 text-sm text-slate-300">
            <div className="flex justify-between items-center">
              <span>Invoices</span>
              <span className="font-mono text-slate-100">35</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Customers</span>
              <span className="font-mono text-slate-100">15</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Products</span>
              <span className="font-mono text-slate-100">10</span>
            </div>
          </div>
          <p className="italic text-[10px] opacity-40 text-slate-400 mt-2">Offline mock data</p>
        </div>

        {/* Sidebar Base Footer Links */}
        <div className="flex flex-col space-y-2 pt-2 border-t border-slate-800/60">
          <div className="flex items-center justify-between px-2 text-slate-400">
            <button className="flex items-center space-x-2 text-xs hover:text-white transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Help</span>
            </button>
            <button className="flex items-center space-x-2 text-xs hover:text-white transition-colors">
              <FileText className="w-3.5 h-3.5" />
              <span>Logs</span>
            </button>
          </div>
          
          <div className="w-full bg-slate-800/40 border border-slate-700/50 rounded-md p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors mt-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Zap className="w-3 h-3 text-indigo-400" />
              </div>
              <span className="text-xs font-medium text-slate-200">Activate Gemini</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
