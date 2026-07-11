# erp-flutter — Rebuild Plan: **MuslimBot**, the Native Super-App for the Frappe Ecosystem

> Status: **PLAN — awaiting approval before build.**
> Revision 3 — scope expanded to the **full Frappe framework + all Frappe products**, three personas (owner / employee / customer), MuslimBot as the operating brain, and **maximum leverage of existing open-source**.
>
> **North star:** Owners, employees, and customers operate the *entire* Frappe/ERPNext system — **View, Adjust, and Serve every function** — from a native mobile app, **without ever touching the ERPNext web desk**. MuslimBot (voice + chat + generative UI) is the AI layer that drives it: it reads inventory, answers customers, takes orders, and updates the ERP on request.

---

## 1. Vision & the core problem

The Frappe framework renders **any DocType** (list, form, report, workspace) from server-side metadata — that's how ERPNext, Frappe HR, CRM, Helpdesk, Books, etc. all work from one engine. The web desk is powerful but **desktop-shaped and overwhelming** for mobile users.

We rebuild `erp-flutter` as a **metadata-driven native client** that reproduces that "render anything" power on mobile, adds **bespoke UX for the flows people use most**, and lets **MuslimBot operate all of it** by voice or chat. WebView is the safety net for the last mile only.

**We do not build 200 screens by hand.** We lean on the same trick Frappe uses (metadata) plus mature open-source, and reserve hand-crafting for where it matters.

---

## 2. Open-source leverage (the build-vs-adopt decisions)

| Need | Adopt (OSS) | Notes / license |
|---|---|---|
| **Generic "render any DocType" engine** | **`frappe_mobile_sdk`** v1.2.0 | MIT. Metadata → native forms (20+ field types, Link, Child Table), **workflows**, **role/doc permissions**, **offline SQLite 2-way sync**, ready screens (`FormScreen`, `DocumentListScreen`, `DoctypeListScreen`), multi-auth (password/OTP/API-key/**OAuth2-PKCE**/social). ⚠️ needs companion server app `frappe_mobile_control` (`/api/v2/method/mobile_auth.*`). |
| **Low-level Frappe REST/metadata** | `frappe_dart` / `frappe_sdk` | Fallback if we build our own engine instead of the SDK. |
| **Voice (WebRTC)** | `livekit_client` | Connects to existing MuslimBot voice worker via KB BFF `/voice/session`. |
| **Reference (do NOT base on)** | `frappe/mobile` | Official but **deprecated/archived 2022**. Patterns only. |
| **Server companion** | `frappe-mobile-control` (dhwani-ris) | Bake into the liteERP image like `small_erp` (we control the deployment). |

**Recommendation:** **Adopt `frappe_mobile_sdk` as the generic tier** (Tier 2 below) — it delivers "View/Adjust/Serve any Frappe function" for a fraction of the effort — and install its companion app into our Frappe image. If installing the companion is undesirable, the fallback is to build the engine ourselves on `frappe_dart` + Frappe's native metadata APIs (`frappe.desk.form.load.getdoctype`, `frappe.client.get_list`, `frappe.model.meta`). This is **Decision #1** (see §9).

---

## 3. Architecture — three rendering tiers, one MuslimBot brain

```
                         ┌───────────────── MuslimBot (AI brain) ─────────────────┐
                         │  voice(LiveKit) · chat · generative-UI · 21-tool catalog │
                         │  can OPEN / FILL / SUBMIT any doctype, take orders,      │
                         │  answer customers (RAG), trigger workflows              │
                         └───────────────┬─────────────┬─────────────┬────────────┘
                                         ▼             ▼             ▼
          ┌──────────────── Persona-aware App Shell (owner/employee/customer) ────────────────┐
          │                                                                                   │
          │  TIER 1  Bespoke native            TIER 2  Metadata-generic        TIER 3  WebView │
          │  hot, persona flows                any DocType, any product        last mile        │
          │  • Owner cockpit/KPIs              (frappe_mobile_sdk)              • reports/print  │
          │  • Order-taking / POS              • list → form (20+ fields)       • desk-only     │
          │  • Customer support desk           • workflows, child tables         features       │
          │  • Customer self-service            • role & doc permissions        • graceful      │
          │    (order, track, tickets)         • offline sync (SQLite)            fallback      │
          └───────────────────────────────────────────────────────────────────────────────────┘
                  All permissions enforced server-side by Frappe · tenant-scoped · SSO
```

**Coverage principle:** every Frappe function is reachable — Tier 1 for delight, Tier 2 for completeness (this is what makes "operate the *whole* system" true), Tier 3 so nothing is ever a dead end.

