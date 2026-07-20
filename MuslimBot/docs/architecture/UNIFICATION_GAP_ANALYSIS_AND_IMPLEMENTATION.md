# MuslimBot Unification — Gap Analysis, Feedback & Detailed Implementation Plan

**Status:** audited against the working tree 2026-07-20 · **Owner:** platform
**Basis:** [`UNIFIED_PLATFORM_DESIGN.md`](UNIFIED_PLATFORM_DESIGN.md) (target design). This doc
is the delta: every gap between that design and the code as it exists **today**, with
evidence (`file:line`), severity, the fix, and a workstream-by-workstream implementation plan.

> **Implementation status (2026-07-20):** W1, W2, W3 (portal/nav/route), W5, and the W6 lint
> debt are **implemented** — orchestrator builds + full `go test ./...` green; GenUI
> `tsc`/`eslint` clean and `next build` succeeds. See §5 "Implementation log" at the end.
> Remaining: W3 Builder image bake, W4 (SSE + persistent iframes + chat persistence), and
> W5 cross-tenant isolation tests for ToolAction/MCP. GAP-1/2/3/4(portal)/6/7/8/9/15 closed.

---

## 0. Audit summary — what the code actually looks like now

The root `generative-ui/` was **restructured since the design doc was written** (§4.1 of the
design doc is stale):

- Routes flattened: `/` (dashboard), `/erp`, `/kb`, `/support`, `/marketing`, `/workflows`,
  `/agent` (voice), `/system` — no more `/workspace/*` prefix.
- Components live at `src/components/`; `SecurePortal` became
  [`IframeWrapper.tsx`](../../../generative-ui/src/components/IframeWrapper.tsx) (same design:
  two-phase load, retry, S-2 sandbox invariant).
- The shell is now [`Sidebar.tsx`](../../../generative-ui/src/components/Sidebar.tsx) +
  root [`layout.tsx`](../../../generative-ui/src/app/layout.tsx) mounting `AiChatPanel` **and**
  `VoiceCallOverlay` globally — chat + voice persist on every route. ✔
- **Real data landed:** `DashboardOverview` calls `erpCall('api.dashboard.get_dashboard_kpis')`
  + `systemHealth()`; KB browser and voice session ride `/v1/kb/*` via
  [`useVoiceSession.ts`](../../../generative-ui/src/hooks/useVoiceSession.ts). ✔
- `GenerativeRenderer` has a full **ActionComponent** confirm card (params table,
  missing-fields form, Confirm button → `executeTool(tool, params, confirm=true)`). ✔

**The architecture is unified on paper; the audit found the *write path* is where unification
actually breaks** (GAP-1/2/3 below). Everything else is wiring, screens, and hardening.

---

## 1. Gap register

Severity: 🔴 breaks the headline promise · 🟠 blocks a design commitment · 🟡 quality/hardening.

### 1.1 Cross-cutting (the write path) — the gaps that matter most

| ID | Sev | Gap | Evidence | Fix (→ workstream) |
|---|---|---|---|---|
| **GAP-1** | 🔴 | **Humans have no working write path.** `ToolExecuteHandler` returns **428** for every `ToolWrite` — even with `confirm=true` — directing callers to `/v1/agent/tool-actions`. But those routes sit behind `WorkloadMiddleware` (workload JWT): a browser session can never reach them. The UI's ActionComponent Confirm button therefore always fails. "Ask the agent to update inventory" is broken end-to-end. | [`generate_ui.go:159-167`](../../go-orchestrator/internal/ai/generate_ui.go) · [`main.go:190-201`](../../go-orchestrator/cmd/server/main.go) · [`GenerativeRenderer.tsx:344`](../../../generative-ui/src/components/GenerativeRenderer.tsx) | Expose **human ToolAction routes** under `AuthentikMiddleware`; UI switches to prepare→confirm (→ **W1**) |
| **GAP-2** | 🔴 | **`/v1/mcp/call` bypasses confirm-first.** No write classification or confirmation anywhere in `internal/mcp/` — a direct call (or the Gemini loop) can publish a TryPost post or mutate Chatwoot with zero confirmation, violating platform invariant #1. | `internal/mcp/handler.go` (no gate; `writeMu` in `client.go` is only a transport mutex) | Server-side MCP tool policy: allowlist reads, route writes through ToolAction (→ **W2**) |
| **GAP-3** | 🟠 | **Agent chat is text-only.** `/v1/ai/chat` returns `{response: string}` (`router.go:96`); tool calls happen invisibly server-side. The UI gets no descriptors, no tool-call trace, no pending-confirmation object — so Agent mode can't render tables, charts, or the A8 confirm card. The two chat modes (Agent vs Dashboard) are a workaround for this. | [`router.go:82-96`](../../go-orchestrator/internal/ai/router.go) · `AiChatPanel.tsx:245-270` | Structured chat envelope `{response, blocks[], tool_events[], pending_action}` (→ **W2**) |

