import React from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { SecurePortal } from './SecurePortal';
import { SystemsTabBar } from './SystemsTabBar';
import { SYSTEMS_BAR_HEIGHT, isSystemRoute } from '../config/systemsTabs';
import { CommandCenter } from '../page-components/CommandCenter';
import { KnowledgeHub } from '../page-components/KnowledgeHub';
import { ErpOrders } from '../page-components/ErpOrders';
import { ErpCustomers } from '../page-components/ErpCustomers';
import { ErpInventory } from '../page-components/ErpInventory';
import { ErpPos } from '../page-components/ErpPos';
import { GenerativeWorkspace } from '../page-components/GenerativeWorkspace';

export function WorkspaceManager() {
  const pathname = usePathname();
  const mountedWorkspaces = useWorkspaceStore((s) => s.mountedWorkspaces);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-gray-950">
      <SystemsTabBar />

      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ paddingTop: isSystemRoute(pathname) ? SYSTEMS_BAR_HEIGHT : 0 }}
      >
        {mountedWorkspaces.map((id) => {
          const workspace = workspaces[id];
          if (!workspace) return null;
          const isActive = activeWorkspace === id;
          const isSystem = ['erp-orders', 'erp-customers', 'erp-inventory', 'erp-pos', 'support', 'automations', 'marketing'].includes(id);
          
          const visibilityClasses = isActive
            ? `block opacity-100 relative w-full h-full pointer-events-auto ${isSystem ? '' : '-mt-[53px]'}`
            : 'hidden opacity-0 absolute inset-0 pointer-events-none';

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
              ) : id === 'erp-orders' ? (
                <ErpOrders />
              ) : id === 'erp-customers' ? (
                <ErpCustomers />
              ) : id === 'erp-inventory' ? (
                <ErpInventory />
              ) : id === 'erp-pos' ? (
                <ErpPos />
              ) : id === 'knowledge-hub' ? (
                <KnowledgeHub />
              ) : id === 'generative' ? (
                <GenerativeWorkspace />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
