export const WORKSPACE_URL_DEFAULTS = {
  'erp-ops': 'http://localhost:8000/ops',
  automations: 'http://localhost:5678',
  support: 'http://localhost:3000',
  marketing: 'http://localhost:4007',
  website: 'http://localhost:8000/builder',
  helpdesk: 'http://localhost:8000/helpdesk',
  gameball: 'https://app.gameball.co',
  cms: 'http://localhost:8000/cms',
  files: 'https://files.smb.localhost',
};

export function getWorkspaceUrl(id) {
  const envMap = {
    'erp-ops': process.env.NEXT_PUBLIC_WS_ERP_URL || process.env.VITE_WS_ERP_URL,
    automations: process.env.NEXT_PUBLIC_WS_N8N_URL || process.env.VITE_WS_N8N_URL,
    support: process.env.NEXT_PUBLIC_WS_CHATWOOT_URL || process.env.VITE_WS_CHATWOOT_URL,
    marketing: process.env.NEXT_PUBLIC_WS_POSTIZ_URL || process.env.VITE_WS_POSTIZ_URL,
    website: process.env.NEXT_PUBLIC_WS_BUILDER_URL || process.env.VITE_WS_BUILDER_URL,
    helpdesk: process.env.NEXT_PUBLIC_WS_HELPDESK_URL || process.env.VITE_WS_HELPDESK_URL,
    gameball: process.env.NEXT_PUBLIC_WS_GAMEBALL_URL || process.env.VITE_WS_GAMEBALL_URL,
    cms: process.env.NEXT_PUBLIC_WS_CMS_URL || process.env.VITE_WS_CMS_URL,
    files: process.env.NEXT_PUBLIC_WS_NEXTCLOUD_URL || process.env.VITE_WS_NEXTCLOUD_URL,
  };
  return envMap[id] || WORKSPACE_URL_DEFAULTS[id] || '';
}

export function parseAllowedOrigins(raw) {
  const envVal = process.env.NEXT_PUBLIC_PORTAL_ALLOWED_ORIGINS || process.env.VITE_PORTAL_ALLOWED_ORIGINS;
  const value = raw || envVal || 'localhost,.smb.localhost,.walshintegrated.com';
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}


export function isAllowedOrigin(origin, allowedSuffixes) {
  if (!origin) return false;
  return allowedSuffixes.some((suffix) => {
    if (suffix.startsWith('.')) {
      return origin.endsWith(suffix) || origin.includes(suffix);
    }
    return origin.includes(suffix);
  });
}
