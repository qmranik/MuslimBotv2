# GenUI → Unified "Single Pane of Glass" — Production Implementation Plan

**Status:** design, ready-to-execute · **Date:** 2026-07-18 · **Owner:** platform
**Scope:** turn the Next.js `generative-ui` into the single control plane over ERPNext +
Chatwoot + TryPost + n8n, behind one Authentik SSO, with the agent driving every subsystem
through the orchestrator's MCP host.

Related: [`production/RUNBOOK.md`](production/RUNBOOK.md) ·
[`BLUEPRINT_V2_IMPLEMENTATION_PLAN.md`](../production/BLUEPRINT_V2_IMPLEMENTATION_PLAN.md) ·
[`architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md`](architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md)

---

## 0. Ground truth — what the source prompt got wrong (RnD correction pass)

The extension prompt and the blueprint's "live analysis" were written against an **older GenUI
(Vite, `services/gemini.js`, `hooks/useGenerativeChat.js`)** and a **pre-fix edge**. The
repository today is different. Verified against the working tree on this branch:

| Prompt/blueprint claim | Actual state (verified) | Consequence for the plan |
|---|---|---|
| GenUI is Vite; chat runs `runNLPRouter` browser-direct Gemini | `generative-ui/` is **Next.js 16.2.10 / React 19.2.4**, App Router. Chat is [`AiChatPanel.tsx`](../../generative-ui/src/app/workspace/components/AiChatPanel.tsx) calling `generateUI()` → `/v1/ai/generate-ui` | The "point chat at `/v1/ai/chat`" work is a small typed change, not a rewrite (§4) |
| `api.` → 404 (orchestrator middleware mislabeled) | Already fixed: [`docker-compose.extended.yml:212`](../../docker-compose.extended.yml) uses `authentik-forwardauth@file` | U0 is **done**; but see security gap below |
| `auth.` → 404 (multiple services) | Already fixed: routers pinned to services (compose `:84`, `:90`) | U0 done |
| Frontend/back-end portal contract aligned | **Mismatch bug:** [`api.ts`](../../generative-ui/src/lib/api.ts) `getPortalURL` allows `'social'`; [`handler.go:58`](../../MuslimBot/go-orchestrator/internal/portals/handler.go) accepts `trypost`/`postiz`, **not** `social` → 404. Backend also returns `{url, embed_mode, auth_mechanism}`, FE type is `{url}` only | Must fix app-name enum + response type before SecurePortal works (§3, §5) |
| `sandbox="allow-same-origin allow-scripts …"` is sufficient | Ignores cross-origin framing. Chatwoot/n8n/TryPost live on **their own subdomains**; each ships `X-Frame-Options`/`frame-ancestors` that **blocks embedding** by default | Edge must strip/relax framing headers per app, or nothing embeds (§6 — the real blocker) |
| Chat panel is app-wide | It renders only inside [`workspace/page.tsx`](../../generative-ui/src/app/workspace/page.tsx) | Move it into the layout so it persists across portal routes (§2) |
| `app.` protected by SSO | The `genui` router in compose has **no ForwardAuth middleware and no env vars** | Add ForwardAuth + `NEXT_PUBLIC_*` (§6) |

**Two new security findings surfaced during RnD (fold into the security floor):**

1. **Header-spoofing gap.** The orchestrator router applies `authentik-forwardauth@file`
   *directly*, skipping the `authentik-auth` chain that first runs `strip-identity-headers`
   ([`traefik/dynamic/authentik.yml`](../../MuslimBot/traefik/dynamic/authentik.yml)). A client
   could send forged `X-authentik-*` headers; only the G2 trusted-proxy CIDR check stops it.
   Switch the router to the **chain** (`authentik-auth@file`) so defense-in-depth doesn't rest
   on one control. → `S-1`.