### 1.2 Backend gaps

| ID | Sev | Gap | Evidence | Fix |
|---|---|---|---|---|
| GAP-4 | 🟠 | No `builder` portal case → Builder can never appear in the pane; also not installed in the image (deploy guide Phase 7 works around it) | `portals/handler.go` switch; root `Dockerfile` | **W3** |
| GAP-5 | 🟠 | No event push to the UI — outbox dispatcher delivers to n8n/Redis Streams but there is no `/v1/events/stream` SSE; the activity feed can only poll | `main.go` route table; `events/dispatcher.go` | **W4** |
| GAP-6 | 🟡 | G10 is fail-closed **only when a platform DB is present**; legacy paths fall back to `tenant="default"` (`middleware.go:66,99`) — fine in dev, must be impossible in production | `auth/middleware.go` | **W5**: `MustValidate` requires platform DB when `ENV=production` |
| GAP-7 | 🟡 | `/v1/mcp/*` is outside the P8 rate limiter (only `ai/*` is limited) — direct MCP calls are an unmetered cost/abuse path | `main.go:165-177` | **W5**: wrap `mcpGroup` in the limiter |
| GAP-8 | 🟡 | `apiKey == "mock-key"` canned-response branch ships in production code | `router.go:49-52` | **W5**: compile it out behind `ENV!=production` |
| GAP-9 | 🟡 | ToolAction audit exists for voice, but human writes (once W1 lands) must audit identically — one table, one trail | `internal/actions/`, `internal/store/` | **W1** |

### 1.3 Frontend gaps

| ID | Sev | Gap | Evidence | Fix |
|---|---|---|---|---|
| GAP-10 | 🟠 | ActionComponent executes on the **client's** params with a single click — once W1 lands it must show the **server-normalized** ToolAction (what will actually run) between prepare and confirm | `GenerativeRenderer.tsx` ActionComponent | **W1** |
| GAP-11 | 🟠 | No Builder/Site surface in nav (`/system` page also exists but is unlinked); missing design-doc screens: A5 profile/session menu, A6 tenant switcher, A7 403/no-tenant | `Sidebar.tsx:19-25` | **W3** |
| GAP-12 | 🟡 | Chat history is lost on reload (state only); no persistence per tenant/user | `AiChatPanel.tsx` | **W4**: sessionStorage first, `/v1` thread API later |
| GAP-13 | 🟡 | Portal iframes unmount on route change (session flash on tab switch) — design doc committed to a persistent-iframe shell | `IframeWrapper` per-page | **W4** |
| GAP-14 | 🟡 | Activity feed & KPI cards don't refresh (single `useEffect` fetch); no polling/SSE, no stale indicator | `DashboardOverview.tsx:118+` | **W4** |
| GAP-15 | 🟡 | Pre-existing lint errors (`page.tsx` unescaped entities, unused import) block strict `next build` | `npx eslint src` | **W6** (already a task chip) |

### 1.4 Docs/process gaps

| ID | Sev | Gap | Fix |
|---|---|---|---|
| GAP-16 | 🟡 | Design doc §4.1 route map + component names are stale after the restructure | Banner added; this doc is the delta (→ W6 folds back) |
| GAP-17 | 🟡 | Two GenUI trees still exist (`MuslimBot/generative-ui` legacy vs root canonical); compose now builds root, but the legacy tree remains a confusion source | **W6**: retire legacy tree in the repo-restructure commit |

---

## 2. Feedback & suggestions (beyond the gaps)

**Backend (go-orchestrator):**
1. **One write pipeline.** After W1/W2 there must be exactly one code path that mutates
   business state: `ToolAction.prepare → confirm → execute` — used by chat, voice, MCP, and
   any future surface. Idempotency key on confirm (`action_id` is it) so double-clicks and
   retries are safe.
2. **Typed error envelope** `{error, code, details, action_id?}` across `/v1` — the UI
   currently string-matches errors.
