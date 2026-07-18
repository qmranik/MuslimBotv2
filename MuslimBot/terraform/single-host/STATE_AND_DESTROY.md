# Terraform State and Infrastructure Destruction

This runbook covers the MuslimBot single-host module in this directory. Run all
Terraform commands from `MuslimBot/terraform/single-host`.

> `terraform destroy` permanently deletes the VM, its attached data disk, static
> IP, firewall rules, subnet, VPC, service account, and IAM binding. Back up
> application data before continuing.

## Current state model

The module currently uses Terraform's local backend because the GCS backend in
`main.tf` is commented out.

```text
single-host/
├── terraform.tfstate          # Current source of truth (local, never commit)
├── terraform.tfstate.backup   # Previous local state snapshot
├── .terraform.lock.hcl        # Provider version lock (commit this)
├── main.tf
├── variables.tf
└── outputs.tf
```

The initial deployment manages these resource addresses:

```text
google_compute_address.host
google_compute_disk.data
google_compute_firewall.allow_livekit
google_compute_firewall.allow_ssh
google_compute_firewall.allow_web
google_compute_instance.host
google_compute_network.vpc
google_compute_subnetwork.public
google_project_iam_member.host_secret_accessor
google_service_account.host
```

Inspect the live state rather than relying on this static list:

```bash
cd MuslimBot/terraform/single-host
terraform state list
terraform output
terraform state show google_compute_instance.host
```

The state is currently held only on the machine from which Terraform was
applied. Losing it would leave the GCP resources running but unmanaged.

## Before destroying

### 1. Stop application writes

SSH to the host and stop the Compose stack without deleting its volumes:

```bash
cd /opt/muslimbot/repo/MuslimBot
docker compose --profile support --profile voice down
```

Never use `docker compose down -v` on a host whose data must be retained.

### 2. Snapshot the data disk

Obtain names from Terraform instead of hard-coding them:

```bash
PROJECT_ID="gen-lang-client-0113022969"
DISK_NAME="$(terraform output -raw data_disk_name)"
ZONE="$(terraform output -raw zone)"
SNAPSHOT_NAME="${DISK_NAME}-predestroy-$(date +%Y%m%d-%H%M%S)"

gcloud compute disks snapshot "$DISK_NAME" \
  --project="$PROJECT_ID" \
  --zone="$ZONE" \
  --snapshot-names="$SNAPSHOT_NAME"
```

Confirm the snapshot is ready:

```bash
gcloud compute snapshots describe "$SNAPSHOT_NAME" \
  --project="$PROJECT_ID" \
  --format='value(status)'
```

A disk snapshot is crash-consistent, not a substitute for tested MariaDB and
PostgreSQL logical backups.

### 3. Back up local Terraform state

```bash
cp terraform.tfstate \
  "terraform.tfstate.pre-destroy.$(date +%Y%m%d-%H%M%S)"
```

Store the copy securely. State can contain infrastructure metadata and
sensitive values.

## Preview and destroy all resources

Refresh state and review the exact deletion plan:

```bash
terraform init
terraform plan -destroy -out=destroy.tfplan
terraform show destroy.tfplan
```

For the original complete deployment, the summary should normally report ten
resources to destroy. Do not apply if the plan unexpectedly replaces, creates,
or omits resources.

Apply the reviewed plan:

```bash
terraform apply destroy.tfplan
```

Alternatively, Terraform can generate and confirm the destroy interactively:

```bash
terraform destroy
```

Use `-auto-approve` only in controlled automation:

```bash
terraform destroy -auto-approve
```

Terraform determines the dependency-safe deletion order automatically. The VM
is removed before the disk, subnet, network, service account, and related
dependencies.

## Verify destruction

Terraform state should be empty:

```bash
terraform state list
terraform plan
```

The final plan should report no changes. Confirm important GCP resource classes
as an independent check:

