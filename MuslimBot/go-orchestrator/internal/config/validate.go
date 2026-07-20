package config

import (
	"fmt"
	"strings"
)

// insecureDefaults are placeholder secret values that must never reach a
// production runtime. Compose files ship these so local dev works out of the
// box; MustValidate ensures they are overridden before a production boot.
var insecureDefaults = map[string]bool{
	"":                      true,
	"changeme":              true,
	"changeme_in_production": true,
	"change_me":             true,
	"placeholder":           true,
	"secret":                true,
}

// MustValidate enforces the production security floor at boot. It returns an
// error listing every violation; callers should treat a non-nil result as
// fatal (refuse to start). Local/dev/test environments are exempt from the
// production-only checks so the developer experience is unchanged.
func (c *Config) MustValidate() error {
	if !c.IsProduction() {
		return nil
	}

	var problems []string

	if c.AuthLocalBypass {
		problems = append(problems, "AUTH_LOCAL_BYPASS=true in a production environment (would run open — G4)")
	}
	if strings.TrimSpace(c.TrustedProxyCIDRs) == "" {
		problems = append(problems, "TRUSTED_PROXY_CIDRS is empty (X-authentik-* headers would be trusted from any peer — G2). Set it to Traefik's network only")
	}

	// Placeholder secrets must be overridden (G6/P5).
	for name, val := range map[string]string{
		"ORCHESTRATOR_SERVICE_API_KEY": c.OrchestratorServiceAPIKey,
		"WEBHOOK_SECRET":               c.WebhookSecret,
	} {
		if insecureDefaults[strings.ToLower(strings.TrimSpace(val))] {
			problems = append(problems, fmt.Sprintf("%s is unset or a known placeholder — set a real secret", name))
		}
	}

	// G10 + durable confirmations: a platform DB must be configured in production.
	// Without it, resolveTenant() falls back to the single-tenant "default" scope
	// (cross-tenant leakage risk) and human/voice write confirmations cannot
	// persist. GAP-6.
	if strings.TrimSpace(c.DatabaseURL) == "" {
		problems = append(problems, "DATABASE_URL is empty — a platform DB is required in production for tenant fail-closed resolution (G10) and durable tool-action confirmations")
	}

	// GAP-8: the mock Gemini key ships a canned response — never in production.
	if strings.TrimSpace(c.GeminiAPIKey) == "mock-key" {
		problems = append(problems, "GEMINI_API_KEY=mock-key returns canned responses — set a real key in production")
	}

	// ADR-0002: never allow unfiltered shared-corpus retrieval in production.
	if c.RagAllowUnfiltered {
		problems = append(problems, "RAG_ALLOW_UNFILTERED=true is forbidden in production (tenant isolation)")
	}
	if c.RagTenancyMode != "" && c.RagTenancyMode != "shared_metadata" {
		problems = append(problems, fmt.Sprintf("unsupported RAG_TENANCY_MODE=%q (expected shared_metadata)", c.RagTenancyMode))
	}

	if len(problems) > 0 {
		return fmt.Errorf("production config validation failed:\n  - %s", strings.Join(problems, "\n  - "))
	}
	return nil
}
