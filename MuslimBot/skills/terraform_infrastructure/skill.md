# Skill: terraform_infrastructure

## Description
Instructions for managing the MuslimBot sovereign GCP infrastructure via Terraform. This skill ensures Infrastructure as Code (IaC) principles are maintained, avoiding drift.

## System Components Managed by Terraform
- **Networking:** Custom VPC, Subnets, Static IP allocations.
- **Compute:** `core-node` (ERP, Orchestrator, n8n) and `telephony-node` (LiveKit, Asterisk).
- **Security:** Strict firewall rules (SIP, RTP, Web) and IAM roles.
- **Secrets:** GCP Secret Manager integration.
- **Storage:** GCS buckets for call recordings and RAG data.

## Workflow

### 1. Initialization
Run this when working in the `terraform/` directory for the first time or when adding providers.
```bash
cd terraform/
terraform init
```

### 2. Planning (Always do this first)
Before applying any change, generate a plan and save it to a file.
```bash
terraform plan -out=tfplan
```
*Agent Review Step:* Review the output of the plan. Ensure no critical resources (like the DB instance or Telephony IP) are being destroyed unexpectedly.

### 3. Applying
Only apply after the plan has been reviewed and approved.
```bash
terraform apply "tfplan"
```

## Guardrails
- **State Files:** Never modify the `.tfstate` files manually.
- **Secrets:** Never hardcode secrets in `.tf` files. Pass them via environment variables (`TF_VAR_db_password`) or rely on Terraform generating and pushing them to GCP Secret Manager.