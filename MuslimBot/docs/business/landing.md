# Muslimbot — The AI-Agentic ERP & Digital Workforce

> **Run your business on autopilot.** Muslimbot is an AI-agentic ERP that answers your
> customers across every channel, takes voice & text orders straight into your inventory,
> and writes & schedules your social media — a 24/7 autonomous digital workforce for
> Small & Medium Enterprises (SMEs), built entirely on open-source.

---

## Meta

- **Meta Title:** Run Your Business on Autopilot | Muslimbot AI-Agentic ERP
- **Meta Description:** Replace manual data entry, customer support, and social media posting with a 24/7 autonomous digital workforce connected directly to your inventory. Powered by ERPNext, n8n, Chatwoot, and Postiz — 100% open source.
- **Primary Keywords:** AI ERP, autonomous customer support, omnichannel AI agent, voice ordering, social media automation, open-source ERP, SME automation
- **Brand Voice:** Confident, practical, anti-busywork. We sell *outcomes*, not software.

---

## 1. Executive Summary

The era of "AI-assisted" software has ended. We are now in the era of **Agentic Operations**.

Muslimbot is a **headless, AI-agentic ERP** that acts as an **invisible digital workforce**
for SMEs (pharma, tech retail, wholesale, services). By decoupling the system of record
(ERPNext) from the interface, and replacing repetitive human workflows with autonomous AI
agents, Muslimbot:

- **Answers** customer queries across WhatsApp, Web Chat, Facebook, and Instagram — instantly.
- **Takes orders** by voice (phone) and text, injecting them directly into the ERP.
- **Manages** inventory, invoices, payments, and accounting without manual data entry.
- **Markets** your business by generating promotional copy + media and scheduling posts.

Everything runs on a **best-in-class open-source stack** orchestrated by n8n. No vendor
lock-in. No per-seat SaaS tax. Your data stays yours.

---

## 2. The Unified Business Context

### Who it's for

Small and medium businesses that lose hours every day to:
- Repetitive customer messages on WhatsApp / Instagram / Facebook
- Manually copying orders into inventory systems
- Chasing payments and reconciling invoices
- Struggling to stay consistent on social media

### The core idea

> Most ERPs make humans do the work *around* the software.
> Muslimbot makes AI agents do the work *inside* the software — humans just supervise.

### The "Digital Workforce" model

You don't buy software seats. You **hire digital employees**:

| Digital Employee | Replaces | Works |
|------------------|----------|-------|
| The Support Agent | Front-desk / chat reps | 24/7, every channel, every language |
| The Order Clerk | Data-entry staff | Voice + text, zero typos, instant |
| The Marketing Manager | Social media coordinator | Auto-writes & schedules content |
| The Analyst | Spreadsheet jockeys | Answers questions, builds dashboards on demand |

---

## 3. The Problems We Solve

| # | Problem (The Old Way) | Cost to the Business |
|---|------------------------|----------------------|
| 1 | Team spends ~60% of the day answering repetitive WhatsApp/IG messages | Burned payroll on low-value work |
| 2 | Orders are manually re-typed from chat/calls into the ERP | Errors, delays, lost sales |
| 3 | Inventory drifts out of sync with reality | Overselling, stockouts, angry customers |
| 4 | Customers wait hours (or overnight) for a reply | Missed sales, churn to faster competitors |
| 5 | Social media is inconsistent or abandoned | No top-of-funnel demand generation |
| 6 | Owners can't get a straight answer from their own data | Decisions made on gut, not numbers |
| 7 | SaaS tools are expensive, siloed, and own your data | High cost + vendor lock-in + privacy risk |

---

## 4. The Solutions (How Muslimbot Fixes It)

| # | Solution (The Agentic Way) | Outcome |
|---|-----------------------------|---------|
| 1 | AI support agent handles FAQs & stock checks across all channels | Free your team for high-value work |
| 2 | Voice & text orders are extracted and injected into the ERP automatically | Zero-touch fulfillment, no typos |
| 3 | Inventory deducts in real time on every order | Stock that's always accurate |
| 4 | Sub-second replies, 24/7, in any language | Never miss a sale again |
| 5 | AI watches your top sellers and auto-creates + schedules posts | Marketing that runs itself |
| 6 | Ask your data in plain English; get charts & answers on demand | Decisions grounded in real numbers |
| 7 | 100% open-source stack, self-hostable, per-tenant data isolation | Low cost, no lock-in, your data stays yours |

