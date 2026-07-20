# liteERP Command Center (Generative UI)

The Command Center is a Next.js 16 (App Router) single pane of glass for the MuslimBot ecosystem. It unifies ERPNext, Chatwoot, TryPost, and n8n behind a single Authentik SSO session.

## Architecture

This frontend is designed to run behind a central Go orchestrator (`/v1/*`), which acts as an MCP host and AI brain.
- **Never put Frappe/Gemini/MCP secrets in the browser.** All secure interactions happen via the orchestrator.
- **SSO Embeds:** Portals are embedded via cross-origin iframes using secure, one-time SSO links provisioned by the orchestrator.
- **Voice:** `VoiceCallPanel` rebuilds the tenant voice brief (`POST /v1/kb/voice-brief/rebuild`) before minting a LiveKit session (`POST /v1/kb/voice/session`), then connects with `livekit-client`. Mid-call KB refresh status arrives on LiveKit data topic `kb-context`.

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

```
NEXT_PUBLIC_API_URL=http://localhost:8080
ORCHESTRATOR_URL=http://localhost:8080
NEXT_PUBLIC_AUTHENTIK_URL=https://auth.smb.localhost
```

## Running Locally

```bash
npm install
npm run dev
```

For production build:
```bash
npm run build
npm run start
```

## Docker

The `Dockerfile` produces a slim, standalone Next.js build. The orchestrator must be running and correctly configured for SSO embeddings to work.

## Embed Prerequisites
To successfully embed cross-origin portals (like Chatwoot, TryPost, n8n):
1. **CSP frame-ancestors**: The edge router (Traefik) must explicitly allow this UI domain (`ui.smb.localhost` or similar) to frame the target apps.
2. **Third-Party Cookies**: `SameSite=None; Secure` cookies are required for SSO across subdomains. This mandates TLS (HTTPS).
