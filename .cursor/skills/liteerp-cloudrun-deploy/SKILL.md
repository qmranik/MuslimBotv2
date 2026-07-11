---
name: liteerp-cloudrun-deploy
description: Deploy the liteERP Agent BFF to Google Cloud Run, optionally driven agentically through the GCP Cloud Run MCP server. Use when the user wants to deploy, provision, or ship the BFF to GCP, enable Cloud Run/Cloud Build/Secret Manager APIs, store Frappe ERP secrets in Secret Manager, build the container image, or map an ingress DNS.
disable-model-invocation: true
---

# Deploy liteERP Agent to Google Cloud Run

Two paths: drive it agentically via the **`cloud-run` MCP server** (configured in `.cursor/mcp.json`), or run the `gcloud` CLI directly. Prefer the MCP server when the user asks the agent to provision/deploy.

## Step 1 — Authenticate gcloud

```bash
gcloud auth login
gcloud auth application-default login          # required for the cloud-run MCP server (ADC)
gcloud config set project <YOUR_PROJECT_ID>
export GOOGLE_CLOUD_PROJECT=<YOUR_PROJECT_ID>
export GOOGLE_CLOUD_REGION=us-central1
```

## Step 2 — Provision & deploy

Trigger from `GCP_DEPLOYMENT_PLAN.md` if present. The agent (or operator) performs:

```bash
# Enable services
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

# Store backend secrets (keeps tokens out of terminal logs / image)
printf '%s' "$FRAPPE_API_KEY"    | gcloud secrets create FRAPPE_API_KEY    --data-file=- 2>/dev/null \
  || printf '%s' "$FRAPPE_API_KEY"    | gcloud secrets versions add FRAPPE_API_KEY    --data-file=-
printf '%s' "$FRAPPE_API_SECRET" | gcloud secrets create FRAPPE_API_SECRET --data-file=- 2>/dev/null \
  || printf '%s' "$FRAPPE_API_SECRET" | gcloud secrets versions add FRAPPE_API_SECRET --data-file=-

# Build the container image on Cloud Build
gcloud builds submit --config=cloudbuild.yaml .

# Deploy a stateless Cloud Run service reading secrets dynamically
gcloud run deploy liteerp-bff \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/liteerp-bff \
  --region $GOOGLE_CLOUD_REGION \
  --platform managed \
  --update-secrets=FRAPPE_API_KEY=FRAPPE_API_KEY:latest,FRAPPE_API_SECRET=FRAPPE_API_SECRET:latest \
  --allow-unauthenticated
```

## Driving it via the cloud-run MCP server

When the `cloud-run` MCP server is connected, ask the agent to: list projects/services, deploy a local source dir or image, and read service logs — instead of running raw `gcloud`. The server uses Application Default Credentials, so Step 1's `application-default login` is required.

## Safety

- Never print secret values; pipe them with `--data-file=-`.
- Keep `FRAPPE_*`, `GEMINI_API_KEY`, and Stripe keys in Secret Manager — never baked into the image or committed.
- Confirm `--allow-unauthenticated` is intended; for an internal BFF prefer Firebase/IAM-gated ingress.
