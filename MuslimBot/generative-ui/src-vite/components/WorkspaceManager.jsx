import React from 'react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { SecurePortal } from './SecurePortal';
import { CommandCenter } from '../pages/CommandCenter';
import { KnowledgeHub } from '../pages/KnowledgeHub';

export function WorkspaceManager() {
  const mountedWorkspaces = useWorkspaceStore((s) => s.mountedWorkspaces);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-slate-50">
      {mountedWorkspaces.map((id) => {
        const workspace = workspaces[id];
        if (!workspace) return null;
        const isActive = activeWorkspace === id;
        const visibilityClasses = isActive
          ? 'block opacity-100 relative w-full h-full z-10 pointer-events-auto'
          : 'hidden opacity-0 absolute inset-0 z-0 pointer-events-none';

        return (
          <div key={id} className={visibilityClasses}>
            {workspace.isExternal ? (
              <SecurePortal
                appId={id}
                targetUrl={workspace.targetUrl}
                ssoApp={workspace.ssoApp}
              />
            ) : id === 'command-center' ? (
              <CommandCenter />
            ) : (
              <KnowledgeHub />
            )}
          </div>
        );
      })}
    </div>
  );
}
