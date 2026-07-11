---
name: gcp_cloud_engineer
description: GCP Cloud Engineer skill for provisioning networking, IAM, and infrastructure for the liteERP environment.
---

# GCP Cloud Engineer Skill

## Instructions
1. Audit the current GCP environment for VPCs, Subnets, and Firewall rules.
2. When requested to provision infrastructure, use Infrastructure as Code (e.g., Terraform) or `gcloud` CLI commands.
3. Configure Cloud DNS for multi-tenant routing (e.g., `*.smb.co`) and link it to the Traefik ingress.
4. Provision Cloud Storage buckets for backups and set up automated lifecycle policies.
5. Manage IAM bindings: Ensure strict least-privilege access for service accounts running the MCP servers and application containers.
