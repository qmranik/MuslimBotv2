---
name: mvt-silo-verify
description: >-
  Verifies MuslimBot MVT Silo A (ERP + GenUI) and Silo B (Chatwoot + n8n) using
  frappe-dev MCP, postgres-mcp, and IronBee browser. Use when validating
  low-stock GenUI, Chatwoot webhooks, or cloud-offloaded stacks on an 8GB Mac.
disable-model-invocation: true
---

# MVT Silo Verify

Run acceptance against Silo A and/or Silo B. Prefer IronBee browser MCP for UI; never use Cursor built-in browser or `playwright-mcp` when IronBee is available.

## Prerequisites

- Cloud DBs provisioned (`mvt-cloud-offload`) or local fallback DBs up.
- For Silo A: Frappe + native Go (`ENV=local`) + native GenUI.
- For Silo B: Chatwoot + n8n (ERP mocked in n8n).

## Checklist

### 1. Auth bypass

```bash
curl -sS http://localhost:8080/v1/auth/me
```

Expect Administrator mock and `"auth":"local-bypass"` when `ENV=local` and no Authentik headers.

With `ENV` unset, the same request must return 401.

### 2. Neon / Postgres

- Set `DATABASE_URL` to Neon pooled URI.
- Use `postgres-mcp` (or Neon MCP) for `SELECT 1` and Chatwoot schema presence after migrate.

### 3. Frappe (Silo A)

- Use `frappe-dev` MCP against the running site for inventory / low-stock API.
- If empty, use `frappe-state` MCP (or silo install helpers) to seed demo items/stock.

### 4. GenUI (Silo A) — IronBee only

1. `GetMcpTools` on IronBee browser server (`user-ironbee-ai…ironbee-dt-browser` or project `browser-devtools`).
2. Navigate to GenUI Command Center.
3. Exercise “Fetch low stock items” (or equivalent chat prompt).
4. `a11y_take-aria-snapshot` then `content_take-screenshot` if visual check needed.
5. Check console for errors.

Prefer one `execute` batch for multi-step UI flows.

### 5. Silo B

1. Confirm Chatwoot UI loads (IronBee).
2. Send a test inbox message that hits the n8n webhook.
3. Confirm n8n execution and static ERP mock JSON path (see [test-silos/mvt-b_chatwoot_n8n.md](../../../test-silos/mvt-b_chatwoot_n8n.md)).

### 6. Optional full gate

Invoke skill `ironbee-verify` with scenario path:

- `test-silos/mvt-a_erp_genui.md` for Silo A
- `test-silos/mvt-b_chatwoot_n8n.md` for Silo B

## Pass criteria

| Silo | Pass when |
|---|---|
| A | `/v1/auth/me` local-bypass works; GenUI returns low-stock (or inventory) data from Frappe |
| B | Chatwoot message reaches n8n; mock ERP node runs; reply/handoff path observed |
| Memory | `docker stats` under ~4.5 GB with cloud DBs |

## Related

- [docs/MVT_8GB_M1.md](../../../docs/MVT_8GB_M1.md)
- [test-silos/mvt-a_erp_genui.md](../../../test-silos/mvt-a_erp_genui.md)
- [test-silos/mvt-b_chatwoot_n8n.md](../../../test-silos/mvt-b_chatwoot_n8n.md)
