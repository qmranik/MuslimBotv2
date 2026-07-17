# TryPost MCP (social scheduling)

Social scheduling for MuslimBot, replacing Postiz. Upstream:
[`trypostit/trypost`](https://github.com/trypostit/trypost) (AGPL; Laravel 13 + Vue 3 +
Horizon). TryPost ships a **first-class MCP server + REST API**, so the go-orchestrator
ingests its MCP directly — the GenUI AI can draft, schedule, publish, and read analytics
across 12 networks (LinkedIn, X, Facebook, Instagram, TikTok, YouTube, Threads,
Pinterest, Bluesky, Mastodon, Telegram, Discord) with **no hand-written API tool wrappers**.

Registered in [`../registry.yaml`](../registry.yaml).

## Transport
**HTTP** (Streamable HTTP). The orchestrator connects as an MCP client to
`TRYPOST_MCP_URL` = `<trypost-host>/mcp/trypost`, authenticating with
`Authorization: Bearer <TRYPOST_API_TOKEN>` (API key from **Settings → API Keys**).
Inside the platform network this is `http://trypost/mcp/trypost`.

> Source: <https://docs.trypost.it/ai/introduction> (OAuth 2.1 is the primary auth;
> bearer token is the server-to-server fallback we use). Self-hosted MCP requires the
> app deployed (see `docker-compose.extended.yml`).

## Configuration (env only)
| Var | Purpose |
|---|---|
| `TRYPOST_URL` | embeddable portal URL (GenUI iframe / portals handler) |
| `TRYPOST_MCP_URL` | TryPost MCP HTTP endpoint (required when `TRYPOST_MCP_ENABLED=true`) |
| `TRYPOST_API_TOKEN` | bearer token for MCP/REST (required when enabled; fail loud) |

## Deployment
TryPost is a multi-container Laravel app — deploy from the **upstream self-host
compose** rather than an invented service block, then attach it to `smb-net` and set
the env above. See ADR-0001 for the wiring plan.

## Status
Scaffold only; MCP host runtime + compose wiring are the ADR-0001 follow-up.
