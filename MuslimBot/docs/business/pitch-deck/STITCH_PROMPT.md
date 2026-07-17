# 🎨 Stitch Prompt: The Autonomous Pharmacy & Retail OS UI "Face"

This document compiles the **complete, highly structured UI/UX design prompt** to feed into **Stitch** (`generate_screen_from_text` or `create_design_system_from_design_md`) to generate the unified frontend dashboard—the "Face"—of our **Autonomous Business Operating System** ("MuslimBot Software").

---

## 🎯 The Stitch UI Generation Prompt

Copy and paste the following prompt directly into your **Stitch** workspace or `generate_screen_from_text` tool to render the unified, high-fidelity console:

```text
Create a premium, state-of-the-art Single-Page Application (SPA) dashboard acting as the unified "Face" (Control Cockpit) of an Autonomous Pharmacy & Retail OS. The design must feel extremely premium, dark-themed, and modern, using Inter and Outfit Google Fonts, HSL-tailored colors, smooth gradients, and glassmorphic panels.

---

### I. DESIGN SYSTEM & STYLE TOKENS
1. Background: Deep dark slate violet (HSL 260, 45%, 8%) with subtle glowing ambient background orbs.
2. Card Panels: Semi-transparent glassmorphism (rgba(30, 20, 50, 0.45), backdrop-filter: blur(16px), border: 1px solid rgba(255,255,255,0.08), deep shadow).
3. Accents:
   - Neon Gold (HSL 45, 100%, 60%) — Highlight/Branding
   - Electric Cyan (HSL 185, 100%, 50%) — Telemetry/Secure Ingress
   - Crimson Alert (HSL 355, 80%, 55%) — CCTV Security Alarms & Stock Depletion
   - Emerald Green (HSL 145, 75%, 48%) — Database Uptime & Stable Expiration Rates
4. Typography: Bold, high-contrast headings ('Outfit'), clean body copy ('Inter').

---

### II. DASHBOARD LAYOUT STRUCTURE
Use a highly functional 3-column grid layout designed for full-screen desktop monitoring:

#### Column 1: Sidebar Navigation & Identity (Left - Width: 260px)
- **Top Brand Section**: A tech logo icon (glowing microchip) with the title "MuslimBot OS". Displays an active 'AUTONOMOUS' status badge.
- **Slide Index / Page Selector**: Minimalist list of pages:
  - 1. Control Center (Active)
  - 2. AI CCTV Monitor
  - 3. Medicine Stock Ledger
  - 4. Omnichannel Support (Chatwoot/WhatsApp)
  - 5. DevSecOps Observability (LGTM Stack)
- **Footer**: Shows active flagship badge: "Pharma & Retail OS" with a glowing capsules icon.

#### Column 2: Surveillance, Security, & Support (Center - Flexible Width)
1. **CCTV Live Monitor Widget (CAM_01 REGISTER)**:
   - Black bezel monitor housing.
   - Top status bar: Pulsing red REC dot, "CCTV SECURE: REGISTER 01", and a digital ticking clock.
   - Screen: Dark slate viewport with scanline patterns, green grid mesh overlay, and a prominent green neon bounding box locking onto a target labeled "PERSON: 87%".
   - Bottom status bar: "Status: Live Feed | FPS: 30 | Bitrate: 4096kbps".
   - Action Button: An orange primary button with sound icon: "Simulate Motion Intrusion".
2. **Surveillance Alert Log (n8n Webhook Target)**:
   - Monospaced rows detailing real-time motion events: e.g., "[05:08:12] ⚠️ ALARM: AI object trigger: 'Person' detected in Register Zone. FTP upload completed."
3. **Omnichannel Chatwoot Chat Simulator**:
   - Small chat box illustrating a conversation between "Operator" (in gray bubble) and "Voice Agent (Gemini)" (in golden bubble), showing live stock check requests and Napa medicine details.

#### Column 3: ERP Medicine Ledger & Observability (Right - Width: 460px)
1. **Live Pharmacy Stock Sheet Table**:
   - A glassmorphic data grid with headers: Code, Medicine Name, Location, Count, Amount, Expires.
   - Napa-500: Located in "Rack 3, Shelf A", shows 1,200 units, and a flashing red capsule "Expires: 12d left ⚠️".
   - Savlon Liquid: Located in "Rack 1, Shelf C", shows a red stock count: "8 Units 🚨" (highlighting low stock).
   - Nano-Banana Energy: Located in "Rack 5, Shelf B", shows "40 Cases" with a green capsule "320d left".
2. **LGTM Grafana System Observability**:
   - Two circular gauge meters side-by-side:
     - Meter A: "Traefik Uptime" (Green, displaying 99.9%).
     - Meter B: "Camera Latency" (Yellow, displaying 14ms).
   - Loki Logs box showing live monospaced terminal logs: e.g. "TRAEFIK: Request GET /ops/inventory resolved 200 OK (TLS_1.2)".
3. **Strict Ingress Badge**: Displays a secure green shield labeled "TLS 1.2 SECURE ENFORCED".
```

---

## 🛠️ Design System Integration (Stitch Design Code)

To ensure the generated face has a cohesive typography and styling palette matching our presentation's Vanilla CSS design system, feed the following design config parameters into **Stitch Design System** tools:

```json
{
  "designSystem": {
    "name": "MuslimBot-OS-Dark",
    "theme": "dark",
    "fontFamily": {
      "headings": "Outfit, sans-serif",
      "body": "Inter, sans-serif"
    },
    "colors": {
      "background": "#080510",
      "card": "rgba(30, 20, 50, 0.45)",
      "border": "rgba(255, 255, 255, 0.08)",
      "primary": "#ffcc00",
      "secondary": "#00f0ff",
      "success": "#32cd32",
      "danger": "#ff3333",
      "text": "#f5f5f5",
      "muted": "#8a829e"
    },
    "effects": {
      "blur": "blur(16px)",
      "shadow": "0 12px 40px 0 rgba(0, 0, 0, 0.45)"
    }
  }
}
```
