# Context-Engineered Prompt — Full MuslimBot System Test on 4 GB RAM

> Paste everything inside the `=== PROMPT ===` block into a coding agent (Claude
> Code / an SRE agent) running **at the repo root** on the 4 GB machine. It is
> self-contained: role, context, constraints, task, per-silo procedure, memory
> discipline, and the required report format. It validates the production
> features added in `MUSLIMBOT_PRODUCTION_PLAN.md` (one AI brain, hardened auth,
> health/observability) on top of the existing silo strategy in
> `TEST_PLAN_4GB_RAM.md`.

---

```text
=== PROMPT ===

ROLE
You are a senior QA + SRE engineer validating the MuslimBot system (an AI ERP
built on Frappe/ERPNext + a Go orchestrator + a LiveKit/Gemini voice+KB agent +
a React generative-ui + a Flutter mobile app). You are rigorous, evidence-driven,
and memory-paranoid. You never claim a pass without proof (HTTP status, response
body, screenshot, or log line).

MISSION
Prove the full system works end-to-end — every surface, all three personas, and
the unified "one AI brain" path — on a machine with only 4 GB of RAM, by testing
in isolated silos rather than running everything at once.

HARD CONSTRAINTS (violating these fails the task)
1. Total footprint must stay ≤ 4 GB. The full stack needs ~15–17 GB, so you MUST
   NOT run it all at once. Test one silo at a time and TEAR DOWN between silos.
2. Docker Desktop is capped at 2 GB RAM / 1.5 GB swap. Heavy lightweight services
   (go-orchestrator, generative-ui) run NATIVELY on the host (Go 1.26, Node 20),
   never containerized during this test.
3. Before every silo: `docker compose -f docker-compose.local.yml down` and
   confirm `docker stats --no-stream` shows no lingering containers.
4. Watch memory continuously. If `docker stats` shows a container's MEM% > 90%,
   or the host starts swapping hard (>1 GB swap used), STOP that silo, record the
   OOM condition as a defect, and move on — do not push the machine into thrash.
5. Do NOT read `.env` or any secret file. When a step needs API keys, generate
   them at runtime (`bench ... execute frappe.client.generate_keys`) or read them
   from the running container's environment via the app, not from disk.
6. Never commit anything. This is a read/execute test run.

ENVIRONMENT FACTS
- Compose: docker-compose.local.yml (dev). Frappe site: small.localhost:8000.
- Orchestrator: go run ./cmd/server (PORT=8080), routes under /v1/*.
- New production endpoints to validate (added in MUSLIMBOT_PRODUCTION_PLAN):
  * GET  /v1/sys/health         → per-dependency status + active model ids
  * POST /v1/ai/generate-ui     → structured UiDescriptor (the ONE brain)
  * POST /v1/ai/tool/execute    → server-side 21-tool executor (writes need confirm=true)
  * small_erp.api.auth.login_to_get_keys (rate-limited 8/min, audited)
  * small_erp.api.auth.revoke_keys
- Personas: owner (System Manager/SMB Manager), employee (SMB Operator/etc),
  customer (Website/portal user). Flutter app derives persona from roles.
- Reference plans: TEST_PLAN_4GB_RAM.md (silo commands), REBUILD_PLAN.md (mobile),
  MUSLIMBOT_PRODUCTION_PLAN.md (what changed).

TEST MATRIX (run in order; tear down between each)

SILO 0 — Preflight (no heavy services)
- `docker --version`, `go version`, `node --version`, `flutter --version`.
- Static gates (fast, low memory):
  * go-orchestrator: `cd go-orchestrator && go vet ./... && go test ./...`
  * erp-flutter:     `cd erp-flutter && flutter analyze && flutter test`
  * small_erp:       `python3 -m py_compile small_erp/small_erp_app/small_erp/api/*.py`
- PASS = all three green. Record versions + results.

SILO 1 — Core ERP (Docker: mariadb, redis-cache, redis-queue, frappe-web, frappe-worker-default)
- Up the core, then: install/seed if fresh
  (`bench --site small.localhost execute small_erp.finish_setup.finish` and
   `... small_erp.seed_demo.create_demo_data`), `setup_permissions.run`.
- Verify /ops loads and a POST business action works (create a customer via /ops
  or the API). Capture the peak `docker stats` MEM for this silo.
- Auth hardening checks:
  * `login_to_get_keys` returns api_key/api_secret for a valid user (200).
  * Hammer it >8×/min for one user → expect HTTP 417/429 rate-limit (proves W1).
  * `revoke_keys` invalidates them (subsequent authed call → 401/403).
- PASS = /ops renders, write succeeds, rate-limit trips, revoke works.

SILO 2 — Orchestrator + One AI Brain (Docker: mariadb, redis-cache, frappe-web; Native: go-orchestrator)
- Generate a Frappe key/secret; export FRAPPE_API_KEY/SECRET + GEMINI_API_KEY;
  `go run ./cmd/server`.
- GET http://localhost:8080/v1/sys/health → assert JSON has services{frappe,
  kb_bff,platform_db} and models{router,voice}. frappe should read "online".
- POST /v1/ai/generate-ui with header X-authentik-email: test@local and body
  {"prompt":"show today's sales","persona_mode":"full","surface":"web"} →
  assert 200 and a JSON object with a "component" field (metrics|table|text|…).
  (If GEMINI_API_KEY unset, assert the graceful text descriptor instead.)
- POST /v1/ai/tool/execute {"tool":"search_items","params":{"query":"a"}} →
  assert 200 + {ok:true,...}. Then a write without confirm:
  {"tool":"create_customer","params":{...}} → assert 428 (confirm required);
  repeat with "confirm":true → assert it reaches Frappe.
- Missing identity: same calls WITHOUT X-authentik-email → assert 401 (proves the
  auth middleware gate).
- PASS = health accurate, generate-ui returns a descriptor, tool executor honors
  read/write + confirm + identity.

SILO 3 — Generative UI (Native: generative-ui; reuse Silo 2 backend if RAM allows, else Docker frappe-web only)
- `cd generative-ui && npm ci && npm run dev`. With the orchestrator up, set
  VITE_USE_SERVER_BRAIN unset/true so the app calls /v1/ai/generate-ui.
- In the browser: send "show revenue trend" → assert a chart/table renders and
  the Network tab shows POST /v1/ai/generate-ui (NOT a browser-side Gemini call).
- PASS = generative UI renders from the server brain; no VITE_GEMINI_API_KEY needed.

SILO 4 — Knowledge Base + Voice (Docker: frappe-web + muslimbot-kb-bff; optional --profile voice)
- KB: POST /v1/kb/chat (or :8787/chat) "what is your return policy?" → assert
  {reply, chunks}. Upload a source, re-query, assert it is retrieved.
- Voice (only if LIVEKIT_* configured and RAM headroom exists): POST
  /v1/kb/voice/session → assert {token,url}; connect a LiveKit test client and
  confirm the muslimbot agent joins and speaks. If LiveKit unset → assert 503
  and mark voice SKIPPED (not failed).
- PASS = RAG answers with citations; voice connects OR degrades cleanly.

SILO 5 — Mobile (erp-flutter) against the Silo-2 backend
- `cd erp-flutter && flutter run` (simulator or device; the app itself is light —
  the constraint is the backend, so keep only Silo-2 services up).
- Log in as each persona (owner/employee/customer) → assert the shell/nav differs
  per persona and the ERP-desk WebView loads authenticated.
- Open the MuslimBot FAB, send "today's sales" → assert it posts to
  /v1/ai/generate-ui and shows a reply. Customer persona → assert support/ordering
  scope wording.
- PASS = three personas route correctly; assistant hits the server brain.

MEMORY DISCIPLINE (run throughout)
- Between silos: `docker compose -f docker-compose.local.yml down && docker stats --no-stream`.
- During a silo: sample `docker stats --no-stream` at least twice; record peak
  MEM USAGE and MEM% per container. Note host swap via `vm_stat` (macOS) or
  `free -m` (Linux).
- If any silo exceeds the 4 GB envelope, record it as a capacity defect with the
  numbers and continue with the next silo.

OUTPUT — produce a single Markdown report with:
1. Summary table: | Silo | Result (PASS/FAIL/SKIP) | Peak Docker MEM | Notes |
2. Per silo: exact commands run, key HTTP statuses/response snippets, and the
   evidence (status codes, JSON fields, or screenshot references) that justify the
   verdict.
3. Defects: each with severity, repro, expected vs actual, and the memory reading
   if OOM-related.
4. Production-readiness callouts: which MUSLIMBOT_PRODUCTION_PLAN items are proven
   working vs still blocked, and the top 3 fixes before GA.
Do not mark a silo PASS without concrete evidence. If a required service OOMs on
4 GB, that is a legitimate FAIL/defect — report it honestly rather than forcing it.

=== END PROMPT ===
```

## Why this prompt is "context-engineered"
- **Role + mission + hard constraints up front** so the agent self-limits memory
  before touching anything.
- **Environment facts and the exact new endpoints** are inlined — the agent
  doesn't have to rediscover the API surface or the persona model.
- **A deterministic silo order with tear-down gates** encodes the 4 GB strategy as
  procedure, not hope.
- **Explicit pass/fail evidence rules** prevent hollow "looks good" claims.
- **A fixed report schema** makes runs comparable across machines and over time.
- **Honesty guardrails** (OOM = defect, don't read secrets, don't commit) keep the
  test safe and truthful on a constrained box.
