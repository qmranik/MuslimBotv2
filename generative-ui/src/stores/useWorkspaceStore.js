import { create } from 'zustand';
import { getWorkspaceUrl } from '../config/workspaceUrls';

export const WORKSPACE_IDS = [
  'command-center',
  'knowledge-hub',
  'erp-ops',
  'automations',
  'support',
  'marketing',
];

function buildWorkspaces() {
  return {
    'command-center': {
      id: 'command-center',
      title: 'Command Center',
      isExternal: false,
    },
    'knowledge-hub': {
      id: 'knowledge-hub',
      title: 'Knowledge Hub',
      isExternal: false,
    },
    'erp-ops': {
      id: 'erp-ops',
      title: 'liteERP /ops',
      targetUrl: getWorkspaceUrl('erp-ops'),
      isExternal: true,
      ssoApp: 'erp-ops',
    },
    automations: {
      id: 'automations',
      title: 'n8n Automations',
      targetUrl: getWorkspaceUrl('automations'),
      isExternal: true,
      ssoApp: 'n8n',
    },
    support: {
      id: 'support',
      title: 'Omnichannel Chatwoot',
      targetUrl: '',
      isExternal: true,
      ssoApp: 'chatwoot',
    },
    marketing: {
      id: 'marketing',
      title: 'Postiz Marketing',
      targetUrl: getWorkspaceUrl('marketing'),
      isExternal: true,
      ssoApp: 'postiz',
    },
  };
}

export const useWorkspaceStore = create((set, get) => ({
  activeWorkspace: 'command-center',
  mountedWorkspaces: ['command-center'],
  workspaces: buildWorkspaces(),

  setActiveWorkspace: (id) =>
    set((state) => {
      const nextMounted = state.mountedWorkspaces.includes(id)
        ? state.mountedWorkspaces
        : [...state.mountedWorkspaces, id];
      return { activeWorkspace: id, mountedWorkspaces: nextMounted };
    }),

  mountWorkspace: (id) =>
    set((state) => ({
      mountedWorkspaces: state.mountedWorkspaces.includes(id)
        ? state.mountedWorkspaces
        : [...state.mountedWorkspaces, id],
    })),

  unmountWorkspace: (id) =>
    set((state) => ({
      mountedWorkspaces: state.mountedWorkspaces.filter((wId) => wId !== id),
      activeWorkspace: state.activeWorkspace === id ? 'command-center' : state.activeWorkspace,
    })),

  setWorkspaceUrl: (id, url) =>
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [id]: { ...state.workspaces[id], targetUrl: url },
      },
    })),
}));

export function selectChatMode(activeWorkspace) {
  return activeWorkspace === 'knowledge-hub' ? 'docked' : 'overlay';
}
