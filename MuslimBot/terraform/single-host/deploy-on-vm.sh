#!/bin/bash
set -euo pipefail

REPO_URL="${1:-}"

if [ -z "$REPO_URL" ]; then
  echo "Usage: $0 <REPO_URL>"
  echo "Example: $0 https://github.com/your-org/liteERP.git"
  exit 1
fi

echo "==> Setting up directories on data disk..."
sudo mkdir -p /opt/muslimbot/app
sudo chown "$USER:$USER" /opt/muslimbot/app

# Ensure subdirectories for bind mounts exist
sudo mkdir -p /opt/muslimbot/data/frappe/sites
sudo mkdir -p /opt/muslimbot/data/frappe/logs
sudo mkdir -p /opt/muslimbot/data/kb_data

# Frappe uses uid 1000 in its container
sudo chown -R 1000:1000 /opt/muslimbot/data/frappe || true

cd /opt/muslimbot/app

echo "==> Cloning repository..."
if [ ! -d "liteERP" ]; then
  git clone "$REPO_URL" liteERP
else
  echo "liteERP already exists, pulling latest..."
  cd liteERP
  git pull
  cd ..
fi

cd liteERP/MuslimBot

echo "==> Configuring .env..."
if [ ! -f ".env" ]; then
  cp .env.template .env
  
  # Generate strong random secrets
  sed -i "s/^DB_ROOT_PASSWORD=.*/DB_ROOT_PASSWORD=$(openssl rand -hex 24)/" .env
  sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$(openssl rand -hex 24)/" .env
  sed -i "s/^N8N_ENCRYPTION_KEY=.*/N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)/" .env
  sed -i "s/^CHATWOOT_SECRET_KEY=.*/CHATWOOT_SECRET_KEY=$(openssl rand -hex 64)/" .env
  
  # Determine public IP and set URLs
  PUBLIC_IP=$(curl -s ifconfig.me || curl -s ifconfig.co)
  if [ -n "$PUBLIC_IP" ]; then
    echo "Detected public IP: $PUBLIC_IP"
    sed -i "s|^DEMO_PUBLIC_URL=.*|DEMO_PUBLIC_URL=http://${PUBLIC_IP}|" .env
    sed -i "s|^FRAPPE_SITE_NAME=.*|FRAPPE_SITE_NAME=small.localhost|" .env
    sed -i "s|^FRAPPE_SITE_HOST=.*|FRAPPE_SITE_HOST=${PUBLIC_IP}:8000|" .env
    sed -i "s|^N8N_HOST=.*|N8N_HOST=${PUBLIC_IP}|" .env
    sed -i "s|^N8N_WEBHOOK_URL=.*|N8N_WEBHOOK_URL=http://${PUBLIC_IP}:5678|" .env
    sed -i "s|^CHATWOOT_FRONTEND_URL=.*|CHATWOOT_FRONTEND_URL=http://${PUBLIC_IP}:3000|" .env
  else
    echo "Warning: Could not detect public IP. You will need to edit .env manually."
  fi
else
  echo ".env already exists, skipping generation."
fi

echo "==> Applying compose override (bind-mounts)..."
if [ -f "terraform/single-host/docker-compose.override.yml" ]; then
  cp terraform/single-host/docker-compose.override.yml docker-compose.override.yml
  echo "Override applied."
else
  echo "Warning: terraform/single-host/docker-compose.override.yml not found in the repo!"
fi

echo "==> Building Docker images (this may take a while)..."
docker build -t small-erp:latest .
docker build -t muslimbot-voice-agent:latest ./Muslimbot-voice-agent

echo "==> Starting application stack..."
docker compose up -d
docker compose --profile voice up -d

echo "==> Waiting for services to stabilize..."
sleep 15

echo "==> Initializing demo data (install-demo.sh)..."
bash small_erp/scripts/install-demo.sh

echo ""
echo "=========================================================="
echo "Deployment successful!"
echo "To access the demo via public IP, ensure you have opened the firewall ports:"
echo ""
echo "gcloud compute firewall-rules create muslimbot-demo-app-ports \\"
echo "  --network=muslimbot-vpc-prod \\"
echo "  --allow=tcp:8000,tcp:5173,tcp:5678,tcp:8787,tcp:3000,tcp:4007 \\"
echo "  --source-ranges=0.0.0.0/0 \\"
echo "  --target-tags=muslimbot-host"
echo "=========================================================="
