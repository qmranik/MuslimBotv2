# Context-Engineered Prompt — E2E Deploy + Browser-Automation Onboarding & Test

Paste the block below into an autonomous agent that has **gcloud + terraform + SSH** access and a
**browser-automation** tool (Claude-in-Chrome / Playwright / a browser MCP). It provisions the VM,
installs the updated MuslimBot, then **onboards a realistic business entirely through the UI**,
navigates every screen, seeds realistic data, audits UX/functionality, and returns a test report.

> Deploy phases delegate to [`../production/AGENT_DEPLOYMENT_GUIDE.md`](../production/AGENT_DEPLOYMENT_GUIDE.md)
> (Phases 0–15) — this prompt adds the **UI onboarding + realistic seed + analysis** layer on top.

---

```text
# ROLE
You are a Senior Deployment + QA/UX engineer. You will (1) stand up MuslimBot on a fresh GCP VM
via Terraform, (2) install/verify the updated unified system, (3) onboard a realistic SMB through
the BROWSER UI, navigating every screen and seeding believable data, and (4) return an evidence-based
analysis + test report with UX feedback, suggestions, and improvements. You execute, observe, and
prove — never claim a step passed without a screenshot or command output.

# GROUND TRUTH
- Repo root on the VM: /opt/muslimbot/repo/MuslimBot. Root orchestrator: ./setup.sh.
- Canonical deploy runbook: docs/production/AGENT_DEPLOYMENT_GUIDE.md (Phases 1–15). Follow its
  phases for provisioning/install; DO NOT re-derive them.
- Hostnames (nip.io by default; `chat.`/`workflow.`/`app.` are STALE — never use them):
    ui.<D>=generative-ui (the pane) · api.<D>=orchestrator /v1/* · auth.<D>=Authentik ·
    erp.<D>=ERPNext /ops (no ForwardAuth) · builder.<D>=Frappe Builder · chatwoot.<D>=Chatwoot ·
    social.<D>=TryPost · n8n.<D>=n8n.   <D> = PUBLIC_DOMAIN from /opt/muslimbot/secrets/muslimbot.env.
- The env-file /opt/muslimbot/secrets/muslimbot.env (0600) is the config. Never print its values.
- The unified experience = ONE Authentik login → GenUI pane → orchestrator MCP host drives ERP,
  Chatwoot (mcp-chatwoot), TryPost (MCP), n8n. Verify this, don't assume it.

# HARD RULES
1. SECRETS/CREDENTIALS: never type a password into a login field on the user's behalf, and never
   invent one. When a human account needs a password, set it via the admin/API path (Authentik
   admin, `bench add-user`) and record WHICH secret it is — not the value — for the handoff.
2. BILLABLE/DESTRUCTIVE (terraform apply/destroy, restore): confirm before running. NEVER
   `docker compose down -v` (destroys data).
3. SYNTHETIC DATA ONLY: use the fictional business/persons in §DATASET. No real personal data.
   Do not connect real social/OAuth or send real messages to real people.
4. EVIDENCE: every screen visited → a screenshot + a one-line PASS/FAIL/NOTE. Every agentic claim
   (MCP tool call) → the request/response proving a real round-trip, not a hallucinated answer.
5. IDEMPOTENT + IN-ORDER: run phases in order; each has a Verify gate. Re-running is safe.

# PHASE A — Provision + install (mostly CLI; per AGENT_DEPLOYMENT_GUIDE)
A1. Workstation: `./setup.sh preflight` → `./setup.sh provision` (CONFIRM the terraform apply) →
    `./setup.sh deploy`. Note instance IP/name/zone and PUBLIC_DOMAIN=<IP>.nip.io.
A2. SSH to the VM. Finish the env-file (Guide Phase 3): ENV=production, AUTH_LOCAL_BYPASS=false,
    GEMINI_API_KEY (+GOOGLE/VITE), NEXT_PUBLIC_AUTHENTIK_URL, *_MCP_ENABLED=true.
A3. `./setup.sh stack` → `./setup.sh init`. Ensure the mcp-chatwoot submodule + bind-mount exist.
A4. Complete Guide Phases 6–12: Frappe API keys, Builder app, Authentik OIDC+outpost, Chatwoot +
    TryPost API tokens, n8n workflow import, then restart and confirm the MCP layer.
✅ Gate: `curl -sk https://api.$D/v1/sys/health` = green; `dc ps` all healthy; `/v1/mcp/servers`
    shows trypost + chatwoot `connected:true`. If any fails, use the Guide's Troubleshooting map.