### Frappe product coverage matrix (illustrative)
| Product | Tier 1 (bespoke) | Tier 2 (generic) | Tier 3 (webview) |
|---|---|---|---|
| ERPNext (Selling/Stock/Accounts) | POS, order-taking, KPIs, receivables | all other doctypes | print formats, financial reports |
| Frappe Helpdesk | customer support desk & ticket reply | Ticket/Agent doctypes | SLA dashboards |
| Frappe CRM | lead capture quick-add | Lead/Deal/Contact | Kanban boards |
| Frappe HR | (employee self-service: leave/attendance) | all HR doctypes | org charts, reports |
| Others (Books/Insights/LMS…) | — | generic doctype access | full product UI |

---

## 4. Personas (who operates what)

| Persona | Auth | Home / default tier | Superpowers |
|---|---|---|---|
| **Owner** | staff login (password/OAuth) | Owner cockpit (Tier 1) + full generic access (Tier 2) | MuslimBot full 21-tool catalog, all workspaces, approvals, configure |
| **Employee** | staff login, role-scoped | Role home (e.g. sales → order-taking; support → helpdesk) | MuslimBot scoped to permitted tools; Tier 2 limited by Frappe perms |
| **Customer** | **Website/portal user** (OAuth/OTP) | Customer self-service (Tier 1): browse catalog, place & track orders, raise support tickets | MuslimBot in "support & ordering" mode (RAG + order tools only); no desk |

Roles/permissions are **enforced by Frappe server-side**; `frappe_mobile_sdk`'s `PermissionService` mirrors them in the UI. Persona only changes *presentation & default surface*, never trust boundaries.

---

## 5. MuslimBot integration (unchanged core from Rev 2, now driving all tiers)

Persona (`agent.py`): *"You are Muslimbot…"* — concise, **confirm writes**, **₹**, **Asia/Dhaka**, **en/bn**. Three brains behind one FAB (tap=text, hold=voice):
- **Structured router** → `UiDescriptor` (metrics/chart/table/card/action/flow/navigate) using the **21-tool catalog** (`search_items…create_order…add_stock…trigger_workflow…`).
- **KB RAG** (`/v1/kb/chat`) → cited answers; powers **customer support** ("what's your return policy?", "is X in stock?").
- **Voice** (`/v1/kb/voice/session` → LiveKit) → hands-free operation running the same tools.
- **Agentic doctype control (new):** MuslimBot can emit a `navigate`/`open_doc` intent that launches a **Tier-2 generic form pre-filled** with its `actionParams` — e.g. "create a Purchase Order for supplier X" opens the native PO form ready to review & submit. This is how the AI "operates the whole ERP."

⚠️ **Shared structured endpoint gap (from Rev 2, still true):** the structured schema is produced client-side today; recommend promoting it to `POST /v1/ai/generate-ui` on the orchestrator so voice/web/Flutter share one server brain. Fallback: Dart `google_generative_ai`.

---

## 6. Target structure

```
lib/
├── main.dart · app/(shell,router,bootstrap,persona_gate)
├── core/
│   ├── frappe_engine/     ← Tier 2: frappe_mobile_sdk integration (adapters, config, sync)
│   ├── network/ auth/ config/ (tenant, orchestrator base, workspace URLs)
│   ├── muslimbot/         persona · tool_catalog(21) · intent_router · kb_client · voice_client · portal_client
│   ├── models/ theme/(light+dark, intl en/bn, ₹)
├── generative/            descriptor_renderer + widgets (metrics/chart/table/card/action/flow/navigate/rag)
├── features/
│   ├── owner/             cockpit, approvals, KPIs
│   ├── employee/          role homes (sales order-taking/POS, support desk)
│   ├── customer/          catalog, place/track order, support tickets, self-service
│   ├── assistant/         MuslimBot FAB · text sheet · voice UI · transcript
│   ├── knowledge/         KB hub (RAG chat + sources) — supports customer support
│   ├── doctype/           thin wrappers over frappe_mobile_sdk screens (list/form/workspace picker)
│   └── portal/            Tier 3 WebView + cookie/SSO + JS bridge
└── shared/                loaders, states, formatters
```

