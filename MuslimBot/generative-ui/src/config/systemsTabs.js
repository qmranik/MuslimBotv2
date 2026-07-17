import {
  Boxes, ShoppingCart, Headphones, Workflow, Share2,
  Globe, LifeBuoy, Gift, FileText, FolderOpen,
} from 'lucide-react';

/**
 * Single source of truth for the Systems Hub top navigation.
 * Used by both the shared <SystemsTabBar/> and the workspace/iframe wiring so
 * every screen shows the same set of digital-business tools (centralized design).
 */
export const SYSTEM_HUB = { label: 'Systems Hub', icon: Boxes };

export const SYSTEMS_TABS = [
  { id: 'erp-orders', name: 'ERPNext', href: '/erp-orders', icon: ShoppingCart, matchPrefix: '/erp-', ssoApp: 'erp-ops' },
  { id: 'support', name: 'Chatwoot', href: '/chatwoot-hub', icon: Headphones, ssoApp: 'chatwoot' },
  { id: 'automations', name: 'Automations', href: '/n8n-workflows', icon: Workflow, ssoApp: 'n8n' },
  { id: 'marketing', name: 'TryPost', href: '/trypost-social', icon: Share2, ssoApp: 'trypost' },
  { id: 'website', name: 'Website', href: '/website-builder', icon: Globe, ssoApp: 'frappe-builder' },
  { id: 'helpdesk', name: 'Help Desk', href: '/helpdesk', icon: LifeBuoy, ssoApp: 'helpdesk' },
  { id: 'gameball', name: 'Loyalty', href: '/gameball', icon: Gift, ssoApp: 'gameball' },
  { id: 'cms', name: 'CMS', href: '/cms', icon: FileText, ssoApp: 'cms' },
  { id: 'files', name: 'Files', href: '/files', icon: FolderOpen, ssoApp: 'nextcloud' },
];

// Height of the Systems Hub bar, in px. Content on system routes is padded by this.
export const SYSTEMS_BAR_HEIGHT = 56;

export function isSystemRoute(pathname) {
  return SYSTEMS_TABS.some((t) => pathname.startsWith(t.href)) || pathname.startsWith('/erp-');
}

export function isTabActive(tab, pathname) {
  if (tab.matchPrefix && pathname.startsWith(tab.matchPrefix)) return true;
  return pathname.startsWith(tab.href);
}

// Route → workspace id, for iframe mounting.
export const ROUTE_TO_WORKSPACE_ID = SYSTEMS_TABS.reduce((acc, t) => {
  acc[t.href] = t.id;
  return acc;
}, {});