# PHASE B — Onboard the business through the UI (browser automation — the core)
Persona/data = §DATASET. For EVERY screen: navigate, screenshot, verify it renders + works, then
record UX findings (below). Seed data through the UI where the UI supports it; use the API only
when the UI cannot.

B1. IDENTITY & FIRST LOGIN
  - As Authentik admin (recovery link if needed), create user `amina@<D>` "Amina Rahman", add to the
    platform application group. Create the ERP business user (Guide Phase 14: `bench add-user` +
    "SMB Manager" role) `amina.manager@barakah.local`.
  - Browser: open https://ui.$D → confirm redirect to Authentik → complete login as amina@<D> →
    GenUI workspace loads. Screenshot the SSO redirect and the landed dashboard.
B2. GENERATIVE-UI PANE — visit and exercise EACH surface:
  - Dashboard / Command Center (KPI cards, activity). Nav to each SecurePortal: Support, Social,
    Workflows, Website — confirm each embeds WITHOUT a second login (screenshot; check console for
    X-Frame-Options errors).
  - Knowledge Base: upload §DATASET.kb_docs (return policy, product FAQ). Confirm ingest.
  - Agent chat (FAB → Agent mode): run the §AGENT_TESTS prompts; capture each tool round-trip.
B3. ERP /ops (https://erp.$D/ops as amina.manager) — complete the operational onboarding by CREATING
  data through the screens:
  - Settings → set Company profile (name, address, currency) per §DATASET.company.
  - Inventory → add each item in §DATASET.items (name, group, rate) + opening stock.
  - Customers → add each customer in §DATASET.customers.
  - POS → ring up §DATASET.pos_sale (add items, checkout, take payment).
  - Orders → create an invoice for a customer, then record a partial payment.
  - Accounting → verify P&L / receivables reflect the above.
B4. CHATWOOT (support): create the "Website" inbox + agent; post the inbound conversation in
  §DATASET.support (customer asking about stock). Reply as agent.
B5. TryPost (social): create workspace "Barakah"; via the GenUI agent (B2/AGENT_TESTS) draft +
  schedule §DATASET.posts; confirm drafts appear in social.$D. Publish only with an explicit
  confirm step (or leave pending if no real network is connected).
B6. n8n: trigger a cross-system loop — create/submit an invoice in /ops and confirm the `erp-events`
  execution appears in n8n; send a new Chatwoot message and confirm the support-RAG workflow fires.
B7. Builder: publish 2 blog posts (§DATASET.blog); confirm they render at their routes.

# PHASE C — Unified-experience assertions (prove it's not silos)
For each, capture the exchange:
  C1. ONE login spans ui → erp → chatwoot → social → n8n with no re-auth.
  C2. Agent: "Summarize open support conversations" → real Chatwoot MCP call returns §DATASET.support.
  C3. Agent: "Draft 3 posts about our new prayer mats for next week" → real TryPost MCP call; drafts
      appear in social.$D; nothing publishes without confirm.
  C4. Agent: "What's our return policy?" → grounded answer citing the uploaded KB doc (not a guess).
  C5. Agent ERP write (e.g. "create a customer …") → prepare→confirm flow; only writes after confirm.
  C6. Security: `curl -sk -H "X-authentik-email: attacker@evil" https://api.$D/v1/auth/me` → NOT 200.

# PHASE D — Analysis, feedback & test report (the deliverable)
Return ONE markdown report:
  1. Environment: IP, domain, image/commit, `dc ps` summary, /v1/mcp/servers output.
  2. Results table: every Phase A–C step → PASS/FAIL/SKIP + evidence pointer (screenshot/curl).
  3. UX & functional audit: per screen visited, findings tagged [BUG]/[UX]/[PERF]/[COPY]/[A11Y] with
     severity (S1 blocker … S4 polish), a concrete repro, and a suggested fix. Prioritize the top 10.
  4. Seeded-data inventory: the exact company/items/customers/invoices/conversations/posts created,
     so the demo is reproducible.
  5. Improvement suggestions: 5–10 highest-leverage product/architecture improvements observed.
  6. Go/No-go vs the AGENT_DEPLOYMENT_GUIDE Phase-15 checklist, and the credentials handoff table
     (which env keys / which accounts — values delivered out-of-band, never in the report).
  7. Defects filed as a crisp list an engineer can act on without you.

# DATASET (fictional — use verbatim for a consistent, believable demo)
- company: "Barakah Home & Prayer Essentials", currency PKR, city Lahore, owner "Amina Rahman".
- users: amina@<D> (Owner/Manager, GenUI+Authentik), amina.manager@barakah.local (ERP /ops SMB Manager),
  a Chatwoot agent "Bilal Khan".
- items (name · group · rate PKR · opening qty): "Classic Prayer Mat"·Prayer·2500·40;
  "Premium Velvet Prayer Mat"·Prayer·4800·20; "Digital Tasbih"·Accessories·1200·60;
  "Attar Gift Set"·Gifts·3500·25; "Wall Frame Ayat"·Decor·2200·30.
- customers: "Ayesha Rahman" (ayesha@example.com, +9203001234567), "Yusuf Traders" (wholesale),
  "Fatima Store" (retail), "Hamza Ali".
- pos_sale: Ayesha buys 1× Classic Prayer Mat + 1× Digital Tasbih, pays cash.
- invoice: Yusuf Traders — 10× Premium Velvet Prayer Mat, record 50% advance payment.
- support: inbound from Ayesha — "Salam — do you have the Classic Prayer Mat in stock? I need 3 for
  Friday." Agent Bilal replies with stock + delivery.
- posts: 3 drafts — (1) "New arrival: Premium Velvet Prayer Mats 🕌", (2) "Ramadan gift sets now in",
  (3) "Digital Tasbih — 20% off this week". Schedule across next week; do not publish live.
- blog: "Welcome to Barakah Home & Prayer Essentials", "This Ramadan's featured collection".
- kb_docs: a 1-page Return Policy (7-day returns, unused, receipt) and a Product FAQ (materials,
  care, delivery areas).

# AGENT_TESTS (run in GenUI agent chat; each must show a real tool round-trip)
1. "What tools can you use?"                         → mcp_list_tools (chatwoot + trypost)
2. "How many open support conversations are there?"  → chatwoot MCP
3. "Draft & schedule 3 posts about our new prayer mats for next week" → trypost MCP (no publish)
4. "What's our return policy?"                       → KB-grounded answer with source
5. "Create a customer named Hamza Ali, phone 03007654321" → prepare→confirm ERP write
```

---

## Notes for whoever runs this

- **nip.io caveat:** self-signed TLS breaks third-party cookies inside iframes, so the embedded-portal
  UX (B2) may loop to a sub-login. For a faithful embed test, deploy with a real domain + ACME
  (Guide Phase 4 Path B) before Phase B.
- **Browser tool:** any of Claude-in-Chrome, Playwright, or a browser MCP works; the prompt only needs
  navigate / screenshot / read DOM / fill / click / read console+network.
- **Scope control:** if you only want the *test* (stack already deployed), start at Phase B and point
  `<D>` at the live host.
