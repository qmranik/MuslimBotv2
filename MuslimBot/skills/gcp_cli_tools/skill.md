# Skill: gcp_cli_tools

## Description
This skill provides instructions for utilizing the Google Cloud Platform (GCP) CLI (`gcloud`) effectively within the MuslimBot ecosystem. It is designed to help agents safely manage and query cloud resources, specifically for the MuslimBot sovereign deployment.

## Prerequisites
- Authenticated `gcloud` session (`gcloud auth login` or via Service Account).
- Correct project set: `gcloud config set project <your_project_id>`.

## Common Operations

### 1. Compute Instances
- **List VM Instances:** 
  `gcloud compute instances list`
- **View Telephony Node IP:**
  `gcloud compute instances describe telephony-node --format='get(networkInterfaces[0].accessConfigs[0].natIP)'`

### 2. Secret Manager
- **List Secrets:**
  `gcloud secrets list`
- **Access a Secret Value (e.g., DB Password):**
  `gcloud secrets versions access latest --secret="mariadb-root-password"`

### 3. Networking & Firewalls
- **Check Firewall Rules for SIP/RTP:**
  `gcloud compute firewall-rules list --filter="name~'muslimbot-voice'"`

## Safety Guardrails
- **Read-Only Default:** Prefer `list` and `describe` commands to gather context.
- **Do Not Manually Mutate Infrastructure:** Avoid using `gcloud compute instances create` or `gcloud compute firewall-rules create`. All infrastructure state must be managed via Terraform (see the `terraform_infrastructure` skill). Use `gcloud` only for ad-hoc querying or emergency interventions.