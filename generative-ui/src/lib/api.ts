/**
 * Centralized API client for the MuslimBot Go orchestrator.
 *
 * All frontend ↔ backend communication flows through here.
 * The orchestrator sits at `api.<domain>` and masks all credentials
 * (Frappe tokens, MCP auth, Gemini keys) so nothing leaks to the browser.
 */

// ── Configuration ──────────────────────────────────────────────────────────

/**
 * Base URL for the Go orchestrator API.
 * In production: https://api.<public-domain>
 * In dev:        http://localhost:8080 or proxied via Next.js rewrites
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//api.${window.location.host.replace(/^ui\./, '')}`
    : 'http://localhost:8080');

// ── Types ──────────────────────────────────────────────────────────────────

/** Structured UI descriptor returned by /v1/ai/generate-ui */
export interface UiDescriptor {
  component:
    | 'metrics'
    | 'chart'
    | 'table'
    | 'card'
    | 'action'
    | 'flow'
    | 'navigate'
    | 'open_doc'
    | 'rag'
    | 'text';
  title?: string;
  explanation?: string;
  chartType?: 'bar' | 'line' | 'area' | 'pie';
  columns?: { key: string; label: string }[];
  data?: Record<string, unknown>[];
  metrics?: {
    label: string;
    value: string;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
  }[];
  cardDetails?: {
    title: string;
    subtitle?: string;
    details?: { label: string; value: string }[];
  };
  actionType?: string;
  actionParams?: Record<string, unknown>;
  missingFields?: string[];
  target?: string;
  url?: string;
  docType?: string;
  _dataSource?: string;
}

/** Chat history entry sent to the AI brain */
export interface ChatHistoryEntry {
  sender: 'user' | 'assistant';
  text: string;
}

/** Tool execution result from /v1/ai/tool/execute */
export interface ToolResult {
  tool: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  tenant?: string;
}

/** Health check response from /v1/sys/health */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  services: Record<string, string>;
  models?: Record<string, string>;
  timestamp: number;
  auth: string;
}

/** MCP server status */
export interface MCPServerStatus {
  name: string;
  transport: string;
  connected: boolean;
  tool_count: number;
  error?: string;
}