---

## 5. Core Architecture & Open-Source Tech Stack

A modular, "best-in-class" open-source architecture orchestrated by **n8n**.

```
                         Customers
   WhatsApp · Web Chat · Facebook · Instagram · Phone (Voice)
        │            │            │
        ▼            ▼            ▼
  ┌───────────┐  ┌──────────┐  ┌──────────────────┐
  │ Chatwoot  │  │  Postiz  │  │  Muslimbot Voice │
  │ (Omni     │  │ (Social  │  │  (LiveKit +      │
  │  Inbox)   │  │ Schedule)│  │   Gemini)        │
  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘
        │ webhooks    │ API            │ tools
        └─────────────┴────────┬───────┘
                               ▼
                        ┌──────────────┐
                        │     n8n      │  ◄── The Orchestration Engine
                        │ (LLM agents, │      (logic, routing, AI nodes)
                        │  routing,    │
                        │  webhooks)   │
                        └──────┬───────┘
                               │ REST API
                        ┌──────▼───────┐
                        │   ERPNext    │  ◄── System of Record
                        │  (Frappe)    │      Inventory · Orders · Accounting
                        └──────┬───────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                       ▼
  Frappe Builder        Generative UI            Open WebUI
  (Public website)   (Chat-to-dashboard)     (Admin control plane)
```

### The Components

| Layer | Open-Source Tool | Role |
|-------|------------------|------|
| **System of Record** | **ERPNext / Frappe** | Inventory, customers, sales orders, accounting. Serves headless data via REST. |
| **Orchestration Engine** | **n8n** | The central nervous system. Connects APIs, routes logic, hosts LLM/agent nodes. |
| **Omnichannel Support** | **Chatwoot** | Unified inbox. Ingests WhatsApp, Web Chat, Facebook, Instagram → forwards to AI via webhooks. |
| **Marketing Automation** | **Postiz** | Social scheduler. Receives AI-generated copy + media → publishes across channels. |
| **Voice Agent** | **Muslimbot** (LiveKit + Gemini 2.0 Flash) | Telephony-grade real-time AI. Handles calls, checks stock, places orders. |
| **Admin Interface** | **Generative UI** (Next.js + Vercel AI SDK) | Owners *chat* with their ERP data; charts & tables render dynamically. |
| **Public Website** | **Frappe Builder** | The digital storefront / brand site. |
| **Control Plane** | **Open WebUI** | The dashboard where you interact with the system & trigger agents. |

> **Why this matters:** Every tool is open-source and self-hostable. You can run the entire
> stack on a single VPS, keep all data in your own database, and never pay a per-seat fee.

---

## 6. Features — The Digital Workforce

### Feature 1 — The Omnichannel Support Agent
*(Powered by Chatwoot + n8n)*

**Zero Wait Times. Zero Missed Sales.**

Connect WhatsApp, Facebook, Instagram, and your website to a single Chatwoot inbox. The AI
agent instantly answers FAQs, checks live stock from ERPNext, and routes complex or
emotional issues to your human team.

- Unified inbox across every social channel
- Real-time stock & price answers pulled from ERPNext
- Knowledge-base (RAG) grounded responses — no hallucinated promises
- Sentiment detection → auto-escalates angry/complex chats to humans
- Multilingual out of the box

### Feature 2 — The Voice & Text Order Clerk
*(Powered by Muslimbot Voice + n8n)*

**Fulfillment on Autopilot.**

Whether a customer calls your phone or texts on Instagram, the AI extracts order details
(item, quantity, intent) and injects them straight into the ERP. Inventory is deducted,
invoices generated, and confirmations sent — instantly.

- Real-time WebRTC voice via LiveKit + Gemini 2.0 Flash
- **21 voice-callable ERP tools** (see Appendix A)
- Write actions confirm before executing (safe by default)
- Creates sales invoices, records payments, manages stock — hands-free
- Confirmation sent back via WhatsApp/SMS through Chatwoot

### Feature 3 — The Marketing Manager
*(Powered by Postiz + n8n + AI)*

**Marketing that runs itself.**

A scheduled n8n job fetches your top-selling items, an AI agent writes engaging promo copy +
generates an image prompt, and the content is queued into Postiz for publication across X,
Instagram, and LinkedIn.

