#!/usr/bin/env bash
# =============================================================================
# MuslimBot — Root Setup Orchestrator
# -----------------------------------------------------------------------------
# One entrypoint that wires the whole system together by running the existing
# scripts in order (it does NOT reimplement them). Follows
# docs/production/MASTER_IMPLEMENTATION_PLAN.md.
#
# Two contexts:
#   • Operator workstation  → provision + push + drive the VM over SSH
#   • The VM itself         → bring up the stack, init apps, seed, verify
#
# Usage:
#   ./setup.sh <phase> [args]      run a single phase
#   ./setup.sh all                 run the safe end-to-end chain (with gates)
#   ./setup.sh help                list phases
#
# Billable/destructive phases (provision, restore, teardown) always confirm
# unless MUSLIMBOT_YES=1 is exported. Nothing is applied without a clear yes.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="$ROOT/terraform/single-host"

# ── config (env-overridable; sourced from .env if present) ───────────────────
[ -f "$ROOT/.env" ] && set -a && . "$ROOT/.env" && set +a || true
REPO_URL="${REPO_URL:-https://github.com/qmranik/MuslimBotv2.git}"
BRANCH="${BRANCH:-chore/repo-restructure}"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-}"
SITE="${FRAPPE_SITE_NAME:-${FRAPPE_SITE_HOST:-small.localhost}}"
COMPOSE_FILES=(-f docker-compose.yml -f "$ROOT/../docker-compose.extended.yml")
PROFILES=(--profile support --profile voice)
ENV_FILE="${ENV_FILE:-/opt/muslimbot/secrets/muslimbot.env}"

# ── ui ───────────────────────────────────────────────────────────────────────
c() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
log()  { echo "$(c '0;32' '[OK]')  $*"; }
info() { echo "$(c '0;34' '[i ]')  $*"; }
warn() { echo "$(c '1;33' '[! ]')  $*" >&2; }
err()  { echo "$(c '0;31' '[X ]')  $*" >&2; }
step() { echo; echo "$(c '1;36' "━━ $* ━━")"; }
die()  { err "$*"; exit 1; }

confirm() {
  [ "${MUSLIMBOT_YES:-0}" = "1" ] && return 0
  read -r -p "$(c '1;33' "$1 [y/N] ")" a; [[ "$a" =~ ^[Yy]$ ]]
}

