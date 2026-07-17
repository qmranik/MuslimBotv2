# Skill: devsecops_practices

## Description
Integrates security, privacy, and continuous operations into the MuslimBot ecosystem. This skill focuses on PII masking, secret scanning, and image verification.

## Core Practices

### 1. PII Masking (Validation Protocol v3.0)
MuslimBot routes user interactions through LLMs. It is critical that Personally Identifiable Information (PII) does not leak to external providers.
- **Mechanism:** Microsoft Presidio is integrated into the orchestrator pipeline.
- **Testing:** When writing tests or simulating AI interactions, ensure the payload is verified against the Presidio anonymizer.
  - *Example:* "My phone number is 555-1234" must be masked to "My phone number is [PHONE_NUMBER]" before hitting the LLM.

### 2. Secret Management
- **Never commit secrets:** `.env` files must be ignored.
- **Secret Manager:** Use GCP Secret Manager (via Terraform) for production.
- **Detection:** Run `trufflehog` or similar tools on the repository if suspected leaks occur.

### 3. Image Security
- Ensure all `docker-compose` images are pinned to specific versions (e.g., `n8nio/n8n:1.64.3`), not `latest`. This prevents unexpected upstream poisoning and ensures deterministic builds.

## Incident Response
If a security violation is detected (e.g., exposed API key):
1. Immediately invoke the API key revocation tool (`small_erp/revoke_keys`).
2. Rotate the secret in GCP Secret Manager.
3. Restart the `go-orchestrator` container to flush cached tokens.