- Auto-discovers best-sellers from ERPNext sales data
- AI-generated copy, hashtags, and image prompts
- Scheduled publishing via Postiz (X, Instagram, LinkedIn, Facebook)
- Runs on a cron cadence (e.g., every Monday & Thursday)
- Human approval step available before anything goes live

### Feature 4 — The Generative CEO Dashboard
*(Powered by Generative UI + Open WebUI)*

**Talk to your business data.**

Skip clunky spreadsheets. Type *"Show me today's low-stock items"* and the Generative UI
builds a custom dashboard on the fly. Ask *"Why did revenue drop this week?"* and get an
answer grounded in your real ERP data.

- Natural-language queries → live React charts & tables
- Backed by real ERPNext snapshots (no fake data)
- Quick-action prompts for common questions
- Open WebUI control plane to orchestrate agents

---

## 7. Autonomous Workflows

### Workflow A — Omnichannel Customer Support & Routing

1. **Ingestion** — Customer messages your brand via WhatsApp. **Chatwoot** catches it and triggers an **n8n** webhook.
2. **Reasoning** — n8n passes context to an LLM agent equipped with your knowledge base (vector store / RAG).
3. **Execution** —
   - FAQ or stock check → AI fetches data from **ERPNext** and replies via **Chatwoot**.
   - Anger or complex issue detected → AI flips the Chatwoot conversation to **open** for human handoff.

### Workflow B — Voice & Chat Order Fulfillment

1. **Ingestion** — Customer calls the **Muslimbot Voice Agent** or messages with purchase intent ("I need 5 laptops").
2. **Reasoning** — The LLM extracts structured data: `{ item: "Laptop", qty: 5, intent: "purchase" }`.
3. **Execution** — n8n POSTs to the **ERPNext** API → creates a Sales Order → deducts inventory → sends confirmation via **Chatwoot** (SMS/WhatsApp).

### Workflow C — Proactive Marketing Automation

1. **Trigger** — A scheduled **n8n** cron fires (e.g., Mon & Thu).
2. **Reasoning** — n8n fetches top-selling items from **ERPNext**, prompts an AI agent: *"Write promo copy + an image prompt for these best-sellers."*
3. **Execution** — n8n pushes the copy, hashtags, and media into **Postiz**, queuing publication on X, Instagram, and LinkedIn.

---

## 8. Security & Governance

| Pillar | What It Means |
|--------|---------------|
| **Idempotency & Guardrails** | All state-changing ERP calls (e.g., create order) carry idempotency keys to prevent double-billing during agent retries. |
| **Per-Tenant Data Silos** | Each client gets a segregated Frappe workspace and isolated vector database — no cross-tenant data leakage. |
| **Human-in-the-Loop** | High-risk actions (refunds, large transactions) are paused by the n8n orchestrator and require a human click before execution. |
| **Role-Based Access** | SMB Operator / SMB Manager / Administrator roles. SMB users are restricted to `/ops`; never see the ERPNext desk. |
| **Full Audit Trail** | Every agent action is logged for review. |
| **Self-Hosted & Open Source** | Run it on your own VPS. Your data never leaves your infrastructure. |

---

## 9. How It Works — From Setup to Autopilot in 3 Steps

1. **Connect Your Data** — We map your existing inventory, services, and pricing into the
   secure ERPNext backbone. Products, customers, and order history sync in minutes.
2. **Train Your Agents** — We feed your company policies, FAQs, and brand voice into your
   dedicated AI models and knowledge base (RAG).
3. **Flip the Switch** — Connect your Chatwoot channels and Postiz social accounts. Watch the
   AI take orders and schedule posts while you focus on strategy.

---

## 10. Pricing — Hire a Whole Team for the Price of Software

### Starter — "The Digital Clerk"
- Omnichannel AI Support (text only, via Chatwoot)
- 1,000 AI conversations / month
- Basic ERP inventory sync
- **CTA:** Get Started

### Pro — "The Digital Manager" *(Most Popular)*
- Everything in Starter
- AI Voice Ordering Agent (Muslimbot)
- Autonomous social media scheduling (Postiz)
- Generative UI analytics
- **CTA:** Start Free Trial

### Enterprise — "The Digital Executive"
- Custom ERP integration workflows
- Unlimited agentic executions
- Dedicated model fine-tuning
- Multi-brand support, SLA, dedicated manager
- **CTA:** Talk to Sales

---

## 11. Landing Page Content Blocks (Copy-Ready)