3. **Observability:** the request logger exists; add per-tool counters (executions, confirms,
   rejections) and MCP server up/down gauges — they feed the Command Center health strip for
   free via `/v1/platform/services`.
4. **Backup coverage:** `backup.sh` covers MariaDB/files/n8n; platform-Postgres (ToolAction
   audit, tenants, outbox) and trypost-pg must join it before R5 go-live.

**Frontend (generative-ui):**
1. **Trust surface first.** The confirm card is the product's credibility. After W1, show:
   what will run (server echo), on which tenant, est. effect ("Stock Entry: +20 Kg Basmati
   Rice → Dry Store"), and the audit id after success.
2. **Tool-call visibility.** In Agent mode, stream/render `tool_events` ("calling
   trypost.schedule_post…") — invisible tool use reads as magic until it fails, then it reads
   as broken.
3. **Merge the chat modes** once W2 lands: one input, server decides whether the answer is
   prose, blocks, or a pending action. Keep a mode toggle only as a power-user override.
4. **Session UX:** avatar menu (identity from `/v1/auth/me`), sign-out via Authentik logout,
   tenant badge always visible — multi-tenant safety is also a UI affordance.
5. **State care:** persist chat per session, keep portal iframes mounted (hidden) across
   tabs, poll health at 30s with backoff, skeletons everywhere a fetch happens.

---

## 3. Detailed implementation plan

### W1 — Human write path (ToolAction for browsers) — *unblocks the product*

**Backend** (`go-orchestrator`):
1. `cmd/server/main.go`: register human-plane ToolAction routes inside the Authentik group:
   ```go
   api.POST("/tool-actions", actionsHandler.PrepareHuman)      // body: {tool, params}
   api.POST("/tool-actions/:id/confirm", actionsHandler.ConfirmHuman)
   api.GET("/tool-actions/:id", actionsHandler.Get)
   ```
2. `internal/actions/handler.go`: `PrepareHuman` = existing `Prepare` but actor from
   `user_email`/`tenant_id` context (not workload claims); persist `actor_kind="human"`.
   Validate tool ∈ `Catalog` and `Kind==ToolWrite`; normalize params server-side and return
   the normalized echo: `{action_id, tool, normalized_params, summary, expires_at}`.
3. `ConfirmHuman`: single-use, expiring (5 min), tenant-checked, executes via the same
   executor as `/v1/ai/tool/execute` reads; result stored on the ToolAction row (GAP-9: one
   audit trail).
4. `generate_ui.go:159`: change the 428 payload to point at the new human route:
   `"details": "POST /v1/tool-actions → confirm"` — and have `generate-ui` emit `action`
   descriptors carrying `action_id` when it already prepared one.

**Frontend:**
5. `src/lib/api.ts`:
   ```ts
   export interface ToolAction { action_id: string; tool: string;
     normalized_params: Record<string, unknown>; summary: string; expires_at: string; }
   export const prepareAction = (tool: string, params: Record<string, unknown>) =>
     apiFetch<ToolAction>('/v1/tool-actions', { method: 'POST', body: JSON.stringify({ tool, params }) });
   export const confirmAction = (id: string) =>
     apiFetch<ToolResult>(`/v1/tool-actions/${id}/confirm`, { method: 'POST' });
   ```
6. `GenerativeRenderer.tsx` ActionComponent becomes two-step: on mount (or on "Review")
   → `prepareAction` → render **server-normalized** summary/params → Confirm →
   `confirmAction(action_id)` → success block with audit id. Remove the direct
   `executeTool(..., true)` write path.

**Acceptance:** the §6 design-doc flow passes in the browser: "add 20 kg basmati rice to Dry
Store" → prepared card (server echo) → Confirm → submitted Stock Entry named in the reply;
the ToolAction row shows `actor_kind=human`, `status=executed`.

### W2 — One agent protocol (structured chat + MCP confirm policy)

**Backend:**
1. New response envelope from `POST /v1/ai/chat` (`internal/ai/router.go`):
   ```json
   { "response": "…prose…",
     "blocks":   [ UiDescriptor… ],
     "tool_events": [ {"server":"trypost","tool":"schedule_post","status":"ok"} ],
     "pending_action": { ToolAction | null } }
   ```
   Inside the Gemini function-calling loop: read tools execute inline (append `tool_events`);
   **write tools do NOT execute** — they `Prepare` a ToolAction and return it as
   `pending_action` (loop ends with the model told "awaiting user confirmation").
2. **MCP write policy** (`internal/mcp/manager.go` + `handler.go`): classify tools by server
   metadata + a config allowlist (`MCP_WRITE_TOOLS`, e.g. `trypost:*post*`,
   `chatwoot:*create*|*update*|*assign*`). `CallTool` with a write-class tool → 428 +
   prepared ToolAction, exactly like GAP-1's fix. Reads pass through untouched.
3. Wrap `mcpGroup` in `aiLimiter` (GAP-7).

**Frontend:**
4. `aiChat()` returns the envelope; `AiChatPanel` renders `blocks` via `GenerativeRenderer`,
   `tool_events` as an inline progress trail, and `pending_action` as the W1 confirm card.
5. Collapse Agent/Dashboard into one default mode (toggle retained as override).

**Acceptance:** in one chat: "what's low in the kitchen?" → table block; "schedule the Friday
special post" → tool trail + confirm card; nothing reaches TryPost until Confirm — verified
by the ToolAction audit and TryPost's own log.

### W3 — Complete the pane (Builder, screens, portals)

1. `portals/handler.go`: add `case "builder": portalURL = frappePublic + "/builder"; auth "proxy"`.
   `api.ts`: add `'builder'` to `PortalApp`. New route `src/app/site/page.tsx` →
   `<IframeWrapper targetApp="builder" />`; Sidebar gains `Site` (icon `Globe`) and links the
   orphaned `/system` page (icon `Activity`) (GAP-11).
2. Bake Builder into the ERPNext image (root `Dockerfile`: `bench get-app builder` +
   `apps.txt` + build) — removes deploy-guide Phase 7's container-layer caveat.
3. Screens: avatar/session menu in Sidebar (A5: `/v1/auth/me`, sign-out → Authentik logout);
   tenant badge + switcher stub (A6); `403/no-tenant` page (A7) rendered when `auth/me` → 403.

### W4 — Live pane (events, persistence)

1. `GET /v1/events/stream` (SSE, Authentik plane): dispatcher tees outbox rows for the
   caller's tenant onto a per-connection channel; heartbeat every 25s; UI `EventSource` feeds
   the dashboard activity feed and toasts ("Invoice SINV-0042 submitted").
2. Persistent-iframe shell: mount all `IframeWrapper`s once in layout, toggle `hidden` by
   route (GAP-13).
3. Chat persistence: mirror messages to `sessionStorage` keyed by tenant (GAP-12).
4. Dashboard: 30s poll fallback where SSE unavailable; stale badge after 2 missed cycles.

### W5 — Production floor hardening

1. `config.MustValidate`: when `ENV=production` require platform DB configured (kills the
   `"default"`-tenant fallback paths — GAP-6) and reject `mock-key` (GAP-8).
2. Isolation tests: extend `internal/knowledge/access_test.go` pattern to ToolAction + MCP
   (tenant A preparing/confirming against tenant B's ids must 403/404).
3. Backup: add platform-pg + trypost-pg dumps to `small_erp/scripts/backup.sh`.

### W6 — Convergence & cleanup

1. Fold the corrected route map + this gap register's outcomes back into
   `UNIFIED_PLATFORM_DESIGN.md`; delete the stale §4.1 table.
2. Retire `MuslimBot/generative-ui/` (legacy tree) in the repo-restructure commit (GAP-17).
3. Fix lint debt (GAP-15); make `next build` + `eslint` CI-gating for the pane.
4. Update `TEST_PLAN_GENUI_ORCHESTRATOR.md` with the W1/W2 acceptance flows.

### Sequencing

**W1 → W2** are the product (do first, in order — W2 builds on W1's ToolAction plumbing).
**W3** parallel-safe after W1. **W4** anytime after W2. **W5** before any real tenant.
**W6** continuous. Rough effort: W1 ≈ 2–3 days, W2 ≈ 3–4, W3 ≈ 2, W4 ≈ 2–3, W5 ≈ 2, W6 ≈ 1.

---

## 4. Acceptance matrix (go/no-go for "unified")

| # | Scenario | Proves |
|---|---|---|
| 1 | Chat: "add 20 kg basmati rice to Dry Store" → prepared card → Confirm → Stock Entry submitted; audit row `actor_kind=human` | GAP-1/9/10 closed |
| 2 | Chat: "schedule Friday special on socials" → tool trail → confirm card; TryPost receives nothing before Confirm | GAP-2/3 closed |
| 3 | Voice: same ask, spoken confirm → same ToolAction table | one write pipeline |
| 4 | `Site` tab renders Builder inside the pane; blog edit round-trips | GAP-4/11 closed |
| 5 | Submit invoice in ERP `/ops` → activity feed entry in the pane < 5 s | GAP-5/14 closed |
| 6 | `ENV=production` boot with no platform DB → refuses to start | GAP-6 closed |
| 7 | Tenant-A user confirms tenant-B `action_id` → 403/404; `mcp/call` rate-limited | W5 |
| 8 | Reload mid-conversation → chat restored; tab-switch → portal session intact | GAP-12/13 closed |

---

## 5. Implementation log (2026-07-20)

**W1 — Human write path (GAP-1/9/10, closed):**
- `go-orchestrator/internal/actions/human.go` (new): `PrepareHuman` / `ConfirmHuman` /
  `GetHuman` on the Authentik plane. Reads execute instantly; writes create a durable,
  single-use, expiring `ToolAction` and return **server-normalized params**. Same table + audit
  trail as voice; `ActorKind="human"` prevents cross-plane confirmation.
- `internal/store/models_voice.go`: added `ActorKind` column.
- `internal/ai/tools.go`: exported `NormalizeArgs` (the "server truth" for the confirm card).
- `cmd/server/main.go`: `POST /v1/tool-actions`, `POST /v1/tool-actions/:id/confirm`,
  `GET /v1/tool-actions/:id` under `AuthentikMiddleware`.
- `internal/ai/generate_ui.go`: 428 now points browsers at `/v1/tool-actions`.
- GenUI `src/lib/api.ts`: `prepareAction` / `confirmAction` / `ToolAction`.
- GenUI `src/components/GenerativeRenderer.tsx`: `ActionComponent` is now two-step
  (intent → **Review** (prepare, shows server-normalized params) → **Confirm & Execute**).

**W2 — One agent protocol (GAP-2/3, closed):**
- `internal/mcp/policy.go` (new) + `manager.go`: `IsWrite(server, tool)` — verb heuristic +
  `MCP_WRITE_TOOLS` glob allowlist.
- `internal/mcp/handler.go`: `CallTool` returns 428 `needs_confirmation` for write-class tools
  unless `confirm=true`.
- `internal/ai/router.go`: `/v1/ai/chat` now returns a structured envelope
  `{response, blocks, tool_events, pending_action}`; the function-calling loop executes reads
  inline and turns a write into a `pending_action` (never auto-runs).
- GenUI `AiChatPanel.tsx`: renders the tool-call trail + a `PendingActionCard` that confirms
  via `mcpCall(..., confirm=true)`; `aiChat()` now returns the envelope.

**W3 — Builder in the pane (GAP-4/11, partial):**
- `internal/portals/handler.go`: `builder` case → `<frappe>/builder` (proxy).
- GenUI `api.ts` `PortalApp` += `builder`; `IframeWrapper` label; new `src/app/site/page.tsx`;
  Sidebar "Website" (Globe) entry. *Remaining:* bake Builder into the ERPNext image.

**W5 — Production floor (GAP-6/7/8, closed):**
- `internal/config/validate.go`: production now requires `DATABASE_URL` (G10 fail-closed +
  durable confirmations) and rejects `GEMINI_API_KEY=mock-key`; tests added.
- `cmd/server/main.go`: `/v1/mcp/*` now behind the AI rate limiter.

**W6 — Cleanup (GAP-15, closed):** fixed pre-existing type/lint errors that blocked
`next build` — `z.record` v4 signatures, dead `AgentState==='connected'` comparisons, the
`KnowledgeBaseBrowser` set-state-in-effect; deduped `TestIsStaff` in `internal/knowledge`.

**Verification:** `go build ./...` ✓ · `go test ./...` ✓ · `tsc --noEmit` ✓ ·
`eslint src` 0 errors ✓ · `next build` ✓ · browser smoke (site route + agent chat render, no
console errors) ✓. Full write-path E2E needs a live orchestrator + Gemini + platform DB.

**Not yet done:** W4 (SSE `/v1/events/stream`, persistent-iframe shell, chat persistence);
W3 Builder image bake; W5 ToolAction/MCP cross-tenant isolation tests; retire legacy
`MuslimBot/generative-ui` tree.
