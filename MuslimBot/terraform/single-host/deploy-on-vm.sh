#!/bin/bash
set -euo pipefail

REPO_URL="https://github.com/qmranik/MuslimBotv2.git"
BRANCH="chore/repo-restructure"

echo "==> Setting up directory layout on data disk..."
sudo mkdir -p /opt/muslimbot/repo
sudo mkdir -p /opt/muslimbot/backups
sudo mkdir -p /opt/muslimbot/data/docker
sudo mkdir -p /opt/muslimbot/secrets

sudo install -d -o "$USER" -g "$USER" /opt/muslimbot/repo
sudo install -d -o "$USER" -g "$USER" /opt/muslimbot/backups
sudo install -d -m 0700 -o "$USER" -g "$USER" /opt/muslimbot/secrets

echo "==> Configuring Docker to use data disk..."
if ! sudo grep -q '"data-root": "/opt/muslimbot/data/docker"' /etc/docker/daemon.json 2>/dev/null; then
  sudo systemctl stop docker docker.socket || true
  sudo mkdir -p /etc/docker
  sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "data-root": "/opt/muslimbot/data/docker",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
EOF
  sudo systemctl start docker
  docker info --format 'Docker root: {{.DockerRootDir}}'
else
  echo "Docker data-root is already configured."
fi

echo "==> Cloning repository..."
if [ ! -d "/opt/muslimbot/repo/MuslimBot" ]; then
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" /opt/muslimbot/repo
else
  echo "Repository already cloned, pulling latest..."
  cd /opt/muslimbot/repo
  git pull origin "$BRANCH"
fi

echo "==> Updating submodules..."
cd /opt/muslimbot/repo
git submodule update --init --recursive

echo "==> Configuring .env..."
cd /opt/muslimbot/repo/MuslimBot
if [ ! -f "/opt/muslimbot/secrets/muslimbot.env" ] || ! grep -q "PUBLIC_DOMAIN" "/opt/muslimbot/secrets/muslimbot.env"; then
  rm -f /opt/muslimbot/secrets/muslimbot.env
  cp .env.template /opt/muslimbot/secrets/muslimbot.env
  chmod 600 /opt/muslimbot/secrets/muslimbot.env
  ln -sf /opt/muslimbot/secrets/muslimbot.env .env
  
  ENV_FILE="/opt/muslimbot/secrets/muslimbot.env"
  # Generate strong random secrets
  sed -i "s/^DB_ROOT_PASSWORD=.*/DB_ROOT_PASSWORD=$(openssl rand -hex 24)/" "$ENV_FILE"
  sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$(openssl rand -hex 24)/" "$ENV_FILE"
  sed -i "s/^POSTGRES_SHARED_PASSWORD=.*/POSTGRES_SHARED_PASSWORD=$(openssl rand -hex 24)/" "$ENV_FILE"
  sed -i "s/^N8N_PASSWORD=.*/N8N_PASSWORD=$(openssl rand -hex 24)/" "$ENV_FILE"
  sed -i "s/^N8N_ENCRYPTION_KEY=.*/N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)/" "$ENV_FILE"
  sed -i "s/^CHATWOOT_DB_PASSWORD=.*/CHATWOOT_DB_PASSWORD=$(openssl rand -hex 24)/" "$ENV_FILE"
  sed -i "s/^CHATWOOT_SECRET_KEY=.*/CHATWOOT_SECRET_KEY=$(openssl rand -hex 64)/" "$ENV_FILE"
  sed -i "s/^KB_BFF_API_KEY=.*/KB_BFF_API_KEY=$(openssl rand -hex 32)/" "$ENV_FILE"
  echo "AUTHENTIK_SECRET_KEY=$(openssl rand -hex 64)" >> "$ENV_FILE"
  echo "TRYPOST_DB_PASSWORD=$(openssl rand -hex 24)" >> "$ENV_FILE"
  echo "TRYPOST_APP_KEY=base64:$(openssl rand -base64 32)" >> "$ENV_FILE"
  
  # Determine public IP and set URLs
  PUBLIC_IP=$(curl -s ifconfig.me || curl -s ifconfig.co)
  if [ -n "$PUBLIC_IP" ]; then
    echo "Detected public IP: $PUBLIC_IP"
    PUBLIC_DOMAIN="${PUBLIC_IP}.nip.io"
    echo "PUBLIC_DOMAIN=${PUBLIC_DOMAIN}" >> "$ENV_FILE"
    sed -i "s|^DEMO_PUBLIC_URL=.*|DEMO_PUBLIC_URL=https://erp.${PUBLIC_DOMAIN}|" "$ENV_FILE"
    sed -i "s|^FRAPPE_SITE_NAME=.*|FRAPPE_SITE_NAME=erp.${PUBLIC_DOMAIN}|" "$ENV_FILE"
    sed -i "s|^FRAPPE_SITE_HOST=.*|FRAPPE_SITE_HOST=erp.${PUBLIC_DOMAIN}|" "$ENV_FILE"
    sed -i "s|^N8N_HOST=.*|N8N_HOST=n8n.${PUBLIC_DOMAIN}|" "$ENV_FILE"
    sed -i "s|^N8N_PROTOCOL=.*|N8N_PROTOCOL=https|" "$ENV_FILE"
    sed -i "s|^N8N_WEBHOOK_URL=.*|N8N_WEBHOOK_URL=https://n8n.${PUBLIC_DOMAIN}|" "$ENV_FILE"
    sed -i "s|^CHATWOOT_FRONTEND_URL=.*|CHATWOOT_FRONTEND_URL=https://chatwoot.${PUBLIC_DOMAIN}|" "$ENV_FILE"
    sed -i "s|^POSTIZ_PUBLIC_URL=.*|POSTIZ_PUBLIC_URL=https://social.${PUBLIC_DOMAIN}|" "$ENV_FILE"
  else
    echo "Warning: Could not detect public IP. You will need to edit /opt/muslimbot/secrets/muslimbot.env manually."
  fi
