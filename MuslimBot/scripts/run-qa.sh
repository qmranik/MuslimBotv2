#!/bin/bash
set -e

# Wait for Frappe
echo "Waiting for frappe-web to be ready..."
sleep 15

# Install local script
echo "Running install-local.sh..."
bash small_erp/scripts/install-local.sh || true

# Seed data
echo "Seeding demo data..."
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.finish_setup.finish || true
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.seed_demo.create_demo_data || true

# Generate keys
echo "Generating keys..."
KEYS_OUTPUT=$(docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute frappe.client.generate_keys --args '["Administrator"]')
echo "Keys Output: $KEYS_OUTPUT"

API_KEY=$(echo "$KEYS_OUTPUT" | grep -o '"api_key": "[^"]*' | grep -o '[^"]*$')
API_SECRET=$(echo "$KEYS_OUTPUT" | grep -o '"api_secret": "[^"]*' | grep -o '[^"]*$')

if [ -z "$API_KEY" ]; then
  # Try fallback or parse differently if format is unexpected
  API_KEY="fallback_key"
  API_SECRET="fallback_secret"
fi

echo "Extracted Key: $API_KEY"

# Prepare generative-ui env
echo "Configuring generative-ui..."
cd generative-ui
cat > .env <<EOF
FRAPPE_URL=http://localhost:8000
FRAPPE_SITE_HOST=small.localhost:8000
FRAPPE_API_KEY=$API_KEY
FRAPPE_API_SECRET=$API_SECRET
VITE_GEMINI_API_KEY=mock-key
KB_BFF_URL=http://localhost:8787
KB_BFF_API_KEY=change-me-in-production
VITE_WS_ERP_URL=http://localhost:8000/ops
VITE_WS_N8N_URL=http://localhost:5678
VITE_WS_CHATWOOT_URL=http://localhost:3000
VITE_WS_POSTIZ_URL=http://localhost:4007
VITE_LIVEKIT_URL=wss://mock
EOF
npm install
npm run dev > vite.log 2>&1 &
cd ..

# Prepare go-orchestrator
echo "Configuring go-orchestrator..."
cd go-orchestrator
export PORT=8080
export COOKIE_DOMAIN=localhost
export JWT_SECRET=dev-jwt-secret-change-me
export FRAPPE_URL=http://localhost:8000
export FRAPPE_API_KEY=$API_KEY
export FRAPPE_API_SECRET=$API_SECRET
export KBBFF_URL=http://localhost:8787
export KBBFF_API_KEY=change-me-in-production
export GEMINI_API_KEY=mock-key
go mod tidy
go run cmd/server/main.go > orchestrator.log 2>&1 &
cd ..

echo "Waiting for services to spin up..."
sleep 10
echo "Done! Ready for QA."