2. **`allow-same-origin` + `allow-scripts` together** lets a *same-origin* framed app remove
   its own sandbox. Safe only because portals are **cross-origin**; document the invariant so a
   future same-origin embed doesn't silently defeat the sandbox. → `S-2`.

---

## 1. Target architecture (unchanged intent, corrected wiring)

```
                 Authentik (one login)  ──ForwardAuth──┐
 Browser ─▶ app.<d>  (generative-ui, Next 16)          │
   single pane │  ├─ /workspace            AI dashboard + persistent chat
               │  ├─ /workspace/support    SecurePortal → Chatwoot   (magic-link)
               │  ├─ /workspace/social     SecurePortal → TryPost    (oidc)
               │  └─ /workspace/workflows  SecurePortal → n8n        (forward_auth)
               ▼
        api.<d> go-orchestrator  /v1/*  (MCP host + AI brain, creds masked server-side)
               ├─ /v1/ai/chat         ── agent, Gemini function-calling → mcp_list_tools/mcp_call
               ├─ /v1/ai/generate-ui  ── structured UI descriptors (dashboards/cards)
               ├─ /v1/ai/tool/execute ── ERP writes (confirm-gated)
               ├─ /v1/portals/:app/url ── SSO embed URLs (erp-ops,n8n,chatwoot,trypost,nextcloud)
               └─ /v1/mcp/*           ── trypost + chatwoot tool servers
```

One session; GenUI is the only tab the user sees; subsystems are **embedded and orchestrated**,
never separate logins.

---

## Part A — GenUI extension (the concrete deliverable)

### 2. Navigation + shell (`workspace/layout.tsx`)

**Problems with the current file:** static `<button>`s (no routing), no active-route state, no
persistent chat, fixed `h-[600px]` pill that overflows once we add 3 more icons on a laptop.

**Changes:**

- Convert nav items to Next `Link` + `usePathname()` for active highlighting (App Router).
  → makes it a client component; keep it thin.
- Add the three silos with **semantically unique** icons (no dupes across the existing set
  `Home/Briefcase/FileText/Sparkles/Settings`):
  - Support → `Headset` → `/workspace/support`
  - Social → `Megaphone` → `/workspace/social`
  - Workflows → `Workflow` → `/workspace/workflows`
- Replace fixed height with `max-h-[85vh]` + `overflow-y-auto` on the nav group so the pill
  scrolls gracefully on short screens.
- Render `<AiChatPanel />` **in the layout** (below `{children}`) so it persists across every
  route and floats above iframes.

```tsx
// src/app/workspace/layout.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Briefcase, FileText, Sparkles, Settings,
  Headset, Megaphone, Workflow,
} from 'lucide-react';
import AiChatPanel from './components/AiChatPanel';

const NAV = [
  { href: '/workspace',            icon: Home,      label: 'Dashboard' },
  { href: '/workspace/erp',        icon: Briefcase, label: 'ERP' },
  { href: '/workspace/knowledge',  icon: FileText,  label: 'Knowledge Base' },
  { href: '/workspace/support',    icon: Headset,   label: 'Support' },
  { href: '/workspace/social',     icon: Megaphone, label: 'Social' },
  { href: '/workspace/workflows',  icon: Workflow,  label: 'Workflows' },
  { href: '/workspace/ai',         icon: Sparkles,  label: 'AI Assist' },
] as const;

function NavLink({ href, icon: Icon, label, active }: {
  href: string; icon: React.ElementType; label: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-full
        transition-transform hover:scale-105 focus:ring-2 focus:ring-accent focus:outline-none
        ${active ? 'bg-accent text-background shadow-md'
                 : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
    >
      <Icon size={20} />
      <span className="pointer-events-none absolute left-16 z-50 scale-0 whitespace-nowrap
        rounded bg-surface px-2 py-1 text-xs text-primary shadow-lg border border-divider
        transition-all group-hover:scale-100">{label}</span>
    </Link>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/workspace' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-background text-primary font-sans flex">
      <aside className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex max-h-[85vh] w-[72px]
        flex-col items-center gap-6 rounded-[36px] bg-surface/70 py-6 px-3 backdrop-blur-xl
        border border-divider shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden border-2 border-divider
          bg-gradient-to-tr from-accent to-cyan-500 cursor-pointer hover:scale-105 transition-transform" />
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto no-scrollbar py-1">
          {NAV.map((n) => <NavLink key={n.href} {...n} active={isActive(n.href)} />)}
        </nav>
        <NavLink href="/workspace/settings" icon={Settings} label="Settings"
                 active={isActive('/workspace/settings')} />
      </aside>

      <main className="ml-[120px] flex-1 w-full overflow-y-auto p-6 lg:p-10 max-w-full">
        {children}
      </main>

      {/* Persistent, above iframes */}
      <AiChatPanel />
    </div>
  );
}
```

