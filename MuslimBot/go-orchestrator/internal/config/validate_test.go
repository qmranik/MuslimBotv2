package config

import "testing"

func TestMustValidate_LocalExempt(t *testing.T) {
	c := &Config{Env: "local", AuthLocalBypass: true} // unsafe values, but local
	if err := c.MustValidate(); err != nil {
		t.Fatalf("local env must be exempt: %v", err)
	}
}

func TestMustValidate_ProductionRejectsUnsafe(t *testing.T) {
	c := &Config{Env: "production", AuthLocalBypass: true, TrustedProxyCIDRs: ""}
	if err := c.MustValidate(); err == nil {
		t.Fatal("production with bypass + no trusted proxy must fail validation")
	}
}

func TestMustValidate_ProductionPasses(t *testing.T) {
	c := &Config{
		Env:                       "production",
		AuthLocalBypass:           false,
		TrustedProxyCIDRs:         "172.20.0.0/16",
		OrchestratorServiceAPIKey: "a-real-key",
		WebhookSecret:             "a-real-secret",
		DatabaseURL:               "postgres://user:pass@platform-postgres:5432/orchestrator",
		GeminiAPIKey:              "a-real-gemini-key",
	}
	if err := c.MustValidate(); err != nil {
		t.Fatalf("well-formed production config should pass: %v", err)
	}
}

func TestMustValidate_ProductionRequiresPlatformDB(t *testing.T) {
	c := &Config{
		Env: "production", TrustedProxyCIDRs: "172.20.0.0/16",
		OrchestratorServiceAPIKey: "k", WebhookSecret: "s",
		GeminiAPIKey: "real", DatabaseURL: "", // missing
	}
	if err := c.MustValidate(); err == nil {
		t.Fatal("production without DATABASE_URL must fail (G10 fail-closed / durable confirmations)")
	}
}

func TestMustValidate_ProductionRejectsMockKey(t *testing.T) {
	c := &Config{
		Env: "production", TrustedProxyCIDRs: "172.20.0.0/16",
		OrchestratorServiceAPIKey: "k", WebhookSecret: "s",
		DatabaseURL: "postgres://x", GeminiAPIKey: "mock-key",
	}
	if err := c.MustValidate(); err == nil {
		t.Fatal("production with mock-key must fail")
	}
}

func TestIsProduction(t *testing.T) {
	for env, prod := range map[string]bool{
		"": true, "production": true, "staging": true,
		"local": false, "dev": false, "test": false, "development": false,
	} {
		if (&Config{Env: env}).IsProduction() != prod {
			t.Fatalf("IsProduction(%q) != %v", env, prod)
		}
	}
}
