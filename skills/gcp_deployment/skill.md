---
name: gcp_deployment
description: Handles the deployment of the liteERP stack and MCP servers to Google Cloud Platform.
---

# GCP Deployment Skill

## Instructions
1. Verify the current GCP project context using `gcloud config get-value project`.
2. Ensure the required `.env` variables are securely fetched from GCP Secret Manager (do not read local `.env` files if secrets are sensitive).
3. Use GCP compute resources (Compute Engine or GKE) to deploy the core liteERP stack, including ERPNext, Traefik, MariaDB, and Redis.
4. Deploy the MCP servers in a secure, isolated VPC to ensure they are protected and only accessible via authenticated channels.
5. Output the public IP addresses or Cloud DNS names assigned to the Traefik load balancer and other public-facing services.
