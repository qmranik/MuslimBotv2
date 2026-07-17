---
name: muslimbot_n8n_automation
description: How MuslimBot's background/asynchronous automation works via n8n (omnichannel routing, autonomous social posting, scheduled jobs) and how to add a new workflow. Use for Chatwoot→AI routing, Postiz auto-posting, cron-driven ERP→content, and any "when X happens, the AI should do Y in the background" ask.
---

# n8n background automation (Plane A)

Interactive Gen-UI is the brain; **n8n is the background orchestrator** for async work: omnichannel
(WhatsApp/Chatwoot), scheduled jobs, and autonomous multi-step flows. Read `muslimbot_architecture` first.

## How the repo talks to n8n
- Internal host `http://n8n:5678` (`http://localhost:5678` from host). Version pinned **n8nio/n8n:1.64.3** —
  verify any "instance-level MCP / v2.2+" feature against this before designing on it.
- Frappe → n8n: `events.py:_notify_n8n()` is fire-and-forget (2s). `ai_agent.py` calls use 30s + structured
  error dicts. n8n → Frappe: `Authorization: token <FRAPPE_API_KEY>:<FRAPPE_API_SECRET>`.
- Orchestrator → n8n: catalog tools with `routeN8N` (`ask_business_ai`, `trigger_workflow`, `send_notification`)
  go through `internal/ai/kb.go`/`clients.go` (N8NClient) and `POST /v1/workflows/trigger`.
- Workflows are JSON in `configs/n8n/` (e.g. `workflow-ai-assistant.json`, `workflow-erp-events.json`),
  imported into n8n. Adding automation usually means **a new workflow JSON**, not Go/Python code.

## Blueprint flows → where they live
- **Missed-call → order** (Twilio/SIP → voice agent → n8n → Sales Order → WhatsApp receipt): voice in
  `agent.py`; the order+receipt fan-out is an n8n workflow. SIP/PSTN is WS-2 (user-run infra).
- **Omnichannel support + smart handoff**: Chatwoot webhook → n8n AI Agent node → ERP stock tool →
  reply, or assign to human on negative sentiment. New workflow in `configs/n8n/`.
- **Autonomous social** (cron → top sellers from ERP → LLM copy → Postiz queue): n8n cron workflow calling
  `small_erp.api.dashboard.*` then the Postiz API. Postiz is an embedded portal (SSO bridge), not code here.
- **Master-Controller autonomy** (sales spike → auto-publish blog; VIP → escalate ticket): n8n decides
  *when*; the *capability* is a catalog tool (`muslimbot_frappe_bridge`).

## To add a workflow
1. Build/export it as JSON into `configs/n8n/` with a descriptive name.
2. If it calls a new ERP capability, add the tool/method first (`muslimbot_add_agent_tool`).
3. Document the trigger (webhook path or cron) and required env in the workflow's README/notes.
4. Importing/activating the workflow in the running n8n instance is a **user action** (UI + live creds).

## Boundary
Claude authors workflow JSON, tools, and configs. The user imports/activates workflows, registers SIP
trunks, and runs anything that places live outbound calls/messages or costs money.
