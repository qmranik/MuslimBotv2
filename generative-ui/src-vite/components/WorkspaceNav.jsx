import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Package,
  Workflow,
  Headphones,
  Share2,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

const NATIVE_VIEWS = [
  { id: 'command-center', label: 'Command Center', icon: LayoutDashboard },
  { id: 'knowledge-hub', label: 'Knowledge Hub', icon: BookOpen },
];

const EXTERNAL_VIEWS = [
  { id: 'erp-ops', label: 'liteERP /ops', icon: Package },
  { id: 'automations', label: 'n8n Automations', icon: Workflow },
  { id: 'support', label: 'Support Chatwoot', icon: Headphones },
  { id: 'marketing', label: 'Postiz Marketing', icon: Share2 },
];

function NavButton({ view, active, onClick, compact }) {
  const Icon = view.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(view.id)}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
        active
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
      }`}
    >
      <Icon className={compact ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      {!compact && <span className="truncate">{view.label}</span>}
    </button>
  );
}

export function WorkspaceNav({ layout = 'sidebar', compact = false }) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  if (layout === 'bottom') {
    const all = [...NATIVE_VIEWS, ...EXTERNAL_VIEWS];
    return (
      <nav className="flex items-center justify-around gap-1 w-full" aria-label="Workspace navigation">
        {all.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveWorkspace(view.id)}
            className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-lg text-[9px] font-semibold ${
              activeWorkspace === view.id ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            <view.icon className="w-4 h-4" />
            <span>{view.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-4" aria-label="Workspace navigation">
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1">Workspaces</p>
        <div className="flex flex-col gap-1">
          {NATIVE_VIEWS.map((view) => (
            <NavButton
              key={view.id}
              view={view}
              active={activeWorkspace === view.id}
              onClick={setActiveWorkspace}
              compact={compact}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1">Connected Systems</p>
        <div className="flex flex-col gap-1">
          {EXTERNAL_VIEWS.map((view) => (
            <NavButton
              key={view.id}
              view={view}
              active={activeWorkspace === view.id}
              onClick={setActiveWorkspace}
              compact={compact}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
