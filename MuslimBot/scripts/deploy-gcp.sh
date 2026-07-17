#!/usr/bin/env bash
##############################################################################
# GCP Deployment — MuslimBot System (One-Shot Provisioner)
#
# Creates a GCP VM, configures firewall, installs Docker, and deploys the
# MuslimBot demo stack. Run from your LOCAL machine (not the VM).
#
# Budget: Optimized for $300 GCP free credits
# Target: e2-standard-4 (4 vCPU / 16 GB RAM / 150 GB SSD)
# Est. cost: ~$49/mo with stop/start discipline (4 hrs/day)
#
# Usage:
#   bash scripts/deploy-gcp.sh                # Interactive
#   GCP_PROJECT=my-proj bash scripts/deploy-gcp.sh   # Non-interactive
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - A GCP project with billing enabled ($300 credits)
##############################################################################

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*" >&2; }
info() { echo -e "${BLUE}[i]${NC} $*"; }

# ── Configuration ───────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT:-}"
ZONE="${GCP_ZONE:-us-central1-a}"
REGION="${GCP_REGION:-us-central1}"
VM_NAME="${GCP_VM_NAME:-muslimbot-demo}"
MACHINE_TYPE="${GCP_MACHINE_TYPE:-e2-standard-4}"
DISK_SIZE="${GCP_DISK_SIZE:-150}"
DISK_TYPE="pd-ssd"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"
NETWORK_TAG="muslimbot-demo"
STATIC_IP_NAME="muslimbot-ip"
REPO_URL="${GCP_REPO_URL:-}"

# ── Preflight checks ───────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     MuslimBot System — GCP Deployment Provisioner       ║"
echo "║     Budget: \$300 credits | Target: ${MACHINE_TYPE}       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check gcloud
if ! command -v gcloud &>/dev/null; then
  err "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Check authentication
if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" &>/dev/null; then
  err "Not authenticated. Run: gcloud auth login"
  exit 1
fi

log "gcloud CLI authenticated as: $(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null | head -1)"

# Get project
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID=$(gcloud config get project 2>/dev/null || true)
  if [ -z "$PROJECT_ID" ]; then
    echo ""
    warn "No GCP project set."
    echo "  Available projects:"
    gcloud projects list --format="table(projectId, name)" 2>/dev/null || true
    echo ""
    read -rp "Enter GCP Project ID: " PROJECT_ID
  fi
fi

gcloud config set project "$PROJECT_ID" 2>/dev/null
log "Using project: $PROJECT_ID"

# Get repo URL
if [ -z "$REPO_URL" ]; then
  echo ""
  warn "Repository URL needed to clone on the VM."
  read -rp "Enter your Git repo URL (HTTPS or SSH): " REPO_URL
fi

# ── Confirmation ────────────────────────────────────────────────────────────

echo ""
info "Deployment plan:"
echo "  Project:      $PROJECT_ID"
echo "  VM Name:      $VM_NAME"
echo "  Zone:         $ZONE"
echo "  Machine:      $MACHINE_TYPE (4 vCPU / 16 GB RAM)"
echo "  Disk:         ${DISK_SIZE} GB $DISK_TYPE"
echo "  Est. cost:    ~\$122/mo running, ~\$33/mo stopped"
echo "  Repository:   $REPO_URL"
echo ""

read -rp "Proceed? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY] ]]; then
  echo "Aborted."
  exit 0
fi

# ── Step 1: Reserve static IP ──────────────────────────────────────────────

echo ""
info "Step 1/5: Reserving static IP..."

if gcloud compute addresses describe "$STATIC_IP_NAME" --region="$REGION" &>/dev/null; then
  log "Static IP '$STATIC_IP_NAME' already exists"
else
  gcloud compute addresses create "$STATIC_IP_NAME" --region="$REGION"
  log "Static IP reserved"
fi

STATIC_IP=$(gcloud compute addresses describe "$STATIC_IP_NAME" \
  --region="$REGION" --format='value(address)')
log "Static IP: $STATIC_IP"

# ── Step 2: Create firewall rules ──────────────────────────────────────────

info "Step 2/5: Configuring firewall..."

if gcloud compute firewall-rules describe muslimbot-ports &>/dev/null 2>&1; then
  log "Firewall rule 'muslimbot-ports' already exists"
