#!/usr/bin/env bash
##############################################################################
# GCP VM Management — MuslimBot Demo
#
# Quick start/stop/status for your GCP demo VM to minimize credit burn.
# A stopped VM only costs disk + static IP (~$0.85–$1.10/day).
#
# Usage:
#   bash scripts/gcp-vm.sh start
#   bash scripts/gcp-vm.sh stop
#   bash scripts/gcp-vm.sh status
#   bash scripts/gcp-vm.sh ssh
#   bash scripts/gcp-vm.sh cost        # show estimated credit burn
#   bash scripts/gcp-vm.sh ip          # print external IP
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP project set (gcloud config set project <PROJECT_ID>)
##############################################################################

set -euo pipefail

# ── Configuration (edit these or export before running) ─────────────────────
VM_NAME="${GCP_VM_NAME:-muslimbot-demo}"
ZONE="${GCP_ZONE:-us-central1-a}"
REGION="${GCP_REGION:-us-central1}"
STATIC_IP_NAME="${GCP_STATIC_IP:-muslimbot-ip}"

# Approximate costs (us-central1, e2-standard-4, 150GB pd-ssd)
HOURLY_RUNNING=0.134    # VM compute $/hr
DAILY_DISK=0.85         # 150 GB pd-ssd $/day
DAILY_STATIC_IP=0.25    # static IP when VM stopped $/day

# ── Helpers ─────────────────────────────────────────────────────────────────

_status() {
  gcloud compute instances describe "$VM_NAME" \
    --zone="$ZONE" \
    --format='value(status)' 2>/dev/null || echo "NOT_FOUND"
}

_ip() {
  gcloud compute instances describe "$VM_NAME" \
    --zone="$ZONE" \
    --format='value(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null || echo "N/A"
}

# ── Commands ────────────────────────────────────────────────────────────────

case "${1:-help}" in
  start)
    echo "🚀 Starting $VM_NAME in $ZONE..."
    gcloud compute instances start "$VM_NAME" --zone="$ZONE"
    echo ""
    echo "⏳ VM booting. Docker containers auto-restart (unless-stopped)."
    echo "   SSH in ~30 seconds:  bash scripts/gcp-vm.sh ssh"
    echo ""
    # Wait for IP to be assigned
    sleep 5
    IP=$(_ip)
    echo "🌐 External IP: $IP"
    echo ""
    echo "   Demo URLs:"
    echo "     Small ERP:      http://${IP}:8000/ops"
    echo "     Generative UI:  http://${IP}:5173"
    echo "     n8n:            http://${IP}:5678"
    echo "     Go orchestrator:  http://${IP}:8080/v1/sys/health
    ;;

  stop)
    echo "⏹️  Stopping $VM_NAME..."
    gcloud compute instances stop "$VM_NAME" --zone="$ZONE"
    echo ""
    echo "✅ VM stopped."
    echo "   💰 Now billing only disk + static IP (~\$${DAILY_DISK} + \$${DAILY_STATIC_IP} = ~\$1.10/day)"
    echo "   ⚠️  All Docker containers will resume on next 'start' (restart: unless-stopped)"
    ;;

  status)
    STATUS=$(_status)
    IP=$(_ip)
    echo "╔══════════════════════════════════════════════╗"
    echo "║  MuslimBot GCP VM Status                     ║"
    echo "╠══════════════════════════════════════════════╣"
    echo "║  VM Name:   $VM_NAME"
    echo "║  Zone:      $ZONE"
    echo "║  Status:    $STATUS"
    echo "║  IP:        $IP"
    echo "╚══════════════════════════════════════════════╝"
    ;;

  ssh)
    echo "🔐 Connecting to $VM_NAME..."
    gcloud compute ssh "$VM_NAME" --zone="$ZONE"
    ;;

  ip)
    _ip
    ;;

  cost)
    STATUS=$(_status)
    echo "💰 MuslimBot GCP Cost Estimator"
    echo "─────────────────────────────────"
    echo "  VM Status:     $STATUS"
    echo ""
    if [ "$STATUS" = "RUNNING" ]; then
      echo "  Running costs:"
      echo "    Compute:     ~\$${HOURLY_RUNNING}/hr (\$$(echo "$HOURLY_RUNNING * 24" | bc)/day)"
      echo "    Disk:        ~\$${DAILY_DISK}/day"
      echo "    Total:       ~\$$(echo "$HOURLY_RUNNING * 24 + $DAILY_DISK" | bc)/day"
      echo ""
      echo "  💡 Tip: Run 'bash scripts/gcp-vm.sh stop' when not demoing"
    else
      echo "  Stopped costs:"
      echo "    Disk:        ~\$${DAILY_DISK}/day"
      echo "    Static IP:   ~\$${DAILY_STATIC_IP}/day"
      echo "    Total:       ~\$$(echo "$DAILY_DISK + $DAILY_STATIC_IP" | bc)/day"
      echo ""
      echo "  💡 At this rate, \$300 covers disk-only for ~$(echo "300 / ($DAILY_DISK + $DAILY_STATIC_IP)" | bc) days"
    fi
    echo ""
    echo "  Monthly projections (4 hrs/day active):"
    echo "    Active compute: ~\$$(echo "$HOURLY_RUNNING * 4 * 30" | bc)/mo"
    echo "    Disk (always):  ~\$$(echo "$DAILY_DISK * 30" | bc)/mo"
    echo "    Total:          ~\$$(echo "$HOURLY_RUNNING * 4 * 30 + $DAILY_DISK * 30" | bc)/mo"
    ;;

  urls)
    IP=$(_ip)
    if [ "$IP" = "N/A" ]; then
      echo "❌ VM is not running or has no external IP."
      exit 1
    fi
    echo "🌐 MuslimBot Demo URLs"
    echo "─────────────────────────"
    echo "  Small ERP (/ops):  http://${IP}:8000/ops"
    echo "  Generative UI:     http://${IP}:5173"
    echo "  n8n Automation:    http://${IP}:5678"
    echo "  Go health:        http://${IP}:8080/v1/sys/health
    echo "  Chatwoot:          http://${IP}:3000"
    echo ""
    echo "  Login: Administrator / <ADMIN_PASSWORD from .env>"
    ;;

  help|*)
    echo "Usage: bash scripts/gcp-vm.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start    Start the VM (containers auto-resume)"
    echo "  stop     Stop the VM (disk-only billing)"
    echo "  status   Show VM status and IP"
    echo "  ssh      SSH into the VM"
    echo "  ip       Print external IP"
    echo "  cost     Show cost estimates"
    echo "  urls     Print demo URLs"
    echo "  help     This message"
    ;;
esac
