'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { SecurePortal } from './SecurePortal';
import { SystemsTabBar } from './SystemsTabBar';
import { ROUTE_TO_WORKSPACE_ID, SYSTEMS_BAR_HEIGHT, isSystemRoute } from '../config/systemsTabs';

export function PersistentIframes() {
  const pathname = usePathname();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const [mountedIframes, setMountedIframes] = useState([]);

  // Detect which external workspace should be active based on the URL
  const activeWorkspaceId = ROUTE_TO_WORKSPACE_ID[pathname];

  // Mount external workspaces once so their iframes persist across navigation
  // LRU cache implementation keeping maximum 2 iframes loaded to save memory
  useEffect(() => {
    if (activeWorkspaceId) {
      setMountedIframes((prev) => {
        if (prev.includes(activeWorkspaceId)) {
          // Move to the end as most recently used
          const filtered = prev.filter(id => id !== activeWorkspaceId);
          return [...filtered, activeWorkspaceId];
        }
        const updated = [...prev, activeWorkspaceId];
        // Keep only max 2 most recent iframes
        if (updated.length > 2) {
          return updated.slice(updated.length - 2);
        }
        return updated;
      });
    }
  }, [activeWorkspaceId]);

  const systemRoute = isSystemRoute(pathname);

  return (
    <>
      <SystemsTabBar />
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ paddingTop: systemRoute ? SYSTEMS_BAR_HEIGHT : 0 }}
      >
        {mountedIframes.map((id) => {
          const workspace = workspaces[id];
          if (!workspace || !workspace.isExternal) return null;

          const isActive = activeWorkspaceId === id;
          const visibilityClasses = isActive
            ? 'block opacity-100 relative w-full h-full pointer-events-auto'
            : 'hidden opacity-0 absolute inset-0 pointer-events-none';

          return (
            <div key={id} className={visibilityClasses}>
              <SecurePortal appId={id} targetUrl={workspace.targetUrl} ssoApp={workspace.ssoApp} />
            </div>
          );
        })}
      </div>
    </>
  );
}