else
  gcloud compute firewall-rules create muslimbot-ports \
    --allow=tcp:22,tcp:80,tcp:443,tcp:3000,tcp:4007,tcp:5173,tcp:5678,tcp:8000,tcp:8088,tcp:8787 \
    --target-tags="$NETWORK_TAG" \
    --description="MuslimBot demo stack — all service ports"
  log "Firewall rules created"
fi

# ── Step 3: Create VM ──────────────────────────────────────────────────────

info "Step 3/5: Creating VM..."

if gcloud compute instances describe "$VM_NAME" --zone="$ZONE" &>/dev/null 2>&1; then
  warn "VM '$VM_NAME' already exists. Skipping creation."
else
  gcloud compute instances create "$VM_NAME" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --boot-disk-size="${DISK_SIZE}GB" \
    --boot-disk-type="$DISK_TYPE" \
    --image-family="$IMAGE_FAMILY" \
    --image-project="$IMAGE_PROJECT" \
    --tags="$NETWORK_TAG" \
    --address="$STATIC_IP" \
    --metadata=startup-script='#!/bin/bash
      # Install Docker (first boot only)
      if ! command -v docker &>/dev/null; then
        apt-get update
        apt-get install -y ca-certificates curl git
        curl -fsSL https://get.docker.com | sh
        usermod -aG docker $(logname 2>/dev/null || echo ubuntu)
      fi'
  log "VM created: $VM_NAME ($MACHINE_TYPE)"
fi

# ── Step 4: Wait for VM to be ready ───────────────────────────────────────

info "Step 4/5: Waiting for VM to be ready..."

for i in $(seq 1 30); do
  if gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="echo ready" &>/dev/null; then
    break
  fi
  echo -n "."
  sleep 5
done
echo ""
log "VM is accessible via SSH"

# ── Step 5: Bootstrap the VM ──────────────────────────────────────────────

info "Step 5/5: Bootstrapping Docker and cloning repository..."

gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="bash -s" <<REMOTE_SCRIPT
set -euo pipefail

# Wait for Docker to be installed by startup script
for i in \$(seq 1 24); do
  if command -v docker &>/dev/null; then break; fi
  echo "Waiting for Docker install..."
  sleep 5
done

# Verify Docker
docker --version || { echo "Docker not installed"; exit 1; }
docker compose version || { echo "Docker Compose not available"; exit 1; }

# Clone repo
if [ ! -d ~/liteERP ]; then
  echo "Cloning repository..."
  git clone "$REPO_URL" ~/liteERP
else
  echo "Repository already exists, pulling latest..."
  cd ~/liteERP && git pull || true
fi

echo ""
echo "✅ VM bootstrapped successfully!"
echo ""
echo "Next steps (SSH into the VM):"
echo "  1. cd ~/liteERP"
echo "  2. cp .env.template .env && nano .env   # fill secrets"
echo "  3. docker build -t small-erp:latest ."
echo "  4. docker compose -f docker-compose.gcp.yml up -d"
echo "  5. bash small_erp/scripts/install-demo.sh"
REMOTE_SCRIPT

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  ✅ GCP VM Provisioned Successfully!                           ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║                                                                ║"
echo "║  VM:          $VM_NAME                                         "
echo "║  IP:          $STATIC_IP                                       "
echo "║  SSH:         gcloud compute ssh $VM_NAME --zone=$ZONE         "
echo "║  Or:          bash scripts/gcp-vm.sh ssh                       "
echo "║                                                                ║"
echo "║  Next steps on the VM:                                         ║"
echo "║    1. cd ~/liteERP                                             ║"
echo "║    2. cp .env.template .env && nano .env                       ║"
echo "║    3. docker build -t small-erp:latest .   (~10 min)           ║"
echo "║    4. docker compose -f docker-compose.gcp.yml up -d           ║"
echo "║    5. bash small_erp/scripts/install-demo.sh                   ║"
echo "║                                                                ║"
echo "║  Demo URLs (after deploy):                                     ║"
echo "║    Small ERP:      http://$STATIC_IP:8000/ops                  "
echo "║    Generative UI:  http://$STATIC_IP:5173                      "
echo "║    n8n:            http://$STATIC_IP:5678                      "
echo "║    KB BFF:         http://$STATIC_IP:8787/health               "
echo "║                                                                ║"
echo "║  💰 Cost control:                                              ║"
echo "║    bash scripts/gcp-vm.sh stop   # when not demoing            ║"
echo "║    bash scripts/gcp-vm.sh start  # resume (~30 sec boot)       ║"
echo "║    bash scripts/gcp-vm.sh cost   # check burn rate             ║"
echo "║                                                                ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
