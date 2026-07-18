# MuslimBot GCP Infrastructure

This directory contains the Terraform code to provision the Sovereign Cloud infrastructure for the MuslimBot system.

## Choose the correct root module

This directory contains two independent Terraform root modules. Each has its
own resources and state; do not run commands from the wrong directory.

| Module | Directory | Purpose |
|---|---|---|
| Single host (current) | [`single-host/`](single-host/) | One 8 vCPU / 32 GB GCE VM with a dedicated PD-SSD for the full Compose stack |
| Two node (legacy) | this directory | Separate core and telephony VMs |

For new single-VM deployments, start with the
**[single-host module guide](single-host/README.md)**.

Operational documentation:

- [Single-host provisioning and usage](single-host/README.md)
- [Terraform state management and infrastructure destruction](single-host/STATE_AND_DESTROY.md)
- [Docker Compose reference](../../COMPOSE.md)
- [Full VM deployment plan](../docs/production/VM_DEPLOYMENT_PLAN.md)

The remaining sections describe the legacy two-node module in this directory.

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