```bash
PROJECT_ID="gen-lang-client-0113022969"

gcloud compute instances list --project="$PROJECT_ID"
gcloud compute disks list --project="$PROJECT_ID"
gcloud compute addresses list --project="$PROJECT_ID"
gcloud compute firewall-rules list \
  --project="$PROJECT_ID" \
  --filter='name~^muslimbot-'
gcloud compute networks list \
  --project="$PROJECT_ID" \
  --filter='name~^muslimbot-'
gcloud iam service-accounts list \
  --project="$PROJECT_ID" \
  --filter='email:muslimbot-host-sa-'
```

Snapshots are separate GCP resources and are intentionally not managed or
deleted by this module:

```bash
gcloud compute snapshots list --project="$PROJECT_ID"
```

## Stop costs without destroying data

To suspend compute while retaining the VM configuration and data disk:

```bash
gcloud compute instances stop \
  "$(terraform output -raw instance_name)" \
  --zone="$(terraform output -raw zone)" \
  --project="gen-lang-client-0113022969"
```

The stopped VM no longer incurs vCPU/RAM charges, but disks, snapshots, and
some IP configurations can continue to incur charges.

Avoid routine use of `terraform destroy -target=...`. Targeted operations can
leave a partially managed graph and should be reserved for recovery.

## State management rules

- Never edit `terraform.tfstate` manually.
- Never commit state, plan files, credentials, or `.terraform/`.
- Commit `.terraform.lock.hcl` so provider selection is reproducible.
- Run Terraform from this directory; the parent `terraform/` directory is a
  separate legacy two-node root module with different state.
- Use `terraform plan` before every apply.
- Use `terraform plan -refresh-only` to review out-of-band GCP changes.
- Keep only one active writer against a state at a time.
- Use `terraform state mv`, `terraform import`, and `terraform state rm` only
  after backing up state and reviewing their effects.

## Move state to GCS

Remote state is recommended before team or CI usage.

Create a dedicated, versioned state bucket once:

```bash
PROJECT_ID="gen-lang-client-0113022969"
BUCKET_NAME="muslimbot-tf-state-${PROJECT_ID}"

gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --project="$PROJECT_ID" \
  --location=asia-south1 \
  --uniform-bucket-level-access

gcloud storage buckets update "gs://${BUCKET_NAME}" --versioning
```

Configure the backend in `main.tf` using the real bucket name:

```hcl
backend "gcs" {
  bucket = "muslimbot-tf-state-gen-lang-client-0113022969"
  prefix = "terraform/single-host/prod"
}
```

Then migrate the existing local state:

```bash
terraform init -migrate-state
terraform state list
terraform plan
```

Retain a secure backup of the old local state until the remote state and plan
have been verified. GCS object versioning provides state history; Terraform's
GCS backend also coordinates state locking.

## Recovery scenarios

### Terraform reports no state, but resources still exist

First verify that you are in this directory and using the intended backend.
Restore the correct state backup when available. Otherwise, import each
existing resource into its matching address rather than recreating it.

Example:

```bash
terraform import google_compute_instance.host \
  projects/gen-lang-client-0113022969/zones/asia-south1-a/instances/muslimbot-host-prod
```

### Destroy fails partway through

Do not delete the state file. Fix the reported permission, API, dependency, or
protection error, then run:

```bash
terraform plan -destroy
terraform destroy
```

Terraform refreshes the remaining resources and continues from the partial
state.

### State lock remains after an interrupted remote operation

Confirm no Terraform process is still running before unlocking:

```bash
terraform force-unlock LOCK_ID
```

Never force-unlock an operation that is genuinely still active.

## Data disk attachment output

If `data_disk_attached` reports `false` while the disk is visible on the VM,
verify the real attachment directly:

```bash
gcloud compute instances describe \
  "$(terraform output -raw instance_name)" \
  --zone="$(terraform output -raw zone)" \
  --project="gen-lang-client-0113022969" \
  --format='table(disks.deviceName,disks.source)'
```

The current boolean output compares provider-computed self-link formats and can
produce a false negative. This does not prevent Terraform from tracking or
destroying the attached disk.
