# Portal iframe embedding (Admin OS)

External workspaces (n8n, Chatwoot, Postiz, liteERP /ops) load inside `SecurePortal` iframes. Some services block embedding via response headers.

## Traefik middleware (SaaS / demo)

When using Traefik with `*.smb.localhost`, apply a middleware to strip or override frame-blocking headers on portal backends:

```yaml
http:
  middlewares:
    strip-frame-headers:
      headers:
        customResponseHeaders:
          X-Frame-Options: ""
          Content-Security-Policy: "frame-ancestors 'self' http://localhost:5173 http://*.smb.localhost;"
```

Attach `strip-frame-headers` to routers for:

- `workflow.smb.localhost` (n8n)
- `support.smb.localhost` (Chatwoot)
- `social.smb.localhost` (Postiz)
- `ops.smb.localhost` (Frappe /ops)

## Local development

Default URLs in `generative-ui/.env.template` point to localhost ports. If embed fails, use the **Open externally** link in `SecurePortal`.

Optional Vite dev proxies (`/portal/n8n`, etc.) can same-origin iframe targets — see `vite.config.js`.

## postMessage bridge

Child apps may post:

- `{ type: 'WORKFLOW_SAVED' }`
- `{ type: 'ERP_MUTATION_COMPLETE' }`

The shell dispatches `erp:cache:invalidate` to refresh Command Center data and Gemini ERP cache.

Allowed origins: `VITE_PORTAL_ALLOWED_ORIGINS` (default includes `localhost`, `.smb.localhost`).
