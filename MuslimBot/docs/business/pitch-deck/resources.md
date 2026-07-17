# Muslimbot — Visual Resources & Asset-Generation Prompts

A consolidated, copy-paste library of prompts to generate the **logo, brand assets, slide
imagery, and marketing visuals** for **Muslimbot** — the AI-Agentic ERP & digital
workforce. Every prompt is tuned to the project's design system so generated assets drop
cleanly into the pitch deck (`index.html`) and landing page.

> Companion files: `PITCH_DECK_PROMPT.md` (deck copy), `STITCH_PROMPT.md` (UI generation),
> `PITCH_PROMPTS.md` (tech-giant marketing renders), and `../landing.md` (product context).

---

## 0. Brand & Design System (use as a constant in every prompt)

| Token | Value | Use |
|-------|-------|-----|
| Background | `#080510` (deep slate violet) | Canvas / dark base |
| Card glass | `rgba(30,20,50,0.45)` + `blur(16px)` | Panels |
| **Neon Gold** | `#ffcc00` | Primary brand / highlight |
| Electric Cyan | `#00f0ff` | Telemetry / secure |
| Emerald | `#32cd32` | Healthy / success |
| Crimson | `#ff3333` | Alerts |
| Violet accent | `#8b5cf6` | Ambient orbs |
| Headings font | Outfit / Sora | Logos, titles |
| Body font | Inter | UI copy |

**Brand keywords:** agentic, autonomous, headless, premium, glassmorphic, dark-mode,
enterprise, open-source, calm-tech, "invisible digital workforce."

**Reusable style suffix** (paste at the end of any image prompt):
> `dark mode, premium glassmorphic enterprise aesthetic, deep violet #080510 background,
> neon gold #ffcc00 and electric cyan #00f0ff accents, soft cinematic lighting, subtle
> ambient glow orbs, high detail, 8k, professional product marketing render, no text
> artifacts, no watermark.`

**Universal negative prompt** (for SD/Flux/Ideogram):
> `lowres, blurry, jpeg artifacts, distorted text, gibberish letters, extra fingers,
> cluttered, busy background, childish, clip-art, stock-photo watermark, oversaturated,
> rainbow gradients, generic AI sludge.`

---

## 1. Logo

### 1a. Primary icon mark
```text
Design a minimalist app icon / logo mark for "Muslimbot", an AI-agentic ERP platform.
Concept: fuse a friendly autonomous-agent spark with a subtle ERP/operations motif —
a rounded geometric glyph that reads as both a "bolt of automation" and a "node in a
network." Single continuous form, balanced negative space, scalable to a 32px favicon.
Flat vector, neon gold #ffcc00 primary with a soft inner glow on a deep violet #080510
rounded-square tile. Modern, premium, tech-forward, Stripe/Linear-level craftsmanship.
Vector, centered, no text.
```

### 1b. Wordmark (lockup)
```text
A clean, modern wordmark logo reading "Muslimbot" in a geometric sans-serif (Outfit/Sora
style), tight tracking, with the icon mark to the left. Neon gold #ffcc00 on transparent
/ deep violet. Horizontal lockup plus a stacked variant. Crisp vector, balanced, premium
SaaS branding, no background clutter.
```

### 1c. Monochrome + favicon variants
```text
Produce monochrome (pure white, and pure #080510) versions of the Muslimbot icon mark for
light/dark surfaces, plus a simplified single-glyph favicon that stays legible at 16px and
32px. Flat vector, no gradients in the favicon variant.
```

**Recommended tools for logos:** Recraft, Ideogram (best for clean text/wordmarks),
Looka/Designs.ai for iteration, then vectorize in Figma/Illustrator. Avoid raster-only
generators for the final wordmark (text fidelity).

**Save as:** `assets/logo-icon.svg`, `assets/logo-wordmark.svg`,
`assets/logo-mono-white.svg`, `assets/favicon.svg`, `assets/favicon-32.png`.

---

## 2. Hero / Cover Imagery (deck slide 1 + landing hero)

### 2a. Split hero (WhatsApp order + generative dashboard)
```text
A premium dark-mode product hero composition, split into two floating glass panels.
LEFT: a WhatsApp-style chat where a customer says "I need 5 laptops" and an AI agent
confirms an order with an invoice number — clean message bubbles, green accent.
RIGHT: a generative analytics dashboard where a typed prompt transforms into a glowing
neon-gold bar chart and KPI cards. Floating, slight 3D perspective, glassmorphic panels
with soft shadows, deep violet #080510 background with ambient gold/cyan glow orbs.
[STYLE SUFFIX]
```

### 2b. "Invisible digital workforce" abstract
```text
An abstract conceptual render symbolizing an autonomous digital workforce: a constellation
of glowing agent-nodes (gold and cyan) connected by elegant data lines, each node a small
glass orb performing a task icon (chat, cart, megaphone, chart). Calm, premium, depth of
field, deep violet environment. No humans, no text. [STYLE SUFFIX]
```

**Save as:** `assets/hero-split.png` (16:9 and 4:5 crops), `assets/hero-abstract.png`.

---

## 3. The Four Agentic Surfaces (feature/section icons & spot art)

