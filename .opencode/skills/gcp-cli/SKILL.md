---
name: gcp-cli
description: Provision and manage Google Cloud Platform infrastructure via gcloud.
license: MIT
---
## What I do
- Provision compute instances (VMs) using `gcloud compute instances create`.
- Configure firewall rules for web traffic and custom ports.
- Retrieve deployment status and SSH keys.

## When to use me
Use this skill when the user asks to deploy infrastructure, open ports, or configure Google Cloud resources.

## Architectural Best Practices
- Target: Default to `e2-standard-4` (4 vCPUs, 16GB RAM) to support the unified ERPNext, n8n, Chatwoot, and Postiz Docker Compose stack.
- Network: Ensure ports 80 (HTTP) and 443 (HTTPS) are explicitly opened via `gcloud compute firewall-rules create`.
- Execution: Always format `gcloud` commands as executable bash scripts.