**State:** keep **Provider** (matches both the existing app *and* `frappe_mobile_sdk`, minimizing integration friction). The SDK manages its own internal state for generic screens; our app state stays thin and consistent. *(This reverses Rev 2's Riverpod suggestion specifically to reduce SDK friction — Decision #2.)*

---

## 7. Dependencies (deltas)
Adopt: `frappe_mobile_sdk`, `livekit_client`, `permission_handler`, `webview_flutter`(+platform), `webview_cookie_manager`, `fl_chart`, `flutter_markdown`, `file_picker`, `intl`, `flutter_secure_storage`. The SDK already pulls `sqflite`, `flutter_form_builder`, `connectivity_plus`, `provider`, `geolocator`, `image_picker`, `app_links`. Dev-only `google_generative_ai` (router fallback).

Server side: install **`frappe_mobile_control`** into the liteERP Frappe image (new Dockerfile layer, like `small_erp`).

---

## 8. Delivery phases (each gated on `flutter analyze` clean + `flutter test`)

- **P0 Foundation** — deps, config/env (tenant, orchestrator, workspace URLs), theme (light+dark) + intl(en/bn/₹), Provider scaffold, MuslimBot `persona.dart` + `tool_catalog.dart`, models, error taxonomy.
- **P1 Auth + Persona shell + WebView(Tier 3)** — multi-auth (password/OAuth/OTP via SDK), `persona_gate` (owner/employee/customer routing), app shell + nav, WebViewPage + portal SSO + JS bridge. *Verify:* each persona logs in and lands on its home; `/ops` embeds authenticated.
- **P2 Generic engine (Tier 2)** — integrate `frappe_mobile_sdk`: doctype picker → list → metadata form → save/submit/workflow; permission-aware; offline sync on. *Verify:* open an arbitrary doctype (e.g. Purchase Order), create + submit natively. **← this is the "operate the whole ERP" milestone.**
- **P3 MuslimBot assistant (text) + renderer + agentic doctype control** — FAB, intent router, generative widgets, `action` confirm→tool-call, and `open_doc` → prefilled Tier-2 form. *Verify:* "today's sales" → metrics; "create customer X" → confirm+write; "new purchase order for X" → prefilled native form.
- **P4 Voice + KB + customer support** — LiveKit voice; KB RAG chat + sources; customer support desk (Helpdesk tickets) + self-service ordering. *Verify:* voice connects & speaks; customer places an order and raises a ticket end-to-end.
- **P5 Bespoke Tier-1 flows** — owner cockpit, sales order-taking/POS, employee role homes, customer catalog/track. Polish, offline, deep links.
- **P6 Hardening** — unit tests (router parsing, tool-param mapping, permission gating), widget/golden tests, a11y, docs, per-persona smoke checklists.

**Parallel backend tasks:** (a) install `frappe_mobile_control`; (b) recommended `POST /v1/ai/generate-ui` shared endpoint.

---

## 9. Decisions to confirm (before build)
1. **Generic engine:** adopt **`frappe_mobile_sdk`** + install companion `frappe_mobile_control` on the Frappe image *(recommended)* — or build our own engine on `frappe_dart`/metadata APIs (no server companion, more effort)?
2. **State management:** standardize on **Provider** to match the SDK *(recommended)* — or keep Riverpod and isolate the SDK behind adapters?
3. **Customer persona auth:** use Frappe **Website/portal users** (OAuth/OTP) *(recommended)* — confirm customers are portal users, not desk users.
4. **Shared AI endpoint:** add `/v1/ai/generate-ui` now, or ship P3 on the Dart Gemini fallback and add later?
5. **Voice in first cut:** in-scope at P4 (needs `LIVEKIT_*` configured) or stub behind text until infra ready?

---

## 10. Verification & handoff (this environment)
- Every phase: `flutter analyze` (0 issues) + `flutter test`; fixture-based unit tests for router/tool mapping and permission gating (no live backend needed).
- **Not reachable here:** live Frappe (metadata/SDK), `frappe_mobile_control`, LiveKit, orchestrator/KB. Runtime for Tier-2 forms, voice, RAG, SSO is verified by you against a running stack; I provide per-phase, per-persona smoke checklists.

---

## 11. Out of scope for v1
Push notifications (design for; ship later) · offline write-queue beyond SDK's built-in sync · native re-implementations of full product UIs (Insights/LMS/Drive stay Tier-2/Tier-3) · payment-gateway integration for customer checkout (defer to ERPNext/WebView).

---

## Appendix — sources
- frappe_mobile_sdk — https://pub.dev/packages/frappe_mobile_sdk
- frappe_mobile_control (companion) — https://github.com/dhwani-ris/frappe-mobile-control
- frappe_dart — https://pub.dev/packages/frappe_dart · frappe_sdk — https://pub.dev/packages/frappe_sdk
- frappe/mobile (deprecated reference) — https://github.com/frappe/mobile
- FOSS United talk (metadata-driven Frappe Flutter SDK) — https://fossunited.org/c/indiafoss/2026/cfp/dmsksuju3d