else
  echo ".env already exists in /opt/muslimbot/secrets/muslimbot.env, skipping generation."
  ln -sf /opt/muslimbot/secrets/muslimbot.env .env
fi

echo "==> Validating Compose..."
docker compose --profile support --profile voice config >/dev/null
echo "Compose configuration is valid."

echo "==> Building Docker images (this may take a while)..."
docker build -t localhost/small-erp:latest .
docker compose --profile support --profile voice build

echo "==> Starting application stack (core + support + voice)..."
docker compose --profile support --profile voice up -d

echo "==> Waiting for services to stabilize..."
sleep 20

echo "==> Initializing ERPNext and Chatwoot (install-demo.sh)..."
export COMPOSE_PROFILES=support,voice
bash small_erp/scripts/install-demo.sh

echo "==> Starting Edge Stack (Traefik, Authentik, Orchestrator, TryPost)..."
cd /opt/muslimbot/repo
docker compose --env-file /opt/muslimbot/secrets/muslimbot.env -f MuslimBot/docker-compose.yml -f docker-compose.extended.yml --profile support --profile voice build
docker compose --env-file /opt/muslimbot/secrets/muslimbot.env -f MuslimBot/docker-compose.yml -f docker-compose.extended.yml --profile support --profile voice up -d

echo ""
echo "=========================================================="
echo "Deployment successful!"
echo ""
echo "For secure local access via SSH tunnels (run this on your laptop):"
echo "gcloud compute ssh muslimbot-host-prod \\"
echo "  --zone=asia-south1-a \\"
echo "  --project=gen-lang-client-0113022969 \\"
echo "  -- \\"
echo "  -L 8000:localhost:8000 -L 5173:localhost:5173 \\"
echo "  -L 5678:localhost:5678 -L 8787:localhost:8787 \\"
echo "  -L 3000:localhost:3000"
echo ""
echo "Or wait until edge stack (Traefik/DNS/TLS) is configured."
echo "=========================================================="
