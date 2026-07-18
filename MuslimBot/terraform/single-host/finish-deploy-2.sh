#!/bin/bash
set -ex
cd /opt/muslimbot/repo/MuslimBot
export COMPOSE_PROFILES=support,voice

sudo docker compose --env-file /opt/muslimbot/secrets/muslimbot.env -f docker-compose.yml -f ../docker-compose.extended.yml --profile support --profile voice build
sudo docker compose --env-file /opt/muslimbot/secrets/muslimbot.env -f docker-compose.yml -f ../docker-compose.extended.yml --profile support --profile voice up -d
