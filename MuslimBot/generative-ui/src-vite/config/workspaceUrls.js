export const WORKSPACE_URL_DEFAULTS = {
  'erp-ops': 'http://localhost:8000/ops',
  automations: 'http://localhost:5678',
  support: 'http://localhost:3000',
  marketing: 'http://localhost:4007',
};

export function getWorkspaceUrl(id) {
  const envMap = {
    'erp-ops': import.meta.env.VITE_WS_ERP_URL,
    automations: import.meta.env.VITE_WS_N8N_URL,
    support: import.meta.env.VITE_WS_CHATWOOT_URL,
    marketing: import.meta.env.VITE_WS_POSTIZ_URL,
  };
  return envMap[id] || WORKSPACE_URL_DEFAULTS[id] || '';
}

export function parseAllowedOrigins(raw) {
  const value = raw || import.meta.env.VITE_PORTAL_ALLOWED_ORIGINS || 'localhost,.smb.localhost,.walshintegrated.com';
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
