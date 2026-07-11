#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/test-silos"

COMPOSE="docker compose -f docker-compose.silo2.yml"

echo "-> Finishing setup..."
$COMPOSE exec frappe-web bench --site small.localhost execute small_erp.finish_setup.finish

echo "-> Seeding demo data..."
$COMPOSE exec frappe-web bench --site small.localhost execute small_erp.seed_demo.create_demo_data

echo "-> Generating API keys..."
$COMPOSE exec frappe-web bench --site small.localhost execute frappe.client.generate_keys --args '["Administrator"]'
