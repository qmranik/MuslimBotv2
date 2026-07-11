---
name: gcp-cli-mcp
description: Manage Google Cloud for the liteERP Agent using the gcloud CLI and the GCP MCP servers (cloud-run). Use when working with GCP — authenticating, setting a project, enabling APIs, managing Cloud Run / Cloud Build / Secret Manager / Artifact Registry / logs, or when the user asks the agent to provision, deploy, or inspect GCP resources agentically.
---

# Manage GCP via CLI + MCP

Two interfaces are available; pick deliberately.

| Use the `cloud-run` MCP server when… | Use `gcloud` CLI when… |
|---|---|
| Listing projects/services, deploying source/image, reading service logs agentically | gcloud is installed and you need APIs/IAM/Secret Manager/Artifact Registry not covered by MCP |
| You want the agent to drive deploys without shelling out | Scripting, CI, or fine-grained flags |

The `cloud-run` MCP server is wired in `.cursor/mcp.json` and uses Application Default Credentials (ADC).

## Prerequisites

`gcloud` may not be installed. Install on macOS:

```bash
brew install --cask google-cloud-sdk      # or: https://cloud.google.com/sdk/docs/install
```

Authenticate (do both — user creds for CLI, ADC for the MCP server):

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project <PROJECT_ID>
export GOOGLE_CLOUD_PROJECT=<PROJECT_ID>
export GOOGLE_CLOUD_REGION=us-central1
```

## Common operations (liteERP BFF)

```bash
# Enable required services
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com artifactregistry.googleapis.com

# Secrets — pipe values, never echo them
printf '%s' "$FRAPPE_API_KEY" | gcloud secrets create FRAPPE_API_KEY --data-file=- 2>/dev/null \
  || printf '%s' "$FRAPPE_API_KEY" | gcloud secrets versions add FRAPPE_API_KEY --data-file=-

# Build + deploy
gcloud builds submit --config=cloudbuild.yaml .
gcloud run deploy liteerp-bff \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/liteerp-bff \
  --region $GOOGLE_CLOUD_REGION --platform managed \
  --update-secrets=FRAPPE_API_KEY=FRAPPE_API_KEY:latest,FRAPPE_API_SECRET=FRAPPE_API_SECRET:latest

# Inspect
gcloud run services list --region $GOOGLE_CLOUD_REGION
gcloud run services describe liteerp-bff --region $GOOGLE_CLOUD_REGION
gcloud beta run services logs read liteerp-bff --region $GOOGLE_CLOUD_REGION --limit 100
```

## Guidance

- Prefer the `cloud-run` MCP server for deploy/list/logs when the user asks the agent to "manage GCP"; fall back to `gcloud` for APIs, IAM, and Secret Manager.
- Keep all secrets (`FRAPPE_*`, `GEMINI_API_KEY`, Stripe) in Secret Manager; never bake into images or commit.
- Always confirm `--region`/`--project` before mutating; show the user the resolved target.
- For destructive actions (`delete`, `--force`, traffic shifts), state the impact and get explicit confirmation first.
- The `user-azure-mcp` server is for Azure, not GCP — do not use it for GCP tasks.

## Related skills

- For the full BFF deploy flow, see the `liteerp-cloudrun-deploy` skill.
