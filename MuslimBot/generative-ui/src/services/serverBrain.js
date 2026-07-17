/**
 * Server-side MuslimBot brain client.
 *
 * Calls the orchestrator `POST /v1/ai/generate-ui` (proxied via /v1) so the
 * Gemini key and tool credentials stay server-side — the browser no longer
 * needs VITE_GEMINI_API_KEY (MUSLIMBOT_PRODUCTION_PLAN W2.4). Returns a
 * UiDescriptor-shaped object, or null to let callers fall back to the local
 * router during dev when the endpoint is not reachable.
 */
export async function runServerRouter(query, history = [], { surface = 'web', personaMode = 'full' } = {}) {
  try {
    const res = await fetch('/v1/ai/generate-ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        prompt: query,
        history: (history || []).map((h) => ({ sender: h.sender, text: h.text })),
        surface,
        persona_mode: personaMode,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !data.component) return null;
    data._dataSource = data._dataSource || 'live';
    return data;
  } catch {
    return null;
  }
}

/** Execute a catalog tool server-side (writes require confirm=true). */
export async function executeServerTool(tool, params = {}, confirm = false) {
  const res = await fetch('/v1/ai/tool/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ tool, params, confirm }),
  });
  return res.json();
}
