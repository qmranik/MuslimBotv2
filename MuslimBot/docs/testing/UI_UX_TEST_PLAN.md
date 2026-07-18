# Full Muslimbot System: UI/UX Test Plan & System Audit

This document provides a comprehensive, step-by-step UI/UX test plan tailored specifically for the **Muslimbot System** (Next.js Generative UI, Go Orchestrator, LiveKit Voice Agent, and Frappe ERP). 

---

## 1. Automated Audit Prompt (Next.js, Go, LiveKit Stack)

To run an automated or AI-assisted audit on this specific architecture, use the following prompt tailored to the actual stack:

> **Goal:** Perform a comprehensive, full-stack UI/UX, performance, and backend audit of the **Muslimbot System**. I want you to act as a Senior QA Automation Engineer, UX Researcher, and Full-Stack Architect.
> 
> **Phase 1: Frontend Architecture & UI/UX (Next.js & Tailwind CSS)**
> 1. Audit the Next.js `generative-ui` directory. Ensure `AppShell`, `MuslimBotShell`, and `PersistentIframes` are optimized and do not cause unnecessary re-renders.
> 2. Evaluate the UI against modern CSS standards (Tailwind configuration, glassmorphism, responsive container queries). Ensure the Chat Command Center scales cleanly on mobile.
> 3. Verify the `VoiceCallButton` integration with `@livekit/components-react`. Ensure the floating action button (FAB) states (connecting, connected, disconnected) are visually distinct and accessible.
> 
> **Phase 2: Browser Diagnostics (Accessibility, Performance & Core Web Vitals)**
> 1. Perform a strict web.dev accessibility audit on semantic HTML, ARIA labels, contrast ratios, and keyboard navigation. Pay special attention to the dynamic Generative Components (Tables, Charts, Cards).
> 2. Measure Core Web Vitals (LCP, INP) specifically when the `PersistentIframes` (n8n, Chatwoot, ERPNext) are loading in the background. Ensure the iframe sandboxing does not degrade the main thread.
> 
> **Phase 3: Backend & Data Integration (Go Orchestrator & LiveKit)**
> 1. Audit the Go Orchestrator (`/v1/auth/me`, `/v1/voice/token`). Verify that Authentik ForwardAuth tokens are correctly verified before issuing WebRTC tokens.
> 2. Test the Voice Agent latency. The `Muslimbot-voice-agent` (Gemini 2.5 Flash + MCP) must maintain sub-500ms response times. Check Loki logs for `TURN_METRIC` anomalies.
> 3. Audit the Frappe (`small_erp`) endpoints to ensure the "Confirm Before Write" logic is strictly enforced by the Go Orchestrator before mutations occur.

---

## 2. Step-by-Step Manual UI/UX Test Plan

### Step 1: Onboarding & Authentication Flow (Authentik)
- **Visuals:** Does the Next.js app load instantly? Are Tailwind transitions smooth?
- **Auth UI:** Test the Traefik -> Authentik -> Go Orchestrator SSO flow. Verify that unauthorized users are redirected to the Authentik login portal seamlessly.
- **Tenant Context:** Verify that the correct tenant workspace loads based on the subdomain or user mapping.

### Step 2: Core Navigation & Accessibility (a11y)
- **Keyboard Navigation:** Can a user navigate the `WorkspaceNav` and `SystemsTabBar` using only the `Tab` and `Enter` keys?
- **Voice Button:** Is the `VoiceCallButton` easily discoverable and accessible via screen readers?
- **Responsiveness:** Open the app on a mobile device. Ensure the `AppSidebar` collapses into a hamburger menu and the `GlobalChatPanel` takes up the full screen rather than docking to the side.

### Step 3: Core Features (The "Muslimbot" Generative Experience)
- **AI Interactions:** Type a complex query into the Command Center (e.g., "Show me sales for today and draft a tweet"). Does the UI handle the streaming `UiDescriptor` smoothly? 
- **Component Rendering:** Verify that `GenerativeChart`, `GenerativeTable`, and `GenerativeCard` render without jitter as JSON data streams in.
- **State Management:** Switch tabs (e.g., from Command Center to Chatwoot Hub). Does `PersistentIframes` preserve the scroll position and state of the embedded applications?

### Step 4: Real-Time Voice Agent (LiveKit + Gemini)
- **Connection:** Click the "Call Support" button. Does the UI indicate a "Connecting..." state with a loading spinner?
- **Barge-in / Interruption:** Speak to the agent, and interrupt it mid-sentence. Does the audio stop instantly (verifying Gemini's native VAD and track priorities)?
- **Data Execution:** Ask the voice agent to "check inventory." Verify that the agent pauses, executes the MCP tool, and speaks the correct data back without failing.

### Step 5: Edge Cases & Error Handling
- **Iframe Failures:** What happens if the n8n container is down? Does the `SecurePortal` show a graceful fallback UI or a raw connection error?
- **Voice Token Expiry:** Keep the voice call active for over 2 hours. Does the token refresh gracefully, or does the call drop?
- **Confirm Before Write:** Attempt to delete a record via the Chat Command Center. Ensure a confirmation card appears and the action *does not* execute until clicked.