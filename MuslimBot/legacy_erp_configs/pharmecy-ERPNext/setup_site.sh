#!/usr/bin/env bash
# ─── Antigravity Pharmacy — Site Provisioning Script ───
# Run this INSIDE the backend container after `docker compose up -d`
# Usage: docker compose exec backend bash /home/frappe/frappe-bench/setup_site.sh

set -euo pipefail

SITE_NAME="antigravity.localhost"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
DB_ROOT_PASSWORD="${DB_PASSWORD:-AntiGrav!DB2024}"

echo "═══════════════════════════════════════════════════════"
echo "  Antigravity Pharmacy — ERPNext Site Provisioner"
echo "  Site:     ${SITE_NAME}"
echo "  Date:     $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "═══════════════════════════════════════════════════════"

# ─── Step 1: Create Site ───
echo ""
echo "▶ [1/6] Creating site ${SITE_NAME}..."
bench new-site "${SITE_NAME}" \
  --mariadb-root-password "${DB_ROOT_PASSWORD}" \
  --admin-password "${ADMIN_PASSWORD}" \
  --no-mariadb-socket \
  || echo "  ⚠ Site may already exist, continuing..."

# ─── Step 2: Install ERPNext ───
echo ""
echo "▶ [2/6] Installing ERPNext app..."
bench --site "${SITE_NAME}" install-app erpnext \
  || echo "  ⚠ ERPNext may already be installed, continuing..."

# ─── Step 3: Install Healthcare ───
echo ""
echo "▶ [3/6] Installing Healthcare app..."
if ! bench --site "${SITE_NAME}" list-apps | grep -q healthcare; then
  bench get-app healthcare 2>/dev/null || true
  bench --site "${SITE_NAME}" install-app healthcare \
    || echo "  ⚠ Healthcare install issue — may need manual intervention"
else
  echo "  ✓ Healthcare already installed"
fi

# ─── Step 4: Set as default site ───
echo ""
echo "▶ [4/6] Setting default site..."
bench use "${SITE_NAME}"

# ─── Step 5: Enable developer mode ───
echo ""
echo "▶ [5/6] Enabling developer mode..."
bench --site "${SITE_NAME}" set-config developer_mode 1

# ─── Step 6: Localization ───
echo ""
echo "▶ [6/6] Applying Bangladesh localization..."
bench --site "${SITE_NAME}" console <<'PYEOF'
import frappe

# System Settings
sys_settings = frappe.get_doc("System Settings")
sys_settings.country = "Bangladesh"
sys_settings.time_zone = "Asia/Dhaka"
sys_settings.language = "en"
sys_settings.date_format = "dd-mm-yyyy"
sys_settings.time_format = "HH:mm:ss"
sys_settings.number_format = "#,###.##"
sys_settings.currency = "BDT"
sys_settings.first_day_of_the_week = "Saturday"
sys_settings.save(ignore_permissions=True)

# Global Defaults
global_defaults = frappe.get_doc("Global Defaults")
global_defaults.default_currency = "BDT"
global_defaults.default_company = "Antigravity Pharmacy"
global_defaults.country = "Bangladesh"
global_defaults.save(ignore_permissions=True)

# Enable Healthcare & Distribution domains
domain_settings = frappe.get_doc("Domain Settings")
active = [d.domain for d in domain_settings.active_domains]
for domain in ["Healthcare", "Distribution"]:
    if domain not in active:
        domain_settings.append("active_domains", {"domain": domain})
domain_settings.save(ignore_permissions=True)

frappe.db.commit()
print("✅ Localization applied: Asia/Dhaka, BDT, Bangladesh")
print("✅ Healthcare & Distribution domains enabled")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Site provisioning complete!"
echo "  Access: http://antigravity.localhost:8080"
echo "  Login:  Administrator / ${ADMIN_PASSWORD}"
echo "═══════════════════════════════════════════════════════"
