import React from 'react';
import { Sparkles, Plus, HelpCircle, ScrollText, Server } from 'lucide-react';
import { WorkspaceNav } from '../components/WorkspaceNav';

export function AppSidebar({
  onNewChat,
  erpConnected,
  apiStatus,
  invoiceCount,
  customerCount,
  itemCount,
  authMe,
  onSelectWorkspace,
}) {
  return (
    <>
      <div className="flex flex-col gap-5 p-4 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 px-1">
          <div className="w-10 h-10 rounded-2xl accent-gradient flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900 leading-tight">MuslimBot</h1>
            <span className="text-[10px] text-indigo-600 uppercase tracking-widest font-bold">Unified GenUI</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 accent-gradient text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 hover:opacity-95 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <WorkspaceNav layout="sidebar" onSelect={onSelectWorkspace} />

        <div className="panel-card p-3 space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Data Snapshot</p>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Invoices</span>
            <span className="font-semibold text-slate-700">{invoiceCount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Customers</span>
            <span className="font-semibold text-slate-700">{customerCount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Products</span>
            <span className="font-semibold text-slate-700">{itemCount}</span>
          </div>
          <p className="text-[10px] text-slate-400 pt-1">{erpConnected ? 'ERP connected' : 'Offline mock data'}</p>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200/80 space-y-2">
        <div className="flex gap-1">
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help
          </button>
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ScrollText className="w-3.5 h-3.5" />
            Logs
          </button>
        </div>

        <div className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-indigo-700 font-semibold truncate">
                {apiStatus === 'server' ? 'Server brain' : 'AI mode'}
              </p>
              <p className="text-[10px] text-indigo-500 truncate">
                {authMe?.email || authMe?.tenant_id || 'Authentik session'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