on_vm()      { [ -d /opt/muslimbot ] || [ "${MUSLIMBOT_ON_VM:-0}" = "1" ]; }
have()       { command -v "$1" >/dev/null 2>&1; }
tf()         { terraform -chdir="$TF_DIR" "$@"; }
tf_out()     { tf output -raw "$1" 2>/dev/null || true; }
compose()    { ( cd "$ROOT" && docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@" ); }
bench_exec() { compose exec -T frappe-web bench --site "$SITE" "$@"; }

# ── phases ───────────────────────────────────────────────────────────────────

phase_preflight() {
  step "Preflight — tools, auth, config"
  if on_vm; then
    have docker || die "docker not found on VM"
    docker compose version >/dev/null || die "docker compose v2 required"
    log "VM context: docker ready"
  else
    for t in git; do have "$t" || die "$t not found"; done
    have terraform || warn "terraform not found (needed for 'provision')"
    have gcloud    || warn "gcloud not found (needed for 'provision'/'deploy')"
    if have gcloud; then
      gcloud auth application-default print-access-token >/dev/null 2>&1 \
        && log "gcloud ADC OK ($(gcloud config get-value project 2>/dev/null))" \
        || warn "gcloud ADC not configured — run: gcloud auth application-default login"
    fi
  fi
  # submodules the deploy needs
  git -C "$ROOT/.." submodule status 2>/dev/null | grep -q mcp-chatwoot \
    || warn "mcp-chatwoot submodule not added — Chatwoot MCP will not spawn (see ADR-0001 §7)"
  log "preflight done"
}

phase_push() {
  step "Push branch $BRANCH (deploy-on-vm.sh clones from it)"
  on_vm && { warn "skip push on VM"; return 0; }
  git -C "$ROOT/.." diff --quiet && git -C "$ROOT/.." diff --cached --quiet \
    || warn "working tree has uncommitted changes — commit before deploy so the VM gets them"
  git -C "$ROOT/.." push -u origin "$BRANCH"
  log "pushed"
}

phase_provision() {
  step "Provision GCP VM (Terraform) — BILLABLE"
  on_vm && die "provision runs on the operator workstation, not the VM"
  have terraform || die "terraform required"
  tf init -input=false >/dev/null
  tf validate >/dev/null && log "terraform config valid"
  tf plan -input=false -out=tfplan
  confirm "Apply this plan and create billable infrastructure?" || { warn "aborted — no resources created"; return 0; }
  tf apply -input=false tfplan
  log "provisioned: $(tf_out instance_name) @ $(tf_out instance_public_ip) (zone $(tf_out zone))"
}

# Drive the VM: run deploy-on-vm.sh there (clone, docker-on-SSD, env, stack up).
phase_deploy() {
  step "Deploy unified stack on the VM (deploy-on-vm.sh over SSH)"
  on_vm && die "deploy drives the VM from the workstation; run 'stack' locally on the VM instead"
  local name zone; name="$(tf_out instance_name)"; zone="$(tf_out zone)"
  [ -n "$name" ] || die "no VM in terraform state — run './setup.sh provision' first"
  info "copying + running deploy-on-vm.sh on $name…"
  gcloud compute ssh "$name" --zone="$zone" --command="
    REPO_URL='$REPO_URL' BRANCH='$BRANCH' PUBLIC_DOMAIN='${PUBLIC_DOMAIN}' \
    bash -s" < "$TF_DIR/deploy-on-vm.sh"
  log "stack deploy invoked on $name"
}

# On the VM: (re)build + bring the merged stack up.
phase_stack() {
  step "Bring up the merged stack (base + edge + trypost, support+voice)"
  on_vm || warn "not on the VM — this expects to run on the host"
  compose "${PROFILES[@]}" build
  compose "${PROFILES[@]}" up -d
  info "waiting for MariaDB…"
  local n=60; until compose exec -T mariadb healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; do
    n=$((n-1)); [ $n -le 0 ] && die "MariaDB did not become healthy"; sleep 3; done
  log "stack up; MariaDB healthy"
}

# On the VM: initialize Frappe site + ERPNext + small_erp (idempotent).
phase_init() {
  step "Initialize ERPNext + small_erp (small_erp/scripts/deploy.sh)"
  bash "$ROOT/small_erp/scripts/deploy.sh" --skip-harden
  log "app init done"
}

# On the VM: seed demo data + permissions.
phase_seed() {
  step "Seed ERPNext (finish_setup + seed_demo + permissions)"
  bench_exec execute small_erp.finish_setup.finish            || warn "finish_setup skipped/failed"
  bench_exec execute small_erp.seed_demo.create_demo_data     || warn "seed_demo skipped/failed"
  bench_exec execute small_erp.setup_permissions.run          || warn "permissions skipped/failed"
  log "seed complete"
}

# Provision an additional business (tenant).
phase_tenant() {
  step "Provision tenant business"
  local sub="${1:-}" company="${2:-}"
  [ -n "$sub" ] && [ -n "$company" ] || die "usage: ./setup.sh tenant <subdomain> \"<Company Name>\" [admin_pass]"
  bash "$ROOT/scripts/provision-tenant.sh" "$sub" "$company" "${3:-}"
  log "tenant '$sub' provisioned"
}

phase_backup()  { step "Backup all datastores"; bash "$ROOT/small_erp/scripts/backup.sh"; }
phase_restore() {
  step "Restore from backup — DESTRUCTIVE"
  local ts="${1:-latest}"
  confirm "Restore '$ts' — this DROPS and recreates data. Continue?" || { warn "aborted"; return 0; }
  bash "$ROOT/small_erp/scripts/restore.sh" "$ts"
}

# Health + MCP wiring verification.
phase_verify() {
  step "Verify — health + MCP servers"
  local base="${API_BASE:-http://localhost:8080}"
  curl -fsS "$base/v1/sys/health" >/dev/null && log "orchestrator health OK" || warn "health check failed ($base)"
  local hdr=(); on_vm || hdr=(-H "X-authentik-email: setup@local")
  info "MCP servers:"; curl -fsS "${hdr[@]}" "$base/v1/mcp/servers" 2>/dev/null || warn "mcp/servers unreachable (needs auth + running orchestrator)"
  echo
  warn "Human-gated (do in the web UIs, then set the env + re-run 'stack'):"
  echo "   • DNS A records for *.${PUBLIC_DOMAIN:-<domain>}  + Traefik ACME (CF_DNS_API_TOKEN)"
  echo "   • Authentik admin + OIDC app + ForwardAuth outpost"
  echo "   • TryPost  → Settings→API Keys → TRYPOST_API_TOKEN"
  echo "   • Chatwoot → Profile → CHATWOOT_API_TOKEN"
  echo "   • GenUI    → NEXT_PUBLIC_AUTHENTIK_URL=https://auth.<domain>"
}

phase_teardown() {
  step "Teardown GCP VM — DESTRUCTIVE"
  on_vm && die "run teardown from the workstation"
  confirm "terraform destroy ALL infrastructure?" || { warn "aborted"; return 0; }
  tf destroy -input=false
}

# Safe end-to-end chain. Provision confirms; app-init runs only once reachable.
phase_all() {
  phase_preflight
  if on_vm; then
    phase_stack; phase_init; phase_seed; phase_verify
  else
    phase_push; phase_provision
    [ -n "$(tf_out instance_name)" ] && phase_deploy || warn "VM not provisioned — stopping before deploy"
    info "Now SSH to the VM and run:  ./setup.sh all   (to init + seed + verify there)"
  fi
  log "chain complete"
}

usage() {
  cat <<EOF
$(c '1;36' 'MuslimBot Root Setup Orchestrator')

  Workstation phases:   preflight  push  provision  deploy  teardown
  VM phases:            stack  init  seed  verify  backup  restore <ts>
  Multi-business:       tenant <subdomain> "<Company>" [admin_pass]
  Everything (gated):   all

Examples:
  ./setup.sh preflight
  ./setup.sh all                       # workstation: push→provision→deploy
  ssh vm  &&  ./setup.sh all           # on the VM: stack→init→seed→verify
  ./setup.sh tenant acme "Acme Corp"
  MUSLIMBOT_YES=1 ./setup.sh provision # non-interactive apply

Config via env or $ROOT/.env: REPO_URL BRANCH PUBLIC_DOMAIN GCP project (gcloud).
Docs: docs/production/MASTER_IMPLEMENTATION_PLAN.md
EOF
}

main() {
  local cmd="${1:-help}"; shift || true
  case "$cmd" in
    preflight) phase_preflight ;;
    push)      phase_push ;;
    provision) phase_provision ;;
    deploy)    phase_deploy ;;
    stack)     phase_stack ;;
    init)      phase_init ;;
    seed)      phase_seed ;;
    tenant)    phase_tenant "$@" ;;
    backup)    phase_backup ;;
    restore)   phase_restore "$@" ;;
    verify)    phase_verify ;;
    teardown)  phase_teardown ;;
    all)       phase_all ;;
    help|-h|--help) usage ;;
    *) err "unknown phase: $cmd"; usage; exit 1 ;;
  esac
}
main "$@"
