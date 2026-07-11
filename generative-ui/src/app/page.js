"use client";

import { useEffect, useState } from 'react';
import { Key } from 'lucide-react';
import { AppShell } from '../layout/AppShell';
import { AppSidebar } from '../layout/AppSidebar';
import { GlobalChatPanel } from '../layout/GlobalChatPanel';
import { MuslimbotFab } from '../layout/MuslimbotFab';
import { WorkspaceManager } from '../components/WorkspaceManager';
import { WorkspaceNav } from '../components/WorkspaceNav';
import { useWorkspaceStore, selectChatMode } from '../stores/useWorkspaceStore';
import { useGenerativeChat } from '../hooks/useGenerativeChat';
import { getApiKey, saveApiKey, invalidateERPCache } from '../services/gemini';
import { checkERPConnection, fetchERPContext } from '../services/erpClient';
import { dummyDatabase } from '../data/database';
import { MuslimBotEcosystem } from '../pages/MuslimBotEcosystem';

function ApiKeyModal({ open, onClose, apiKey, setApiKey, onSave, onClear }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="panel-elevated max-w-md w-full p-6 animate-slide-up-fade">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            Gemini API Key
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">Close</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          className="space-y-4"
        >
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-400"
          />
          <div className="flex justify-between pt-2 border-t border-slate-200">
            <button type="button" onClick={onClear} className="text-xs text-slate-500 hover:text-slate-700 font-semibold">
              Clear Key
            </button>
            <button type="submit" className="px-4 py-1.5 accent-gradient text-white rounded-lg text-xs font-semibold">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState('/');
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const chatMode = selectChatMode(activeWorkspace);
  const isKnowledgeMode = activeWorkspace === 'knowledge-hub';

  const [chatOpen, setChatOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiStatus, setApiStatus] = useState('mock');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [erpConnected, setErpConnected] = useState(false);
  const [erpStats, setErpStats] = useState(null);

  const chat = useGenerativeChat();

  useEffect(() => {
    // Client-only initialization
    setRoute(window.location.hash.replace('#', '') || '/');
    setApiKey(getApiKey());
    setApiStatus(getApiKey() ? 'live' : 'mock');

    const onHash = () => setRoute(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    chat.initErp();
  }, []);

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

  const handleNewChat = () => {
    chat.clearChat();
    setChatOpen(true);
  };

  const handleSaveApiKey = () => {
    saveApiKey(apiKey);
    setApiStatus(apiKey ? 'live' : 'mock');
    setShowApiKeyModal(false);
  };

  const handleClearApiKey = () => {
    saveApiKey('');
    setApiKey('');
    setApiStatus('mock');
  };

  if (route === '/ecosystem') {
    return <MuslimBotEcosystem onEnterAdmin={() => { window.location.hash = ''; setRoute('/'); }} />;
  }

  return (
    <>
      <AppShell
        sidebar={
          <AppSidebar
            onNewChat={handleNewChat}
            erpConnected={erpConnected}
            erpStats={erpStats}
            apiStatus={apiStatus}
            onOpenApiKey={() => setShowApiKeyModal(true)}
            onClearApiKey={handleClearApiKey}
            invoiceCount={erpStats?.invoiceCount ?? dummyDatabase.invoices.length}
            customerCount={erpStats?.customerCount ?? dummyDatabase.customers.length}
            itemCount={erpStats?.itemCount ?? dummyDatabase.products.length}
          />
        }
        canvas={<WorkspaceManager />}
        chat={
          <GlobalChatPanel
            mode={chatMode}
            open={chatPanelOpen}
            onClose={() => setChatOpen(false)}
            isKnowledgeMode={isKnowledgeMode}
            chat={chat}
          />
        }
        chatDocked={chatMode === 'docked'}
        fab={
          <MuslimbotFab
            visible={chatMode === 'overlay'}
            open={chatOpen}
            onClick={() => setChatOpen((o) => !o)}
            unread={0}
          />
        }
        mobileNav={<WorkspaceNav layout="bottom" />}
      />

      <ApiKeyModal
        open={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        onSave={handleSaveApiKey}
        onClear={handleClearApiKey}
      />
    </>
  );
}
