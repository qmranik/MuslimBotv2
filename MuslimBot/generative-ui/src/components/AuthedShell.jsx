'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '../layout/AppShell';
import { NavigationPill } from './NavigationPill';
import { GlobalChatPanel } from '../layout/GlobalChatPanel';
import { MuslimbotFab } from '../layout/MuslimbotFab';
import { PersistentIframes } from './PersistentIframes';
import { VoiceCallButton } from './VoiceCallButton';
import { UserMenu } from './auth/UserMenu';
import { useWorkspaceStore, selectChatMode } from '../stores/useWorkspaceStore';
import { useGenerativeChat } from '../hooks/useGenerativeChat';
import { checkERPConnection, fetchERPContext } from '../services/erpClient';
import { invalidateERPCache } from '../services/gemini';
import { isSystemRoute, SYSTEMS_BAR_HEIGHT } from '../config/systemsTabs';

const ROUTE_TO_WORKSPACE_ID = {
  '/': 'command-center',
  '/command-center': 'command-center',
  '/erp-orders': 'erp-orders',
  '/erp-customers': 'erp-customers',
  '/erp-inventory': 'erp-inventory',
  '/erp-pos': 'erp-pos',
  '/knowledge-hub': 'knowledge-hub',
  '/n8n-workflows': 'automations',
  '/chatwoot-hub': 'support',
  '/trypost-social': 'marketing',
  '/website-builder': 'website',
  '/helpdesk': 'helpdesk',
  '/gameball': 'gameball',
  '/cms': 'cms',
  '/files': 'files',
  '/generative': 'generative',
  '/canvas': 'canvas',
};

// AuthedShell is the full application shell. It only mounts once the visitor is
// authenticated (see MuslimBotShell gate), so its data effects never run for guests.
export function AuthedShell({ children, user }) {
  const pathname = usePathname();
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const chatMode = selectChatMode(activeWorkspace);
  const isKnowledgeMode = activeWorkspace === 'knowledge-hub';

  const [chatOpen, setChatOpen] = useState(false);
  const [erpConnected, setErpConnected] = useState(false);
  const [erpStats, setErpStats] = useState(null);

  const chat = useGenerativeChat();
  const { initErp } = chat;

  // Sync route with zustand activeWorkspace so ChatMode and FAB work correctly
  useEffect(() => {
    const ws = ROUTE_TO_WORKSPACE_ID[pathname] || 'command-center';
    if (ws !== activeWorkspace) setActiveWorkspace(ws);
  }, [pathname, activeWorkspace, setActiveWorkspace]);

  useEffect(() => {
    initErp();
  }, [initErp]);

  useEffect(() => {
    async function loadStats() {
      const connected = await checkERPConnection();
      setErpConnected(connected);
      if (connected) {
        const ctx = await fetchERPContext();
        if (ctx?._meta) setErpStats(ctx._meta);
      }
    }
    loadStats();
  }, []);

  useEffect(() => {
    const handler = () => {
      invalidateERPCache();
      fetchERPContext().then((ctx) => {
        if (ctx?._meta) setErpStats(ctx._meta);
      });
    };
    window.addEventListener('erp:cache:invalidate', handler);
    return () => window.removeEventListener('erp:cache:invalidate', handler);
  }, []);

  const chatPanelOpen = chatMode === 'docked' || chatOpen;
  // The Knowledge Hub renders its own FAB-launched Test Agent widget, so the
  // shell cedes chat there — no docked panel and no global FAB (avoids duplicates).
  const knowledgeOwnsChat = isKnowledgeMode;

  return (
    <AppShell
      sidebar={<NavigationPill />}
      canvas={
        <>
          <UserMenu user={user} />
          <VoiceCallButton />
          <PersistentIframes />
          {/* Pad route content below the Systems Hub bar so it isn't clipped */}
          <div
            className="relative w-full h-full z-0 overflow-y-auto min-h-0"
            style={{ paddingTop: isSystemRoute(pathname) ? SYSTEMS_BAR_HEIGHT : 0 }}
          >
            {children}
          </div>
        </>
      }
      chat={
        knowledgeOwnsChat ? null : (
          <GlobalChatPanel
            mode={chatMode}
            open={chatPanelOpen}
            onClose={() => setChatOpen(false)}
            isKnowledgeMode={isKnowledgeMode}
            chat={chat}
          />
        )
      }
      chatDocked={!knowledgeOwnsChat && chatMode === 'docked'}
      fab={
        knowledgeOwnsChat ? null : (
          <MuslimbotFab
            visible={chatMode === 'overlay'}
            open={chatOpen}
            onClick={() => setChatOpen((o) => !o)}
            unread={0}
          />
        )
      }
    />
  );
}
