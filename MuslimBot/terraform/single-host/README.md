# MuslimBot Single-Host GCP

This is the current Terraform root module for running MuslimBot on one Google
Compute Engine VM in India. It provisions:

- one custom VPC and public subnet;
- a regional static external IP;
- ingress for SSH, HTTP/HTTPS, and the required LiveKit TCP/UDP ports;
- one Ubuntu 22.04 LTS minimal VM;
- one dedicated persistent data disk;
- a VM service account with Secret Manager read access.

The module provisions infrastructure only. Cloning the repository, creating
the application `.env`, and starting Docker Compose are separate deployment
steps.

## Documentation

- [State management and full infrastructure destruction](STATE_AND_DESTROY.md)
- [Canonical Docker Compose reference](../../../COMPOSE.md)
- [Full VM deployment plan](../../docs/production/VM_DEPLOYMENT_PLAN.md)
- [GCP deployment roadmap](../../docs/production/GCP_DEPLOYMENT_ROADMAP.md)

## Profiles

Full production-capacity defaults:

```hcl
machine_type   = "e2-standard-8"
data_disk_type = "pd-ssd"
```

Low/MVP overrides:

```hcl
machine_type   = "e2-standard-4"
data_disk_type = "pd-balanced"
```

The Low profile requires strict Docker memory limits and is not intended for
heavy concurrent voice, support, and background processing.

## Provision

Authenticate and select the intended project:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project gen-lang-client-0113022969
gcloud config set project gen-lang-client-0113022969

gcloud services enable \
  compute.googleapis.com \
  iam.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com
```

Initialize, review, and apply:

```bash
cd MuslimBot/terraform/single-host
terraform init
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Do not reuse a saved plan after changing variables, configuration, credentials,
or state. Generate a new plan.

## Connect

```bash
gcloud compute ssh \
  "$(terraform output -raw instance_name)" \
  --zone="$(terraform output -raw zone)" \
  --project=gen-lang-client-0113022969
```

After the startup script finishes:

```bash
df -h /opt/muslimbot/data
docker --version
docker compose version
```

## Inspect

```bash
terraform output
terraform state list
terraform state show google_compute_instance.host
terraform plan -refresh-only
```

## Destroy

Do not destroy from a different Terraform root directory. Back up application
data and read the complete runbook first:

**[State management and full infrastructure destruction](STATE_AND_DESTROY.md)**

The abbreviated flow is:

```bash
cd MuslimBot/terraform/single-host
terraform plan -destroy -out=destroy.tfplan
terraform show destroy.tfplan
terraform apply destroy.tfplan
```

This deletes the persistent data disk as well as the VM.

## Module boundary

`MuslimBot/terraform/` is a separate, legacy two-node Terraform root module.
It has different resources, defaults, and state. Never run its plan or destroy
commands when intending to manage this single-host deployment.
