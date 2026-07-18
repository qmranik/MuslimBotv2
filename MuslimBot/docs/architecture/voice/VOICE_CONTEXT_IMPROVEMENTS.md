# Voice Agent — Review & Contextual-Response Improvements

Review of the LiveKit + Gemini Live voice worker and its link to the Go orchestrator, with concrete
suggestions to deepen **shared Redis context** so the agent gives **contextual, caller-aware responses**.

Grounded in: `Muslimbot-voice-agent/` (`agent.py`, `services/{orchestrator_client,memory,redis_client,kb_update_service}.py`)
and `go-orchestrator/internal/{voice,knowledge,actions}`.

---

## A. What already exists (don't rebuild this)

| Capability | Where |
|---|---|
| Worker → orchestrator over `/v1/agent/*` (workload JWT) | `services/orchestrator_client.py` |
| 18 tools: reads (items, stock, sales, orders, customers, receivables, KB) + guarded writes (order/payment/customer/item) | `agent.py` `@function_tool` |
| Durable **write confirmation** (prepare → confirm) | `/v1/agent/tool-actions*`, `internal/actions` |
| **Org KB "voice-brief"** injected into instructions (ETag + `kb_generation`) | `client.voice_brief()` → `/v1/agent/kb/voice-brief` |
| **Conversation memory** (last 5 turns, 24h TTL) in Redis | `services/memory.py` → `voice_memory:{tenant}:{session}` |
| **KB-change reconciliation** — worker refreshes the brief when the tenant KB generation bumps | `KBUpdateWatcher` ↔ orchestrator `MirrorGeneration` → `kb:generation:<tenant>` |
| **Shared Redis** — worker `REDIS_URL` and orchestrator `RedisURL` both default to `redis://redis-cache:6379/2` | `services/config.py`, `internal/config/config.go` |
| Tool telemetry stream + session heartbeats/end | `memory.log_tool_telemetry`, `/v1/agent/sessions/*` |

So the "shared Redis KB between worker and orchestrator" the request asks for **is already the pattern** —
it just needs (1) a durable home and (2) richer, caller-level context.

## B. The real gaps for "contextual responses"

1. **Context is org-level + session-level, never *caller*-level.** The brief is org KB; memory is the last
   5 turns of *this* call. The agent does **not** know *who* is calling or their history at "hello."
2. **Shared context lives on a volatile cache Redis.** `redis-cache` runs
   `--maxmemory 128mb --maxmemory-policy allkeys-lru --save "" --appendonly no` — LRU-evicting and
   non-persistent. `voice_memory:*`, `kb:generation:*`, and any context can be **silently evicted**,
   breaking continuity mid-day.
3. **No cross-channel continuity.** A voice call can't see the customer's open Chatwoot conversation or a
   GenUI action from minutes ago — the systems are unified elsewhere but not in the voice context.

## C. Suggestions — the shared context layer (Redis)

### C1. Give shared context a durable home (small, do first)
Point context at a **non-evicting** Redis DB (own instance or `platform-redis`) with AOF; keep the volatile
`redis-cache` for Frappe only. E.g. `REDIS_URL=redis://platform-redis:6379/3` for both worker and
orchestrator context, `noeviction` policy. Rationale: memory/kb-generation must not be evicted.

### C2. Customer Context Cache (the big win)
Orchestrator maintains, per customer, a compact JSON the worker reads at call start:
```
ctx:customer:{tenant}:{customer_id}  →  {
  name, phone, language, tier,
  recent_orders:[…], open_receivables, last_invoice,
  open_support:[{chatwoot_conversation_id, subject, status}],   # via Chatwoot MCP
  preferences, last_interaction:{channel, when, summary}
}   # TTL ~1h, event-refreshed
```
- **Populated by the orchestrator** from ERP (orders/receivables) + Chatwoot MCP (open tickets) + recent activity.
- **Read by the worker** via a new endpoint `GET /v1/agent/context/customer?phone=…` (or by key) → preloaded
  into instructions → the agent **greets by name and knows history**.

### C3. Unified Session Context
Seed a single object at session mint (`POST /v1/kb/voice/session`) and let both sides read/write it:
```
ctx:session:{tenant}:{session}  →  { caller_identity, entry_channel, intent_hint, customer_id, transcript_ref }
```
This links the call to a customer up front (not just a random session id) and carries intent from the channel
that initiated the call.

### C4. Cross-channel continuity + event freshness
- Key context by **customer**, not only session → a voice call continues a Chatwoot chat / GenUI action.
- Extend the existing `kb:generation` reconciliation into a small **pub/sub** `ctx:events:{tenant}`
  (ERP doc events + Chatwoot webhooks) so the worker can invalidate/refresh a customer's context **mid-call**.

### C5. Semantic recall (later)
Store embeddings of prior interaction summaries (Vertex/pgvector) keyed by customer; `search_knowledge_base`
/ retrieve can surface *prior-conversation* snippets, not just org KB — true continuity.

## D. Voice functionality improvements

1. **Caller identification & greeting** — resolve `phone → customer` at call start (new
   `get_caller_context` tool reading C2); greet by name; preload recent orders/receivables during the
   greeting so answers are instant.
2. **Grounding / anti-hallucination** — instruction: never guess ERP facts; say "let me check" and call a
   tool. For KB answers, cite the source doc (the brief/retrieve already returns sources).
3. **Confirmation read-back** — for the prepare→confirm writes, have the agent read back the parsed action
   ("create an order for Acme, 3× Widget — confirm?") and speak a short reference id.
4. **Latency & turn-taking** — tune barge-in; stream a filler ("one moment…") while a tool runs; prefetch
   likely data. Gemini Live already streams — exploit tool-call overlap.
5. **Multilingual** — detect caller language and respond in kind (KB already ships a banglish dictionary);
   store `language` in the customer context for next time.
6. **Human handoff** — a `handoff_to_human` tool that (via orchestrator → Chatwoot MCP) opens/updates a
   Chatwoot conversation with the **call summary + context**, closing the loop with support (ties to the
   unified-experience plan).
7. **Resilience** — bounded orchestrator timeouts + one retry on transient tool failures; a spoken graceful
   fallback ("I'm having trouble reaching the system, let me take a message"); alert on the telemetry stream.
8. **Post-call write-back** — persist the call transcript + tool trace + a 1-line summary into the customer
   context (C2) and (optionally) a Chatwoot note, so the *next* interaction (any channel) has continuity.

## E. Suggested order (small → high-leverage)

1. **C1** move shared context off the evicting cache Redis (config + compose) — 1 change, removes silent data loss.
2. **C2 + D1** customer-context writer in the orchestrator + `get_caller_context` tool + greet-by-name.
3. **C4** customer-keyed context + `ctx:events` invalidation reusing the `kb:generation` pattern.
4. **D6** Chatwoot handoff tool; **D8** post-call write-back — cross-channel continuity.
5. **C5 / D5** semantic recall + multilingual polish.

> Net effect: the worker keeps its clean `/v1/agent/*` boundary; the orchestrator owns a **shared,
> durable, caller-level context** in Redis that it composes from ERP + Chatwoot + history — so the voice
> agent answers *"Hi Amina, your last order #SO-142 shipped; the overdue invoice is ₹12,400 — want to pay it?"*
> instead of a cold, context-free prompt.