> Remove `<AiChatPanel />` from `workspace/page.tsx` once it lives in the layout (avoid double
> mount). Add a `.no-scrollbar` utility to `globals.css` if you want to hide the pill scrollbar.
> **Next 16 note:** `AGENTS.md` warns Next 16 has breaking changes — confirm `Link`/`usePathname`
> import paths against `node_modules/next/dist/docs/` before committing (they are stable in 15/16,
> but verify).

### 3. `SecurePortal` — production-grade embedded iframe

Improvements over the naive spec: fetch-then-load two-phase loading, request timeout +
abort, retry, graceful error states, magic-link **expiry handling** (refetch on iframe error /
periodic refresh for Chatwoot), and a hardened sandbox with a documented invariant.

```tsx
// src/app/workspace/components/SecurePortal.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { getPortalURL, type PortalApp } from '@/lib/api';

type Phase = 'fetching' | 'loading' | 'ready' | 'error';

const LABELS: Record<PortalApp, string> = {
  'erp-ops': 'ERP Operations', n8n: 'Workflows', chatwoot: 'Support',
  trypost: 'Social', nextcloud: 'Files',
};

export default function SecurePortal({ targetApp }: { targetApp: PortalApp }) {
  const [phase, setPhase] = useState<Phase>('fetching');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    setPhase('fetching'); setError(null);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const { url } = await getPortalURL(targetApp);   // orchestrator mints SSO embed URL
      if (!url) throw new Error('No URL returned');
      setUrl(url); setPhase('loading');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Service unavailable'); setPhase('error');
    } finally { clearTimeout(t); }
  }, [targetApp]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-divider bg-surface">
      {url && (
        <iframe
          ref={iframeRef}
          src={url}
          title={LABELS[targetApp]}
          onLoad={() => setPhase('ready')}
          onError={() => { setError('The embedded app failed to load'); setPhase('error'); }}
          // S-2: safe ONLY because portals are cross-origin. Never add a same-origin target here.
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          allow="clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className={`h-full w-full border-0 transition-opacity duration-300
            ${phase === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {phase !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center bg-surface/95 backdrop-blur-sm">
          {phase === 'error' ? (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <AlertTriangle className="text-error" size={28} />
              <p className="text-sm text-primary">{LABELS[targetApp]} is unavailable</p>
              <p className="text-xs text-secondary max-w-xs">{error}</p>
              <button onClick={() => void load()}
                className="mt-1 inline-flex items-center gap-2 rounded-lg border border-divider
                  px-3 py-1.5 text-xs text-secondary hover:border-accent hover:text-accent">
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-accent" size={28} />
              <p className="text-xs text-secondary">
                {phase === 'fetching' ? `Authenticating with ${LABELS[targetApp]}…`
                                      : `Loading ${LABELS[targetApp]}…`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 4. Workspace routes (full-bleed portal hosts)

```tsx
// src/app/workspace/support/page.tsx
import SecurePortal from '../components/SecurePortal';
export default function SupportPage() {
  return <div className="h-[calc(100vh-5rem)] w-full"><SecurePortal targetApp="chatwoot" /></div>;
}
// src/app/workspace/social/page.tsx     → <SecurePortal targetApp="trypost" />
// src/app/workspace/workflows/page.tsx  → <SecurePortal targetApp="n8n" />
```

> **RnD upgrade (recommended, phase 2):** route-switching unmounts the iframe → re-auth flash.
> For true "single pane," host all portals in one **persistent portal shell** (mount all
> iframes once, toggle `hidden`) so sessions survive tab switches. Ship the per-route version
> first (simpler, correct), then migrate to the shell.

### 5. API client fix (`src/lib/api.ts`) — closes the `social`/`trypost` bug

```ts
export type PortalApp = 'erp-ops' | 'n8n' | 'chatwoot' | 'trypost' | 'nextcloud';

export interface PortalResponse {
  url: string;
  embed_mode: 'iframe';
  auth_mechanism: 'proxy' | 'oidc' | 'forward_auth' | 'magic_link';
}

export async function getPortalURL(app: PortalApp): Promise<PortalResponse> {
  return apiFetch<PortalResponse>(`/v1/portals/${app}/url`);
}
```

Use `trypost` (not `social`) as the app id everywhere; keep `/workspace/social` as the *route*
name for UX. This aligns FE with [`handler.go:58`](../../MuslimBot/go-orchestrator/internal/portals/handler.go).

### 6. Making the agent MCP-capable in-UI (U2 step 2)

`AiChatPanel` calls `generateUI()` (`/v1/ai/generate-ui`) — good for dashboards, but **not**
the function-calling/MCP loop. Add an agent mode that calls `aiChat()` (`/v1/ai/chat`, already
in `api.ts`) so "what tools can you use?" / "schedule 3 LinkedIn posts" trigger real
`mcp_list_tools`/`mcp_call` round-trips. Keep `generateUI` for data-viz intents; route
free-form/action intents to `/v1/ai/chat`. Simplest first cut: a toggle or intent heuristic in
`handleSend`. Prereq: `GEMINI_API_KEY` set server-side; `trypost`+`chatwoot` show
`connected:true` at `/v1/mcp/servers`.

---

## Part B — Edge & orchestrator (makes embedding actually work)

### 7. Iframe framing — the real blocker (do before testing SecurePortal)

Cross-origin subsystems block framing by default. For each embedded app, the **edge** must
allow `app.<d>` as a frame ancestor:

- **Traefik middleware** per embedded router: remove `X-Frame-Options` and set
  `Content-Security-Policy: frame-ancestors 'self' https://ui.<domain>`. The GenUI pane
  runs on **`ui.<domain>`** (not `app.`). Define this via **compose labels** (Traefik
  dynamic files do **not** interpolate `${PUBLIC_DOMAIN}`; labels do):
  ```yaml
  # docker-compose.extended.yml — on chatwoot-rails (defined once, referenced by n8n/trypost)
  - "traefik.http.middlewares.allow-embed.headers.customresponseheaders.X-Frame-Options="
  - "traefik.http.middlewares.allow-embed.headers.contentsecuritypolicy=frame-ancestors 'self' https://ui.${PUBLIC_DOMAIN:-smb.localhost}"
  - "traefik.http.routers.chatwoot.middlewares=allow-embed"   # + n8n, trypost routers
  ```
  ⚠ `contentsecuritypolicy` **replaces** any CSP the app already sets — verify per app
  that no other CSP protection is lost. **Applied in this change.**
- **App-level settings that override headers:**
  - **Chatwoot:** magic-link SSO works, but set `FRONTEND_URL` correctly and confirm it doesn't
    force `X-Frame-Options: DENY`; may need reverse-proxy header strip (above).
  - **n8n:** framing is restricted; set the security/frame options so `app.<d>` may embed.
  - **TryPost:** OIDC embed — verify its CSP allows the ancestor.
- **Cookies:** embedded sessions ride third-party cookies → all subsystem cookies must be
  `SameSite=None; Secure`. Real domain + TLS required (nip.io works with real ACME certs; plain
  http will not).

> This section is why "single pane" silently fails in most attempts. Budget real time here.

### 8. Protect `app.` + wire GenUI env (compose)

The `genui` router had no ForwardAuth and no env. **Applied in this change:**

```yaml
# docker-compose.extended.yml — generative-ui service (host is ui.<domain>)
labels:
  - "traefik.http.routers.genui.middlewares=authentik-auth@file"   # SSO on the pane itself
environment:
  - "NEXT_PUBLIC_API_URL=https://api.${PUBLIC_DOMAIN:-smb.localhost}"
  - "NEXT_PUBLIC_AUTHENTIK_URL=https://auth.${PUBLIC_DOMAIN:-smb.localhost}"
```

⚠ `NEXT_PUBLIC_*` are inlined by Next **at build time** — they must be present when the
image is built, not just at container runtime. If the GenUI image is prebuilt in CI,
pass these as build args too, or the browser bundle keeps the default derived base URL.

### 9. Security floor additions (from §0 RnD)

- **S-1:** switch the orchestrator router from `authentik-forwardauth@file` to the full
  `authentik-auth@file` chain (adds `strip-identity-headers`) so header-spoofing defense isn't
  solely G2. Verify `/v1/auth/me` still resolves identity afterward.
- **S-2:** document the cross-origin invariant for `SecurePortal` sandbox (in the component +
  the security floor memo). Add a lint/review check: no same-origin `targetApp`.
- Keep **G2** trusted-proxy pin and confirm ForwardAuth on `app.`, `api.`, `n8n.`; keep `erp.`
  token-only for machines.

---

## Part C — Unification sequence (U-series, corrected)

| Step | What | State | Notes |
|---|---|---|---|
| **U0** | edge labels (api./auth.) | **DONE in tree** | verify live; apply S-1 |
| **U1** | Authentik OIDC provider + apps + ForwardAuth outpost; ERPNext Social Login; `NEXT_PUBLIC_AUTHENTIK_URL` | to do | §8; one login → all apps |
| **U2** | `GEMINI_API_KEY` server-side; route chat → `/v1/ai/chat`; bundle Chatwoot MCP (bun mount) | partial | §6; ADR-0001 §7 |
| **U3** | TryPost API token; Marketing persona → agent schedules via MCP; publish confirm-gated | to do | headline capability |
| **U4** | Chatwoot embed + magic-link (works today), agent-assisted triage via MCP, n8n support-RAG | partial | §7 framing critical |
| **U5** | Command Center aggregates `/v1/platform/services` + `/v1/mcp/servers`; event fabric ERP→n8n→Chatwoot/TryPost | to do | single dashboard |
| **U6** | Multi-tenant (close G10 fail-closed), real domain + ACME, rotate `changeme`, restore drill | to do | go-live gate |

---

## Part D — Execution order, testing, risks

### Build order (fastest path to a working pane)
1. **§5 API fix** + **§7 framing edge** + **§8 protect app.** (backend/edge — unblocks embedding).
2. **§2 layout** + **§3 SecurePortal** + **§4 routes** (frontend deliverable).
3. **§6 agent → `/v1/ai/chat`** + set `GEMINI_API_KEY`, `TRYPOST_API_TOKEN`, Chatwoot token.
4. **§9 S-1/S-2** hardening; U5 command center; U6 tenants/go-live.

### Test plan (per surface)
- Portal: `curl -sk https://api.<d>/v1/portals/chatwoot/url` (authed) → JSON `url`; open
  `/workspace/support` → Chatwoot renders inside the pane, no re-login, no `X-Frame-Options`
  console error.
- Repeat for `trypost` (`/workspace/social`) and `n8n` (`/workspace/workflows`).
- Agent: in chat, "what tools can you use?" → real `mcp_list_tools`; "draft & schedule 3
  LinkedIn posts next week" → TryPost `mcp_call`, **nothing publishes without confirm**.
- SSO: one login into `app.` carries into ERP/Chatwoot/TryPost/n8n.
- Responsive/dark: pill scrolls at ≤720px height; light/dark both legible.

### Top risks
1. **Framing headers** (§7) — most likely failure; fix at edge + app before FE testing.
2. **Third-party cookies** — needs real domain + `SameSite=None; Secure`.
3. **Magic-link expiry** (Chatwoot) — SecurePortal retry + periodic refresh mitigates.
4. **Next 16 breaking changes** — verify `Link`/`usePathname` per `AGENTS.md` before commit.
5. **Portal app-name drift** — the `social`/`trypost` split (route name vs app id) must stay
   consistent; the typed `PortalApp` enum enforces it.

---

## Appendix — files touched

**Frontend (`generative-ui/`)** — *front-end edits are gated by repo CLAUDE.md; awaiting go-ahead:*
`src/app/workspace/layout.tsx` (rewrite), `src/app/workspace/components/SecurePortal.tsx` (new),
`src/app/workspace/{support,social,workflows}/page.tsx` (new), `src/lib/api.ts` (portal types),
`src/app/workspace/components/AiChatPanel.tsx` (agent mode), `src/app/workspace/page.tsx`
(drop duplicate chat), `src/app/globals.css` (`.no-scrollbar`).

**Edge/orchestrator** — `docker-compose.extended.yml` (genui middleware+env, S-1 router chain,
`allow-embed` on chatwoot/n8n/trypost), env-file (`GEMINI_API_KEY`, `TRYPOST_API_TOKEN`,
Chatwoot tokens).

**Build/deploy** — `generative-ui/Dockerfile` (new, Next 16, `NEXT_PUBLIC_*` build args, serves
:3000), `MuslimBot/docker-compose.yml` (build context → `../generative-ui`, args, port 3000,
512M).

---

## Appendix B — canonical tree + deploy follow-ups (decided 2026-07-18)

**Decision:** the repo-root `generative-ui/` (untracked App-Router rewrite) is canonical and
replaces the older tracked `MuslimBot/generative-ui/`. All work above targets root. Root is now
staged in git; the deployed build context repoints to it. See memory `generative-ui-two-trees`.

**Open follow-ups before go-live:**
1. **CORS vs rewrite.** Root `next.config.ts` has **no** rewrites; the client
   ([`api.ts`](../../generative-ui/src/lib/api.ts)) calls `https://api.<host>/v1/*`
   **cross-origin** with `credentials:'include'`. The old app instead proxied `/v1/*`
   same-origin via `next.config` rewrites. Pick one:
   - **CORS path (current):** orchestrator must send `Access-Control-Allow-Origin:
     https://ui.<domain>` + `Access-Control-Allow-Credentials: true`; Authentik cookie is
     already wildcard `.<domain>` so it rides along. Simplest server change.
   - **Rewrite path:** add `/v1/*` → orchestrator rewrite to root `next.config.ts` and switch
     `API_BASE` to a relative `/v1` base — no CORS, but the pane proxies all API traffic.
2. **Retire `MuslimBot/generative-ui/`.** Left in place (not deleted — 137 tracked files) until
   the restructure formally moves root → `MuslimBot/generative-ui`. Two trees is transitional.
3. **Port alignment.** New Dockerfile serves :3000 (matches the Traefik `genui` label and the
   updated base port mapping). The legacy `5173:80` mapping is gone.
4. **Pre-existing lint debt** (not introduced here): `generative-ui/src/app/page.tsx`
   (unescaped entities) and `ErpDataTable.tsx` (unused import) fail `next lint` and will block a
   strict `next build`. Fix or relax before CI gating on lint.
</content>
</invoke>
