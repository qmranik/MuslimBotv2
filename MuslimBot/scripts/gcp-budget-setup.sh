#!/usr/bin/env bash
##############################################################################
# GCP Budget Alert Setup — MuslimBot
#
# Sets up billing budget alerts so you don't accidentally burn through
# your $300 GCP credits. Alerts at 50%, 75%, and 90%.
#
# Usage:
#   bash scripts/gcp-budget-setup.sh
#
# Prerequisites:
#   - gcloud CLI with billing permissions
#   - A linked billing account with $300 credits
##############################################################################

set -euo pipefail

echo ""
echo "💰 GCP Budget Alert Setup — MuslimBot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get billing account
BILLING_ACCOUNT=$(gcloud billing accounts list --format='value(name)' --filter='open=true' | head -1)

if [ -z "$BILLING_ACCOUNT" ]; then
  echo "❌ No active billing account found."
  echo "   Run: gcloud billing accounts list"
  exit 1
fi

echo "✅ Billing account: $BILLING_ACCOUNT"

# Get project
PROJECT_ID=$(gcloud config get project 2>/dev/null)
echo "✅ Project: $PROJECT_ID"

echo ""
echo "Setting up budget alerts..."
echo ""

# Check if gcloud billing budgets is available
if ! gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" &>/dev/null 2>&1; then
  echo "⚠️  The 'gcloud billing budgets' command requires the Cloud Billing Budget API."
  echo ""
  echo "Enable it with:"
  echo "  gcloud services enable billingbudgets.googleapis.com --project=$PROJECT_ID"
  echo ""
  echo "Then re-run this script."
  echo ""
  echo "Alternatively, set up alerts manually:"
  echo "  1. Go to: https://console.cloud.google.com/billing/$BILLING_ACCOUNT/budgets"
  echo "  2. Click 'Create Budget'"
  echo "  3. Name: 'MuslimBot $300 Credit Watch'"
  echo "  4. Budget amount: \$300"
  echo "  5. Set thresholds at 50% (\$150), 75% (\$225), 90% (\$270)"
  echo "  6. Add your email for notifications"
  exit 0
fi

# Create budget
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="MuslimBot Credit Watch" \
  --budget-amount=300USD \
  --threshold-rule=percent=0.50,basis=CURRENT_SPEND \
  --threshold-rule=percent=0.75,basis=CURRENT_SPEND \
  --threshold-rule=percent=0.90,basis=CURRENT_SPEND \
  --threshold-rule=percent=1.00,basis=CURRENT_SPEND \
  --filter-projects="projects/$PROJECT_ID"

echo ""
echo "✅ Budget alerts configured!"
echo ""
echo "  📧 You'll receive email alerts at:"
echo "     • 50% spent (\$150) — consider reducing usage"
echo "     • 75% spent (\$225) — start stop/start discipline"
echo "     • 90% spent (\$270) — minimize to essentials"
echo "     • 100% spent (\$300) — credits exhausted"
echo ""
echo "  📊 Monitor: https://console.cloud.google.com/billing/$BILLING_ACCOUNT/budgets"
echo ""
echo "  💡 Cost tips:"
echo "     • Stop VM when not demoing: bash scripts/gcp-vm.sh stop"
echo "     • Check burn rate: bash scripts/gcp-vm.sh cost"
echo "     • Delete VM before credits expire to avoid charges"