Generate a **matching icon set** (one prompt, request 4 variations) so they feel cohesive:
```text
A cohesive set of 4 premium glassmorphic feature icons on deep violet tiles, neon gold
#ffcc00 line-art with subtle cyan #00f0ff glow, consistent stroke weight and corner radius:
1) Omnichannel Support Agent — a chat bubble with an AI spark + small WhatsApp/IG/FB hints.
2) Voice & Text Order Clerk — a microphone merged with a shopping cart.
3) Marketing Manager — a megaphone emitting scheduled social cards.
4) Generative CEO Dashboard — a magic wand over a bar chart.
Flat-ish 2.5D, enterprise, minimal, no text. [STYLE SUFFIX]
```
**Save as:** `assets/feat-support.png`, `assets/feat-voice.png`,
`assets/feat-marketing.png`, `assets/feat-genui.png`.

---

## 4. Tech-Giant Marketing Renders (referenced in PITCH_PROMPTS.md)

These four hero renders elevate the deck to "tech-giant" polish. Prompts are maintained in
`PITCH_PROMPTS.md`; expected output files (place in `assets/`):

| File | Aesthetic | Subject |
|------|-----------|---------|
| `assets/pharma_device_mockup.png` | Apple | Slim tablet running /ops POS on a mahogany pharmacy counter |
| `assets/smart_ar_hud.png` | Google | AR HUD over pharmacy shelves with stock/expiry overlays |
| `assets/agentic_orchestration.png` | Microsoft | Glowing orchestration sphere with n8n/agent nodes |
| `assets/multitenant_cloud_scaling.png` | AWS | Multi-tenant cloud architecture + observability cockpit |

> Note: the current deck (`index.html`) renders all visuals as **pure CSS mockups** — it
> needs **no external images to run**. These renders are optional upgrades for a
> higher-fidelity export, the landing page, or a PDF version.

---

## 5. Architecture & Diagram Assets

```text
A clean enterprise architecture diagram, dark premium style: customer channels (WhatsApp,
web chat, Facebook, Instagram, phone) flowing into Chatwoot, Postiz, and a Muslimbot voice
node; all converging into a central glowing n8n "orchestration engine" hub; n8n connects
via REST to an ERPNext "system of record" cylinder; below it, Frappe Builder, Generative
UI, and Open WebUI. Neon gold + cyan connectors on deep violet, glassmorphic nodes,
labeled boxes with crisp legible sans-serif text, isometric or top-down flow. [STYLE SUFFIX]
```
> For diagrams where text legibility matters, prefer **Ideogram** or **Recraft**, or build
> in **Excalidraw/Mermaid/Figma** and only AI-generate the background texture.

**Save as:** `assets/architecture-diagram.png`.

---

## 6. Social / OG / App-Store Assets

### 6a. Open Graph / social share (1200×630)
```text
A 1200x630 Open Graph banner for Muslimbot. Left: the Muslimbot wordmark (neon gold) with
tagline "Run your business on autopilot." Right: a small floating glass dashboard + chat
mock. Deep violet background, ambient gold/cyan glow, lots of breathing room, enterprise
premium. Legible text. [STYLE SUFFIX]
```
**Save as:** `assets/og-image.png` (1200×630), plus a 1080×1080 square for Instagram/LinkedIn.

### 6b. Slide background texture (optional)
```text
A subtle, seamless dark background texture for presentation slides: near-black deep violet
#080510 with a faint dotted grid and 2-3 very soft out-of-focus glow orbs (gold, cyan,
violet) in the corners. Minimal, non-distracting, 16:9, high resolution. No subjects, no text.
```
**Save as:** `assets/slide-bg.png`.

---

## 7. Tooling Cheat-Sheet

| Need | Best tool(s) | Why |
|------|--------------|-----|
| Logo / wordmark (clean text) | Ideogram, Recraft | Superior text & vector fidelity |
| Hero / concept renders | Midjourney v6+, Flux | Best lighting & composition |
| Editable vectors | Recraft, Figma, Illustrator | SVG export, brand control |
| Diagrams with labels | Excalidraw, Mermaid, Figma | Reliable legible text |
| Icon sets (cohesive) | Midjourney (--sref for consistency), Recraft | Style-locked sets |
| Upscale / cleanup | Magnific, Topaz | Print/retina exports |

**Aspect ratios:** deck visuals `16:9` or square panel `1:1`; hero `16:9` + `4:5`;
OG `1200×630`; favicon `1:1`. **Consistency tip:** in Midjourney use one `--sref` seed
across all assets; in Flux/SD reuse the same style suffix + negative prompt.

---

## 8. File Map (where assets plug in)

```
pitch-deck/
├── assets/
│   ├── logo-icon.svg            ← sidebar brand (replaces fa-bolt), favicon
│   ├── logo-wordmark.svg        ← deck title / landing navbar
│   ├── favicon.svg / favicon-32.png
│   ├── hero-split.png           ← slide 1 visual (optional, replaces CSS mock)
│   ├── feat-*.png               ← platform-stack tab cards (optional)
│   ├── architecture-diagram.png ← solution / how-it-works
│   ├── pharma_device_mockup.png ← PITCH_PROMPTS.md (Apple)
│   ├── smart_ar_hud.png         ← PITCH_PROMPTS.md (Google)
│   ├── agentic_orchestration.png← PITCH_PROMPTS.md (Microsoft)
│   ├── multitenant_cloud_scaling.png ← PITCH_PROMPTS.md (AWS)
│   ├── og-image.png             ← social share / <meta property="og:image">
│   └── slide-bg.png             ← optional slide texture
```

> To use the logo in the deck sidebar, replace the `<i class="fa-solid fa-bolt logo-icon">`
> in `index.html` with `<img src="assets/logo-icon.svg" class="logo-icon" alt="Muslimbot">`.
> The deck works fully without any of these assets (all visuals are CSS) — add them only to
> raise fidelity for exports, the landing page, or investor PDFs.
