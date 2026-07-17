#!/usr/bin/env bash
cd go-orchestrator

# login and get keys
OUTPUT=$(python3 -c "
import requests, sys, json
url='http://localhost:8000/api/method/small_erp.api.auth.login_to_get_keys'
res=requests.post(url, json={'usr':'Administrator','pwd':'admin'}, headers={'Host':'small.localhost'})
if res.status_code != 200: sys.exit(1)
data=res.json()['message']
print(f\"{data['api_key']}:{data['api_secret']}\")
")

export FRAPPE_API_KEY=$(echo $OUTPUT | cut -d: -f1)
export FRAPPE_API_SECRET=$(echo $OUTPUT | cut -d: -f2)
export PORT=8080
export FRAPPE_URL=http://localhost:8000

echo "Starting Go Orchestrator with Key: $FRAPPE_API_KEY"
go run ./cmd/server/main.go