### Hero
- **Eyebrow:** The Future of Enterprise is Headless.
- **Headline:** Stop Managing Software. Start Managing Outcomes.
- **Sub-headline:** The world's first open-source AI-Agentic ERP. Muslimbot autonomously
  answers your customers across all channels, processes voice and text orders, updates your
  inventory, and runs your social media marketing.
- **Primary CTA:** Hire Your Digital Workforce
- **Secondary CTA:** Watch the Demo
- **Visual:** Dark-mode Generative UI turning a prompt into a sales chart, beside a WhatsApp
  chat where the bot takes an order.

### Social Proof / Integrations Banner
> Seamlessly integrated with the tools you already use:
> WhatsApp · Facebook · Instagram · LinkedIn · X · Shopify · ERPNext · Chatwoot · Postiz

### Problem / Solution
- **Headline:** You didn't start a business to do data entry.
- **Body:** Right now, your team spends 60% of the day answering repetitive WhatsApp messages,
  manually copying orders into an outdated inventory system, and struggling to keep up with
  social media. It's chaotic, expensive, and limits your growth.
- **The Solution:** We install an autonomous digital workforce. It connects directly to your
  inventory, never sleeps, speaks every language, and never makes a typo.

### Final CTA
- **Headline:** Ready to step into the Agentic Era?
- **Body:** Join the forward-thinking businesses that replaced manual admin work with
  intelligent, autonomous execution.
- **CTA:** Schedule Your Live Demo

---

## 12. Build Status — Honest Reality Check

To keep this document grounded (and to guide the roadmap), here is what exists **today**
versus what is **planned**:

| Capability | Status | Notes |
|------------|--------|-------|
| ERPNext core (inventory, POS, orders, accounting) | ✅ **Built** | Production-quality API + 9 HTMX `/ops` pages |
| Knowledge Hub (generative-ui + KB BFF) | ✅ **Built** | Upload/URL ingest, RAG chat, in-browser voice call |
| Muslimbot Voice Agent (21 ERP tools) | ✅ **Built** | LiveKit + Gemini; `--profile voice` |
| Muslimbot KB BFF (port 8787) | ✅ **Built** | Always on; generative-ui `/kb-api` proxy |
| n8n orchestration (event hooks, scheduled jobs) | ✅ **Built** | chat-support → KB BFF, erp-events, ai-assistant |
| Generative UI (chat-to-dashboard) | ✅ **Built** | Vite dev (local) + nginx (demo); Gemini NLP router |
| **Chatwoot omnichannel inbox** | ✅ **Built (demo)** | Always on in demo compose; local via `--profile support`; n8n webhook wiring in progress |
| **Postiz social scheduling** | ✅ **Built (demo)** | Postiz + Temporal in demo compose; n8n cron → Postiz workflow pending |
| Multi-tenant provisioning & data isolation | ✅ **Built** | `provision-tenant.sh` + onboarding API (SaaS compose not in tree) |
| Open WebUI control plane | 🔲 **Planned** | Referenced in SaaS scripts; not in current compose files |
| WhatsApp/SMS outbound notifications | 🔲 **Planned** | n8n Twilio/WhatsApp nodes. ETA ~1 week |

> **Positioning guidance:** Lead with voice agent + Knowledge Hub + generative-ui (real today).
> Chatwoot and Postiz run in the demo stack; full n8n automation loops (webhook reply, scheduled posts) are the active roadmap.

---

## Appendix A — Muslimbot Voice Tools (21)

**Read (no confirmation):** `search_items`, `check_stock`, `sales_summary`,
`get_recent_orders`, `search_customer`, `customer_history`, `get_receivables`,
`low_stock_alerts`, `ask_business_ai`, `list_events`, `system_status`

**Write (confirms first):** `create_order`, `submit_order`, `record_payment`,
`create_customer`, `create_item`, `add_stock`, `trigger_workflow`, `send_notification`,
`create_event`

## Appendix B — n8n Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `workflow-ai-assistant` | Webhook | Fetch ERP KPIs → GPT-4o-mini → answer |
| `workflow-chat-support-rag` | Webhook | KB BFF `/chat` → support reply for `/ops/ai` |
| `workflow-erp-events` | Doc event | Route sales/stock events; high-value & low-stock alerts |

---

*Muslimbot — built on open source. Your data, your infrastructure, your autonomous workforce.*
