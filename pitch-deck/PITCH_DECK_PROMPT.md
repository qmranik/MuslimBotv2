# Muslimbot — Master Pitch-Deck Generation Prompt

This is a **reusable meta-prompt**. Paste it into any capable LLM or deck generator
(Claude, GPT, Gemini, Gamma, Beautiful.ai, Tome, or a Stitch/v0-style UI tool) to
generate a complete investor pitch deck for **Muslimbot**. Fill the `[[BRACKETED]]`
fields with your real numbers before sending, or leave them and ask the model to keep
them flagged as illustrative.

> Two output modes are described at the bottom: **(A) Slide-content deck** (for
> Gamma/PowerPoint/Google Slides) and **(B) Interactive HTML deck** (matching this
> repo's `index.html` / `style.css` / `app.js`).

---

## 1. THE MASTER PROMPT (copy from here)

```text
ROLE
You are a world-class startup pitch strategist and presentation designer who has helped
seed and Series-A founders raise from top funds. You write crisp, investor-grade copy and
design premium, dark-mode, glassmorphic decks. You never pad; every word earns its place.

TASK
Generate a complete, investor-ready pitch deck for "Muslimbot", an AI-Agentic ERP and
"digital workforce" SaaS for small & medium enterprises (SMEs), built entirely on
open-source. Produce both the narrative copy AND speaker notes for each slide.

PRODUCT CONTEXT (ground truth — do not invent capabilities beyond this)
- Muslimbot is a headless, AI-agentic ERP that acts as an "invisible digital workforce".
- It is built on a best-in-class OPEN-SOURCE stack, orchestrated by n8n:
  - System of Record: ERPNext / Frappe (inventory, customers, orders, accounting; REST API).
  - Orchestration: n8n (webhooks, LLM agent nodes, routing, scheduled crons).
  - Omnichannel Support: Chatwoot (WhatsApp, web chat, Facebook, Instagram → one inbox).
  - Marketing Automation: Postiz (AI-generated copy + media scheduled to X/IG/LinkedIn).
  - Voice Agent: "Muslimbot" voice (LiveKit + Google Gemini 2.0 Flash) with 21 callable
    ERP tools — real-time WebRTC voice that checks stock and places orders hands-free.
  - Admin/Generative UI: React 19 + Vercel AI SDK; users chat with ERP data and get live
    charts/tables/actions rendered on the fly.
  - Public site: Frappe Builder. Control plane: Open WebUI.
  - RAG knowledge base: documents → chunk → vector store (pgvector/Qdrant) → grounded answers.
- Security & governance: per-tenant data isolation, idempotency keys on state-changing
  actions, human-in-the-loop approval for high-risk actions, full audit trail, self-hosted.
- Vertical focus / beachhead: pharmacy and tech-retail SMBs in emerging markets.
- Differentiators: ONE unified agentic OS (not point tools), real voice ordering,
  open-source & self-hostable (own your data, no per-seat fee), days-not-months setup,
  90%+ gross margin (30+ tenants per single VPS).

BUILD STATUS (be honest; separate shipped vs roadmap)
- Shipped/working today: ERPNext core (/ops POS, inventory, orders, accounting),
  Muslimbot voice agent (21 tools, LiveKit+Gemini), n8n orchestration (5 workflows,
  doc-event hooks, scheduled jobs), RAG knowledge pipeline, Open WebUI, multi-tenant
  provisioning & data isolation.
- In progress / roadmap: Chatwoot omnichannel inbox, Postiz autonomous marketing,
  Generative UI (chat-to-dashboard), WhatsApp/SMS outbound notifications.
- Treat roadmap items as "designed on the same n8n event architecture" — credible, not vaporware.

AUDIENCE
Pre-seed / seed investors and strategic partners. Secondary: SMB owners and design partners.

NARRATIVE ARC (use this slide order)
1.  Hero / vision — "Run your shop with one AI-native operating system."
2.  Problem — fragmented retail/pharma stack leaks revenue (manual chat, data entry,
    expiry/compliance risk, disconnected tools).
3.  Solution / Platform — one platform, four agentic surfaces (ERP /ops, Voice, Omnichannel, Generative UI).
4.  Product deep-dive: ERP medicine & stock ledger (compliance layer).
5.  Product deep-dive: Voice agent (speak to your shop; 21 tools).
6.  Product deep-dive: Omnichannel automation (Chatwoot + n8n + Postiz).
7.  Product deep-dive: Generative UI (ask anything, see live dashboards).
8.  System architecture — composable microservices (each project = a service: small_erp,
    Muslimbot-voice-agent, generative-ui, Punk_AI-dev backend/admin/landing, n8n, Chatwoot,
    Postiz) behind Traefik on a shared Docker network, orchestrated by n8n.
9.  Security & observability (per-tenant isolation, TLS, audit, guardrails, LGTM/Langfuse).
10. Market opportunity (TAM/SAM/SOM, why-now: agentic AI + open source).
11. Competitive landscape (matrix vs legacy ERP, point SaaS, manual).
12. Business model & pricing (Starter/Growth/Enterprise; unit economics; 90%+ margin).
13. Traction & roadmap (shipped → now → next).
14. The Ask (raise amount, use of funds, runway, contact).

PER-SLIDE OUTPUT FORMAT
For each slide return:
- Slide number & title
- Eyebrow/kicker (2-4 words)
- Headline (≤ 9 words, punchy)
- 1 short sub-headline (≤ 25 words)
- 3-5 bullets OR a small data viz spec (table/metric/chart described in words)
- One "stat to feature" if relevant
- Speaker notes (2-4 sentences, conversational, what the founder says out loud)

NUMBERS TO USE (replace before finalizing; flag any you keep as "illustrative")
- TAM [[$78B]] / SAM [[$6.4B]] / SOM 3-yr [[$120M]]
- Pricing: Starter [[$49]]/mo, Growth [[$149]]/mo (most popular), Enterprise [[$399]]/mo
- Gross margin [[90%+]]; tenants per VPS [[30+]]
- Raise [[$750K pre-seed]], runway [[18 months]], 3-yr tenant target [[70k]]
- Use of funds: Eng/R&D [[45%]], GTM [[30%]], Infra/Security [[15%]], Ops/Compliance [[10%]]

STYLE & TONE
- Confident, outcome-driven, anti-busywork. "We sell outcomes, not software."
- Concrete > abstract. Lead with the voice agent (it's the rare, demoable differentiator).
- No buzzword soup. Every claim must trace to the product context above.
- Dark, premium, glassmorphic aesthetic. Accent palette: neon gold #ffcc00 (brand),
  electric cyan #00f0ff (telemetry), emerald #32cd32 (healthy), crimson #ff3333 (alerts),
  deep violet background #080510. Fonts: Outfit/Sora (headings), Inter (body).

DELIVERABLE
Return the full 13-slide deck following the per-slide format. Then append:
(a) a 30-second elevator pitch, (b) a one-line tagline options list (5),
(c) the 3 hardest investor questions with crisp answers.
```

---

## 2. OPTIONAL ADD-ON PROMPTS

Append any of these to the master prompt to steer the output.

- **For a specific fund:** "Tailor the framing for [[fund name]], who focus on
  [[thesis: e.g. open-source / vertical SaaS / emerging markets / applied AI]]."
- **For a demo-day variant:** "Compress to 10 slides max, optimize for a 3-minute
  read-aloud, and make slide 1 and slide 13 the strongest."
- **For a data-room one-pager:** "Also produce a single-page executive summary
  (problem, solution, market, traction, ask) under 300 words."
- **For localization:** "Provide a second version localized for [[Bangladesh / GCC /
  Southeast Asia]] markets with region-appropriate examples and currency."

