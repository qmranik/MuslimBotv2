# Test Plan — generative-ui ↔ go-orchestrator (incl. TryPost & Chatwoot MCP)

**Scope:** Validate the GenUI admin shell end-to-end against the Go orchestrator `/v1/*`,
including the new MCP host layer (TryPost HTTP MCP + fazer-ai/mcp-chatwoot stdio) driven by
the AI agent via `/v1/ai/chat` function-calling. Single-host Docker Compose ceiling.
**References:** `docs/architecture/ADR-0001`, `docs/PLATFORM_ORCHESTRATOR_SPEC.md`.

---

## 1. System under test

```
Browser → generative-ui (Next.js) ──┐
                                      ├─ /v1/ai/chat ── Gemini (function-calling)
  go-orchestrator (:8080, /v1/*) ─────┤        │
    ├─ /v1/mcp/servers|tools|call     │        └─ MCP host ──┬─ trypost  (HTTP  /mcp/trypost, bearer)
    ├─ /v1/portals/:app/url           │                      └─ chatwoot (stdio bun, 129 tools)
    ├─ /v1/erp/* → Frappe             │
    └─ /v1/kb/* → KB BFF :8787
```

## 2. Prerequisites & environment

| Requirement | Value / check |
|---|---|
| Orchestrator up | `curl -sf http://localhost:8080/v1/sys/health` → 200 |
| GenUI up | `npm run dev` (vite/next) or container; `NEXT_PUBLIC_ORCHESTRATOR_URL` set |
| Gemini key | `GEMINI_API_KEY` real (not `mock-key`) for tool tests |
| TryPost | deployed (compose `trypost`), `TRYPOST_API_TOKEN` set, `TRYPOST_MCP_ENABLED=true` |
| Chatwoot MCP | `CHATWOOT_MCP_ENABLED=true`, `CHATWOOT_API_TOKEN` set, `bun` + vendored `mcp-chatwoot` present in orchestrator image |
| Auth | valid Authentik session/headers (or `AUTH_LOCAL_BYPASS` in local only) |

> **No secrets in test artifacts.** Use env; never paste tokens into logs or this repo.

## 3. Test matrix

### A. Orchestrator health & contract
| # | Step | Expected | Type |
|---|---|---|---|
| A1 | `GET /v1/sys/health` | 200, JSON status | smoke |
| A2 | `GET /v1/platform/services` | dependency states (frappe, kb, chatwoot) | smoke |
| A3 | `GET /v1/auth/me` unauthenticated | 401 (fail closed) | security |
| A4 | `GET /v1/auth/me` with forged `X-authentik-email` directly | 401 unless trusted proxy | security (G2) |

### B. Portals (SSO bridge)
| # | Step | Expected |
|---|---|---|
| B1 | `GET /v1/portals/trypost/url` | 200, `url` = TryPost, `auth_mechanism: oidc` |
| B2 | `GET /v1/portals/postiz/url` (deprecated alias) | 200, resolves to TryPost URL |
| B3 | `GET /v1/portals/chatwoot/url` | 200, magic-link SSO URL |
| B4 | `GET /v1/portals/unknown/url` | 404 |

### C. AI chat (no tools)
| # | Step | Expected |
|---|---|---|
| C1 | `POST /v1/ai/chat {"prompt":"hi"}` with `GEMINI_API_KEY=mock-key` | 200, canned bullet list |
| C2 | `POST /v1/ai/chat` real key, plain question | 200, text response, no tool call |

### D. MCP host — direct surface
| # | Step | Expected |
|---|---|---|
| D1 | `GET /v1/mcp/servers` | lists `trypost`,`chatwoot` with `connected`/`tool_count`/`error` |
| D2 | `GET /v1/mcp/tools` | aggregated, namespaced tools; chatwoot ≈129 |
| D3 | `POST /v1/mcp/call {"server":"chatwoot","tool":"list_conversations","arguments":{"account_id":1}}` | 200 tool result |
| D4 | `POST /v1/mcp/call {"server":"trypost","tool":"<list-posts-tool>","arguments":{}}` | 200 tool result |
| D5 | `POST /v1/mcp/call` unknown server | 502 with error |
| D6 | Disable a server (`*_MCP_ENABLED=false`), D1 | server absent, others still work (no boot failure) |

### E. AI agent uses MCP (function-calling — the headline flow)
| # | Prompt via `/v1/ai/chat` | Expected behavior |
|---|---|---|
| E1 | "What MCP tools can you use?" | agent calls `mcp_list_tools`, summarizes servers/tools |
| E2 | "How many open conversations are in Chatwoot?" | `mcp_call` chatwoot reporting/list tool → number in reply |
| E3 | "Draft a LinkedIn post about our new product and show it to me (don't publish)." | `mcp_call` trypost draft tool; **does not publish**; asks confirmation |
| E4 | "Assign conversation 42 to the Sales team." | high-stakes → agent confirms intent before `mcp_call` |
| E5 | Tool errors (bad account_id) | agent surfaces error gracefully, no crash, no key leakage |

