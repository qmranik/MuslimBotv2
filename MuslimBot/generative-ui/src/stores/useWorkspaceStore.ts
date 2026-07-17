import { create } from 'zustand';
import { getWorkspaceUrl } from '../config/workspaceUrls';

export const WORKSPACE_IDS = [
  'command-center',
  'erp-orders',
  'erp-customers',
  'erp-inventory',
  'erp-pos',
  'knowledge-hub',
  'automations',
  'support',
  'marketing',
  'website',
  'helpdesk',
  'gameball',
  'cms',
  'files',
  'generative',
] as const;

export type WorkspaceId = typeof WORKSPACE_IDS[number];

export interface WorkspaceConfig {
  id: WorkspaceId;
  title: string;
  isExternal: boolean;
  targetUrl?: string;
  ssoApp?: string;
}

function buildWorkspaces(): Record<WorkspaceId, WorkspaceConfig> {
  return {
    'command-center': {
      id: 'command-center',
      title: 'Command Center',
      isExternal: false,
    },
    'erp-orders': {
      id: 'erp-orders',
      title: 'Orders & Invoices',
      isExternal: false,
    },
    'erp-customers': {
      id: 'erp-customers',
      title: 'Customers',
      isExternal: false,
    },
    'erp-inventory': {
      id: 'erp-inventory',
      title: 'Inventory & Stock',
      isExternal: false,
    },
    'erp-pos': {
      id: 'erp-pos',
      title: 'Point of Sale',
      isExternal: false,
    },
    'knowledge-hub': {
      id: 'knowledge-hub',
      title: 'Knowledge Hub',
      isExternal: false,
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
      title: 'TryPost Marketing',
      targetUrl: getWorkspaceUrl('marketing'),
      isExternal: true,
      ssoApp: 'trypost',
    },
    website: {
      id: 'website',
      title: 'Website Builder',
      targetUrl: getWorkspaceUrl('website'),
      isExternal: true,
      ssoApp: 'frappe-builder',
    },
    helpdesk: {
      id: 'helpdesk',
      title: 'Help Desk',
      targetUrl: getWorkspaceUrl('helpdesk'),
      isExternal: true,
      ssoApp: 'helpdesk',
    },
    gameball: {
      id: 'gameball',
      title: 'Loyalty & Rewards',
      targetUrl: getWorkspaceUrl('gameball'),
      isExternal: true,
      ssoApp: 'gameball',
    },
    cms: {
      id: 'cms',
      title: 'Content CMS',
      targetUrl: getWorkspaceUrl('cms'),
      isExternal: true,
      ssoApp: 'cms',
    },
    files: {
      id: 'files',
      title: 'Nextcloud Files',
      targetUrl: getWorkspaceUrl('files'),
      isExternal: true,
      ssoApp: 'nextcloud',
    },
    generative: {
      id: 'generative',
      title: 'Generative AI',
      isExternal: false,
    }
  };
}

export type CommandCenterTab = 'dashboard' | 'assistant';
export type KnowledgeHubTier = 'public' | 'private';
export type KnowledgeHubIngestMode = 'file' | 'url' | 'bulk';

interface WorkspaceState {
  activeWorkspace: WorkspaceId;
  mountedWorkspaces: WorkspaceId[];
  workspaces: Record<WorkspaceId, WorkspaceConfig>;
  
  // Command Center State
  commandCenterTab: CommandCenterTab;
  isAssistantFullScreen: boolean;
  
  // Knowledge Hub State
  knowledgeHubTier: KnowledgeHubTier;
  knowledgeHubIngestMode: KnowledgeHubIngestMode;

  // Actions
  setActiveWorkspace: (id: WorkspaceId) => void;
  mountWorkspace: (id: WorkspaceId) => void;
  unmountWorkspace: (id: WorkspaceId) => void;
  setWorkspaceUrl: (id: WorkspaceId, url: string) => void;
  
  setCommandCenterTab: (tab: CommandCenterTab) => void;
  toggleAssistantFullScreen: (force?: boolean) => void;
  setKnowledgeHubTier: (tier: KnowledgeHubTier) => void;
  setKnowledgeHubIngestMode: (mode: KnowledgeHubIngestMode) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeWorkspace: 'command-center',
  mountedWorkspaces: ['command-center'],
  workspaces: buildWorkspaces(),
  
  commandCenterTab: 'dashboard',
  isAssistantFullScreen: false,
  knowledgeHubTier: 'public',
  knowledgeHubIngestMode: 'file',

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

  setCommandCenterTab: (tab) =>
    set(() => ({
      commandCenterTab: tab,
    })),
    
  toggleAssistantFullScreen: (force) =>
    set((state) => ({
      isAssistantFullScreen: force !== undefined ? force : !state.isAssistantFullScreen,
    })),
    
  setKnowledgeHubTier: (tier) =>
    set(() => ({
      knowledgeHubTier: tier,
    })),
    
  setKnowledgeHubIngestMode: (mode) =>
    set(() => ({
      knowledgeHubIngestMode: mode,
    })),
}));

export function selectChatMode(activeWorkspace: WorkspaceId) {
  return activeWorkspace === 'knowledge-hub' ? 'docked' : 'overlay';
}
