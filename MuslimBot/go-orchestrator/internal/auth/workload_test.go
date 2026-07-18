package auth

import (
	"testing"
	"time"

	"muslimbot-orchestrator/internal/config"
)

func TestMintAndParseWorkloadToken(t *testing.T) {
	cfg := ConfigStub()
	token, jti, err := MintWorkloadToken(
		cfg, "acme", "muslimbot-room-1", "VS-1", "user@acme.test", "User",
		DefaultVoiceScopes(), time.Hour,
	)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if jti == "" || token == "" {
		t.Fatal("expected token and jti")
	}
	claims, err := ParseWorkloadToken(cfg, token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.TenantID != "acme" || claims.RoomName != "muslimbot-room-1" || claims.SessionID != "VS-1" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
	if len(claims.Scopes) != 3 {
		t.Fatalf("expected 3 scopes, got %v", claims.Scopes)
	}
}

func TestParseWorkloadTokenRejectsTampered(t *testing.T) {
	cfg := ConfigStub()
	token, _, err := MintWorkloadToken(cfg, "acme", "room", "VS-1", "u@t", "U", DefaultVoiceScopes(), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ParseWorkloadToken(cfg, token+"x")
	if err == nil {
		t.Fatal("expected parse failure for tampered token")
	}
}

func ConfigStub() *config.Config {
	return &config.Config{
		WorkloadJWTSecret:         "test-workload-secret",
		OrchestratorServiceAPIKey: "test-service-key",
	}
}