### F. generative-ui end-to-end (browser)
| # | Flow | Expected |
|---|---|---|
| F1 | Load shell; sidebar shows **TryPost Marketing** (no "Postiz") | pass |
| F2 | Navigate `/trypost-social` | TryPost portal iframe loads via `/v1/portals/trypost/url` |
| F3 | Command Center chat: run E1–E3 prompts | streamed answers reflect MCP tool results |
| F4 | Chatwoot tab loads via magic-link SSO | pass |
| F5 | Console/network: no 4xx/5xx, no leaked tokens in responses | pass |

### G. Non-functional
| # | Check | Target |
|---|---|---|
| G1 | `/v1/mcp/tools` latency (warm) | < 2s |
| G2 | Orchestrator boots with all MCP servers DOWN | starts; `/v1/sys/health` 200 |
| G3 | Tenant scoping: user A cannot address user B's Chatwoot account via `mcp_call` | enforced (fail closed) |

## 4. Evidence to capture
- `curl` transcripts for A–D (status + bodies, secrets redacted).
- Chat request/response JSON for E1–E5 showing the tool round-trips.
- Browser screenshots for F1–F4; network HAR summary for F5.
- `go test ./... ` output (unit coverage incl. `internal/mcp`).

## 5. Exit criteria
- A1–A4, B1–B4, C1–C2, D1–D6 pass.
- At least E1–E3 demonstrably invoke MCP tools and return correct results; E4 confirms before acting.
- F1–F5 pass. No secret ever appears in a response body or log.
- G2 holds (resilience). G3 holds or is filed as a blocking follow-up (ties to gap G10).

---

## 6. Context-engineered test prompt (paste into a fresh agent)

> Use this to drive the suite autonomously. It is self-verifying and evidence-based.

```
# ROLE
You are a QA automation engineer verifying MuslimBot's generative-ui ↔ go-orchestrator
integration, including the MCP host layer (TryPost HTTP MCP + fazer-ai/mcp-chatwoot stdio)
driven by the AI agent. You execute, observe, and report with evidence. You never assert a
pass without pasted proof, and you never print secrets.

# GROUND TRUTH
- Orchestrator: http://localhost:8080, API under /v1/* (auth via Authentik headers).
- MCP endpoints: GET /v1/mcp/servers, GET /v1/mcp/tools, POST /v1/mcp/call {server,tool,arguments}.
- Agent path: POST /v1/ai/chat {prompt} → Gemini function-calling → tools mcp_list_tools, mcp_call.
- Servers: "trypost" (HTTP, /mcp/trypost, bearer TRYPOST_API_TOKEN),
           "chatwoot" (stdio bun, reuses CHATWOOT_URL + CHATWOOT_API_TOKEN, ~129 tools).
- GenUI marketing tab must read "TryPost" (no "Postiz"); route is /trypost-social.
- Test plan: docs/testing/TEST_PLAN_GENUI_ORCHESTRATOR.md — sections A–G.

# HARD RULES
1. Read secrets only from the environment; never echo tokens. Redact anything sensitive.
2. Do not publish, delete, or mutate real data. For write-capable tools use dry-run/draft
   only, and stop for human confirmation before any high-stakes action (E4).
3. If a dependency is down, mark the test SKIP with the reason — do not fake a pass.
4. Fail closed: unauthenticated or cross-tenant access must be a FAIL if it succeeds.

# PROCEDURE
1. Preflight: confirm orchestrator health (A1–A2) and env readiness (§2). List what's missing.
2. Run A→G in order. For each: the exact request, the observed status/body (redacted), and
   PASS/FAIL/SKIP with a one-line reason.
3. For E (agent+MCP): capture the full /v1/ai/chat exchange and confirm a real tool round-trip
   occurred (mcp_list_tools / mcp_call), not a hallucinated answer. Verify E3 did NOT publish
   and E4 asked for confirmation.
4. For F (browser): drive generative-ui, screenshot F1–F4, and check console/network for
   4xx/5xx or leaked tokens.
5. Resilience: G2 — restart the orchestrator with all *_MCP_ENABLED=false and confirm it still
   boots and serves /v1/sys/health.

# OUTPUT
A single markdown report: a results table (id, status, evidence pointer), the captured
transcripts/screenshots, a "Defects" list (severity + repro), and an overall PASS/FAIL against
the §5 exit criteria. End with the exact commands you ran so the run is reproducible.
```
