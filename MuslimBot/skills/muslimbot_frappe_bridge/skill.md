---
name: muslimbot_frappe_bridge
description: How to extend MuslimBot's AI to manage additional Frappe products (Helpdesk, CMS/Blog, HRMS) by exposing their Doctypes as agent tools through the Go orchestrator. Use for the blueprint's "Master Controller" scenarios (auto-publish blog, escalate ticket SLA, approve leave).
---

# Frappe ecosystem bridge (Master Controller)

The blueprint shows tools hitting a generic `${GO_GATEWAY}/api/frappe/insert/<Doctype>`. **That generic
bridge does not exist yet** — `routeFrappe` today only calls curated `small_erp.api.*` methods. Two ways
to close the gap; prefer curated methods for anything high-stakes.

## Option A (preferred) — curated service methods
For each new capability (e.g. escalate ticket, publish blog, approve leave):
1. Add a whitelisted `small_erp.api.<helpdesk|cms|hr>.<fn>` route → delegates to `services/`. Guard with
   `frappe.has_permission(<Doctype>, throw=True)`. This is where policy/SLA/validation lives.
2. Register it as a catalog tool per `muslimbot_add_agent_tool` (`routeFrappe`, `Method="small_erp.api...."`).
Pros: permission-checked, testable, one audit trail, matches repo rules (logic in services/).

## Option B — guarded generic resource proxy (only if truly needed)
Add an orchestrator handler `POST /v1/frappe/:op/:doctype` (`insert|update`) that proxies to Frappe REST
`/api/resource/<Doctype>` via `internal/gateway/proxy.go` (reuses token masking). **Must** enforce a
Doctype allowlist + tenant scoping + write-confirm; never a blanket passthrough. Higher blast radius —
document why curated methods weren't enough.

## Target Doctypes for the blueprint scenarios
- Helpdesk: `HD Ticket` (priority, assignment, SLA) — Scenario C (VIP escalation).
- CMS: `Blog Post` (title/content/route, published) — Scenario A (auto-SEO blog from ERP trends).
- HRMS: `Leave Application` (approve/reject, balance check) — Scenario B (WhatsApp leave approval).
These apps must be installed on the Frappe site first (`bench get-app` / `install-app`); that install is
the **user's** action, not code.

## Autonomy lives in n8n, not here
The "AI notices a sales spike and publishes a blog" loop is an **n8n workflow** (cron → ERP query →
LLM draft → call the tool). See `muslimbot_n8n_automation` and `configs/n8n/`. The orchestrator just
exposes the tool; n8n (or the brain) decides when to call it.

## Verify
`go test ./...`; live: create a throwaway `HD Ticket`/`Blog Post` in a dev site via the new tool with
`confirm:true`, confirm in Frappe, then delete the test record.
