# MuslimBot System: UI/UX & Architecture Audit Report

**Date:** July 13, 2026
**Auditor:** Senior QA Automation Engineer & UX Architect
**Scope:** `generative-ui` (Next.js), `go-orchestrator`, `Muslimbot-voice-agent`

---

## Executive Summary
The MuslimBot system demonstrates a highly advanced, unified architecture. The transition to a "Single Pane of Glass" using Generative UI and iframe SSO (`PersistentIframes`) successfully masks the complexity of the underlying silos (Frappe, n8n, Chatwoot). The real-time Voice Agent utilizing MCP and Gemini Live is exceptionally fast. 

However, several UI/UX edge cases, accessibility gaps, and performance optimizations (particularly around iframe lifecycle management) need to be addressed to achieve a true "Production Grade" standard.

---

## 1. Frontend & UI/UX (Generative-UI)

### 🔴 High Priority: Iframe Memory Management
- **Issue:** The `PersistentIframes` component keeps heavily DOM-intensive applications (like n8n and ERPNext) mounted in the background when navigating between tabs. While this preserves state, keeping 5+ iframes mounted simultaneously causes severe Memory Leaks and degrades Interaction to Next Paint (INP).
- **Fix:** Implement a Least Recently Used (LRU) cache for `PersistentIframes`. Only keep the 2 most recently used iframes mounted in the DOM. Unmount the others and rely on the Next.js router/SSO to re-hydrate them when visited again.

### 🟡 Medium Priority: Voice Call Button Feedback
- **Issue:** The `VoiceCallButton` relies on a generic `Loader2` spinner. If the LiveKit WebSocket connection fails (e.g., firewall issues), the button gets stuck in an infinite "Connecting..." state with no error toast provided to the user.
- **Fix:** Implement a timeout (e.g., 5000ms) on the connection attempt. If it fails, revert the state, stop the spinner, and show a toast notification: "Failed to connect to Voice Server. Please check your network."

### 🟡 Medium Priority: Generative Component Streaming Jank
- **Issue:** When the Go Orchestrator streams a large `GenerativeTable` via the `UiDescriptor`, the React component re-renders on every single chunk, causing visual layout shift (CLS).
- **Fix:** Debounce the rendering of the `GenerativeTable` props, or use the `useDeferredValue` hook in React 18/19 so the UI only paints when a meaningful chunk of the JSON schema is complete.

### 🟢 Low Priority: Accessibility (a11y) Contrast
- **Issue:** The `MuslimbotFab` (Floating Action Button) shadow does not have enough contrast against the `var(--canvas-bg)` in dark mode, making it hard to see for visually impaired users.
- **Fix:** Increase the `box-shadow` opacity and add a subtle `border-slate-700` in the dark mode Tailwind classes.

---

## 2. Voice Agent & Backend (LiveKit + Go)

### 🔴 High Priority: Missing Disconnect Logic on Voice Agent
- **Issue:** In `agent.py`, the worker listens for `ctx.room` indefinitely. If the user closes the browser tab without explicitly clicking "End Call", the LiveKit room remains active, keeping the Gemini Realtime session open and draining API credits.
- **Fix:** Add a room event listener in `agent.py` to gracefully shutdown the session if the user disconnects:
  ```python
  @ctx.room.on("participant_disconnected")
  def on_participant_disconnected(participant):
      logger.info(f"User {participant.identity} left. Shutting down session.")
      asyncio.create_task(ctx.disconnect())
  ```

### 🟡 Medium Priority: JWT Token Expiry Handling
- **Issue:** The `/v1/voice/token` endpoint in the Go Orchestrator hardcodes a 2-hour expiry. If a support call lasts longer, it will abruptly drop.
- **Fix:** The `generative-ui` needs to implement a token refresh loop. Listen to the LiveKit `@livekit/components-react` events for token expiration warnings and fetch a new token seamlessly in the background.

### 🟢 Low Priority: Room Metadata Resilience
- **Issue:** If `generative-ui` sends malformed JSON in the token metadata, `agent.py` catches the `JSONDecodeError` but continues with an empty `source_context`.
- **Fix:** Ensure the Go Orchestrator strictly validates and sanitizes the `metadata` string before minting the LiveKit token to guarantee the Voice Agent always receives a predictable payload.

---

## Conclusion
The architectural foundation of MuslimBot is incredibly strong. By implementing the LRU iframe cache, securing the Voice Agent shutdown lifecycle, and polishing the error handling on the Voice Call button, the system will deliver a flawless, premium UX suitable for enterprise-grade customer support.