---

## 3. OUTPUT MODE A — Slide content (Gamma / Slides / PowerPoint)

Add this to the end of the master prompt:

```text
OUTPUT AS: a Markdown document where each slide is an H2 (## Slide N — Title), with the
headline as bold, bullets as a list, and speaker notes in a > blockquote. Keep it
copy-paste ready for Gamma's "paste in text" import or Google Slides.
```

## 4. OUTPUT MODE B — Interactive HTML deck (this repo)

This repository already contains a working interactive deck:
`index.html` (slides as `<article class="slide-card" data-title="...">`), `style.css`
(design tokens + components), `app.js` (auto-builds nav from slide order, keyboard
nav, fullscreen, tab/voice/genui/calculator interactions).

To extend it with an LLM, add this to the master prompt:

```text
OUTPUT AS: HTML <article class="slide-card" data-title="TITLE" tabindex="-1"> blocks that
drop into the existing #slides-viewport in index.html. Reuse ONLY existing CSS classes
from style.css where possible: .slide-content .grid-two-cols / .slide-full-width,
.text-block, .section-intro, .slide-subtitle (.text-yellow/.text-cyan/.text-green),
.slide-title, .display-title, .section-subheading, .stats-strip/.stat-chip,
.feature-bullets/.bullet-item, .glass-card, .visual-tag-overlay, .primary-btn
.advance-slide-btn, .comparison-container, .feature-cards-grid, .workflow-steps-list,
.step-badge (.shipped/.now/.next), .competition-matrix, .market-funnel, .traction-panel,
.use-of-funds, and for architecture diagrams .arch-diagram/.arch-tier/.arch-tier-label/
.arch-row/.arch-node (+ variants .client/.edge/.fe/.engage/.core/.ai/.data/.bus/.full)/
.arch-repo/.arch-arrow/.arch-crosscut/.crosscut-item. Do NOT invent new class names unless
you also output the matching CSS.
Nav, indicator dots, and keyboard navigation auto-generate from slide order — no JS edits
needed for static slides. Only add JS if a slide needs interactivity, and namespace new
element IDs.
```

> Tip: keep each slide's primary CTA as a `.primary-btn.advance-slide-btn` so the
> "advance" wiring in `app.js` works automatically.

---

## 4. PRESENTER CHECKLIST (before you pitch)

- [ ] Replace every `[[bracketed]]` number with validated figures.
- [ ] Confirm shipped-vs-roadmap framing matches reality (`landing.md` §12 is the source of truth).
- [ ] Lead the live demo with the **voice agent** — it's the memorable moment.
- [ ] Have the cost-comparison ready ("a whole team for the price of software").
- [ ] Prepare answers to: data privacy, model cost at scale, GTM/CAC, defensibility.
- [ ] Export a PDF fallback (in case the interactive deck can't run on their screen).
