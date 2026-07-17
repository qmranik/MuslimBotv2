# Skill: terminal_operations

## Description
Guidelines for executing secure, effective, and non-destructive terminal and shell operations within the MuslimBot environment.

## Context
MuslimBot relies heavily on Docker Compose, localized file scripts, and strict multi-container interactions. Terminal operations must respect the boundary between the host OS and the containerized environments.

## Common Operations

### 1. Docker Compose Management
Always use the specific compose file when interacting with the stack.
- **Local Dev:** `docker compose -f docker-compose.local.yml ...`
- **GCP Prod:** `docker compose -f docker-compose.gcp.yml ...`

**Restarting the Brain:**
`docker compose -f docker-compose.local.yml restart go-orchestrator`

**Viewing Container Logs (Crucial for Debugging):**
`docker compose -f docker-compose.local.yml logs -f --tail=100 generative-ui`

### 2. Network Troubleshooting
- **Check Open Ports (macOS/Linux):**
  `lsof -i :7880` (Check if LiveKit is bound correctly).
  `nc -zv localhost 3306` (Check MariaDB).

### 3. Safe Execution Rules
- **Never use `rm -rf` indiscriminately.** If deleting files, explicitly name the targets.
- **Background Processes:** If starting a persistent process outside of docker (not recommended), use `nohup <cmd> &` and log output to a file.
- **No Interactive Prompts:** Avoid commands that wait for user input (like `apt install` without `-y`, or `git rebase -i`), as they will hang the agent execution loop.