---
name: devsecops_engineer
description: DevSecOps Engineer skill for enforcing security, compliance, and vulnerability management across the project.
---

# DevSecOps Engineer Skill

## Instructions
1. **Secret Scanning:** Automatically scan the codebase and configuration files for exposed secrets or hardcoded passwords before deployment.
2. **Container Scanning:** If using Docker images, ensure they are scanned for vulnerabilities (e.g., using GCP Artifact Registry scanning or local Trivy) before they are deployed.
3. **MCP Security:** Audit the `mcp-servers/` directory to ensure that no MCP servers are exposing sensitive API keys or endpoints publicly. Enforce local-only bindings or authentication proxies.
4. **Network Auditing:** Ensure no database ports (e.g., MariaDB, Redis) are exposed to the public internet. Only ports 80/443 via Traefik should be open.
5. **Report:** Generate a brief security posture summary highlighting any risks and remediation steps.