/** Auth identity from /v1/auth/me */
export interface AuthMe {
  email: string;
  name?: string;
  groups?: string[];
  tenant_id?: string;
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    credentials: 'include', // Forward Authentik cookies
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(
      res.status,
      `API ${res.status}: ${typeof body === 'object' && body !== null && 'error' in body ? (body as { error: string }).error : res.statusText}`,
      body
    );
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── AI Endpoints ───────────────────────────────────────────────────────────

/**
 * Generate a structured UI descriptor from a natural language prompt.
 * This is the primary AI brain endpoint — returns a UiDescriptor JSON that
 * the GenerativeRenderer maps to React components.
 */
export async function generateUI(
  prompt: string,
  history: ChatHistoryEntry[] = [],
  surface: 'web' | 'mobile' | 'voice' = 'web',
  personaMode: 'full' | 'support_and_ordering' = 'full'
): Promise<UiDescriptor> {
  return apiFetch<UiDescriptor>('/v1/ai/generate-ui', {
    method: 'POST',
    body: JSON.stringify({ prompt, history, surface, persona_mode: personaMode }),
  });
}

/**
 * Free-form AI chat (legacy endpoint, uses function-calling loop).
 * Returns a plain text response string.
 */
export async function aiChat(prompt: string): Promise<string> {
  const res = await apiFetch<{ response: string }>('/v1/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  return res.response;
}

/**
 * Execute a catalog tool (21-tool executor).
 * Write tools require confirm=true — the frontend must show a confirmation card first.
 */
export async function executeTool(
  tool: string,
  params: Record<string, unknown>,
  confirm = false
): Promise<ToolResult> {
  return apiFetch<ToolResult>('/v1/ai/tool/execute', {
    method: 'POST',
    body: JSON.stringify({ tool, params, confirm }),
  });
}

// ── ERP Gateway ────────────────────────────────────────────────────────────

/**
 * Call a Frappe/ERPNext whitelisted method via the orchestrator gateway.
 * The orchestrator injects the master Frappe API token server-side.
 *
 * @param method - Frappe method path after `small_erp.` (e.g., `api.dashboard.get_dashboard_kpis`)
 * @param params - Query parameters or POST body
 */
export async function erpCall<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  httpMethod: 'GET' | 'POST' = 'POST'
): Promise<T> {
  const path = `/v1/erp/${method.replace(/\./g, '/')}`;

  if (httpMethod === 'GET') {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<T>(`${path}${qs ? '?' + qs : ''}`);
  }

  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Knowledge Base (Go orchestrator owns all KB APIs) ──────────────────────

export interface KBSource {
  id: string;
  tenant_id?: string;
  title: string;
  source_type?: string;
  url?: string;
  status?: string;
  visibility?: string;
  chunk_count?: number;
}

export interface KBListResponse {
  items: KBSource[];
  total: number;
  as_staff?: boolean;
}

export interface VoiceSessionResponse {
  token: string;
  url: string;
  room_name: string;
  participant_identity: string;
  session_id?: string;
  tenant_id?: string;
}

/** List all KB sources for the authenticated tenant */
export async function kbListSources(): Promise<KBListResponse> {
  return apiFetch<KBListResponse>('/v1/kb/sources');
}

/** Chat with the knowledge base (RAG) */
export async function kbChat(
  message: string
): Promise<{ reply: string; chunks?: unknown[]; session_id?: string }> {
  return apiFetch<{ reply: string; chunks?: unknown[]; session_id?: string }>(
    '/v1/kb/chat',
    {
      method: 'POST',
      body: JSON.stringify({ message }),
    }
  );
}

/** Semantic retrieval from KB */
export async function kbRetrieve(
  query: string
): Promise<{ chunks: { text: string; score: number }[] }> {
  return apiFetch<{ chunks: { text: string; score: number }[] }>(
    '/v1/kb/retrieve',
    {
      method: 'POST',
      body: JSON.stringify({ query }),
    }
  );
}

/** Check KB health */
export async function kbHealth(): Promise<unknown> {
  return apiFetch<unknown>('/v1/kb/health');
}

/** Create a LiveKit voice session (token + named agent dispatch) */
export async function kbVoiceSession(
  participantName = 'workspace-user'
): Promise<VoiceSessionResponse> {
  return apiFetch<VoiceSessionResponse>('/v1/kb/voice/session', {
    method: 'POST',
    body: JSON.stringify({ participant_name: participantName }),
  });
}

/** Fetch the tenant voice brief used to warm agent context */
export async function kbVoiceBrief(): Promise<{ tenant_id: string; context: string }> {
  return apiFetch<{ tenant_id: string; context: string }>('/v1/kb/voice-brief');
}

/** Classify a URL before ingestion */
export async function kbClassifyUrl(
  url: string
): Promise<{ url_type: string; depth_default: number; normalized_url: string }> {
  return apiFetch('/v1/kb/sources/url/classify', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/** Ingest a URL into the tenant knowledge base */
export async function kbIngestUrl(
  url: string,
  title = ''
): Promise<{ source: string; status: string }> {
  return apiFetch('/v1/kb/sources/url', {
    method: 'POST',
    body: JSON.stringify({ url, title }),
  });
}

/** Delete a KB source (staff) */
export async function kbDeleteSource(sourceId: string): Promise<{ deleted: string }> {
  return apiFetch(`/v1/kb/sources/${encodeURIComponent(sourceId)}`, {
    method: 'DELETE',
  });
}

// ── MCP (Model Context Protocol) ──────────────────────────────────────────

/** List connected MCP servers and their status */
export async function mcpServers(): Promise<MCPServerStatus[]> {
  return apiFetch<MCPServerStatus[]>('/v1/mcp/servers');
}

/** List all available MCP tools across servers */
export async function mcpTools(): Promise<
  { server: string; name: string; description: string }[]
> {
  return apiFetch<{ server: string; name: string; description: string }[]>(
    '/v1/mcp/tools'
  );
}

/** Call an MCP tool directly */
export async function mcpCall(
  server: string,
  tool: string,
  args: Record<string, unknown> = {}
): Promise<{ is_error: boolean; result: string }> {
  return apiFetch<{ is_error: boolean; result: string }>('/v1/mcp/call', {
    method: 'POST',
    body: JSON.stringify({ server, tool, arguments: args }),
  });
}

// ── System ─────────────────────────────────────────────────────────────────

/** System health check */
export async function systemHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/v1/sys/health');
}

/** Current authenticated user identity */
export async function authMe(): Promise<AuthMe> {
  return apiFetch<AuthMe>('/v1/auth/me');
}

/** Platform services status (same as health but behind auth) */
export async function platformServices(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/v1/platform/services');
}

// ── Workflows ──────────────────────────────────────────────────────────────

/** Trigger an n8n workflow */
export async function triggerWorkflow(
  workflowId: string,
  data: Record<string, unknown> = {}
): Promise<unknown> {
  return apiFetch<unknown>('/v1/workflows/trigger', {
    method: 'POST',
    body: JSON.stringify({ workflow_id: workflowId, data }),
  });
}

// ── Portals (iframe SSO URLs) ──────────────────────────────────────────────

/**
 * Apps the orchestrator can mint an embed URL for.
 * These MUST match the `switch app` cases in
 * go-orchestrator/internal/portals/handler.go — note it is `trypost`, not `social`.
 * (`/workspace/social` is only the UX route name; the portal app id is `trypost`.)
 */
export type PortalApp = 'erp-ops' | 'n8n' | 'chatwoot' | 'trypost' | 'nextcloud';

/** Response shape from GET /v1/portals/:app/url */
export interface PortalResponse {
  url: string;
  embed_mode: 'iframe';
  auth_mechanism: 'proxy' | 'oidc' | 'forward_auth' | 'magic_link';
}

/** Get an SSO-provisioned portal URL for embedding */
export async function getPortalURL(app: PortalApp): Promise<PortalResponse> {
  return apiFetch<PortalResponse>(`/v1/portals/${app}/url`);
}

// ── Export ──────────────────────────────────────────────────────────────────

export { API_BASE, ApiError };
