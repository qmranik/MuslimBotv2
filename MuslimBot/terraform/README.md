# MuslimBot GCP Infrastructure

This directory contains the Terraform code to provision the Sovereign Cloud infrastructure for the MuslimBot system.

## Architecture

*   **VPC & Subnets:** Custom network isolating internal traffic.
*   **Core Node (`e2-standard-4`):** Runs the heavy lifting (Frappe ERP, Go Orchestrator, Generative UI, n8n, MariaDB). Exposed only on ports 80/443 via Traefik.
*   **Telephony Node (`e2-small`):** Dedicated node for Asterisk and LiveKit Server. Separating this ensures RTP media traffic doesn't contend with ERP database locks. Exposed on SIP (5060) and RTP UDP port ranges.
*   **Secret Manager:** Secure storage for database passwords and API keys, accessible by the VMs via IAM Service Accounts (no hardcoded keys).

## Provisioning

1.  Set your GCP project:
    ```bash
    export TF_VAR_project_id="your-gcp-project-id"
    ```
2.  Initialize Terraform:
    ```bash
    terraform init
    ```
3.  Plan the infrastructure:
    ```bash
    terraform plan -out=tfplan
    ```
4.  Apply the infrastructure:
    ```bash
    terraform apply "tfplan"
    ```

## Post-Provisioning

Once the VMs are up, the Docker daemon is automatically installed via the startup scripts. 
You will need to clone the repository onto the instances and run:
`docker compose -f docker-compose.gcp.yml up -d`
