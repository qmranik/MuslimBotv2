package webhooks

import (
	"testing"

	"muslimbot-orchestrator/internal/config"
)

func cfgWith(base, template string) *config.Config {
	return &config.Config{N8NBaseURL: base, N8NURLTemplate: template}
}

func TestResolveTenantPriority(t *testing.T) {
	// explicit query wins over everything
	if got := ResolveTenant("chatwoot", map[string]any{"account_id": "9"}, "acme", "hdr", "acme.muslimbot.com"); got != "acme" {
		t.Fatalf("query should win, got %q", got)
	}
	// header next
	if got := ResolveTenant("chatwoot", nil, "", "hdrtenant", ""); got != "hdrtenant" {
		t.Fatalf("header should win, got %q", got)
	}
}

func TestResolveTenantChatwootAccount(t *testing.T) {
	body := map[string]any{"account": map[string]any{"id": float64(14)}}
	if got := ResolveTenant("chatwoot", body, "", "", ""); got != "chatwoot-14" {
		t.Fatalf("expected chatwoot-14, got %q", got)
	}
	body2 := map[string]any{"account_id": float64(7)}
	if got := ResolveTenant("chatwoot", body2, "", "", ""); got != "chatwoot-7" {
		t.Fatalf("expected chatwoot-7, got %q", got)
	}
}

func TestResolveTenantSubdomainFallback(t *testing.T) {
	if got := ResolveTenant("generic", nil, "", "", "acme.muslimbot.com:443"); got != "acme" {
		t.Fatalf("expected acme from subdomain, got %q", got)
	}
	if got := ResolveTenant("generic", nil, "", "", "muslimbot.com"); got != "default" {
		t.Fatalf("apex host should be default, got %q", got)
	}
	if got := ResolveTenant("generic", nil, "", "", "www.muslimbot.com"); got != "default" {
		t.Fatalf("www should be default, got %q", got)
	}
}

func TestResolveTenantTwilioStripe(t *testing.T) {
	if got := ResolveTenant("twilio", map[string]any{"AccountSid": "ACxxx"}, "", "", ""); got != "ACxxx" {
		t.Fatalf("twilio AccountSid, got %q", got)
	}
	if got := ResolveTenant("stripe", map[string]any{"account": "acct_123"}, "", "", ""); got != "acct_123" {
		t.Fatalf("stripe account, got %q", got)
	}
}

func TestN8nTarget(t *testing.T) {
	h := &Handler{cfg: cfgWith("http://n8n:5678", "")}
	if got := h.n8nTarget("acme", "chatwoot"); got != "http://n8n:5678/webhook/chatwoot" {
		t.Fatalf("shared base target wrong: %q", got)
	}
	h2 := &Handler{cfg: cfgWith("http://n8n:5678", "http://n8n-{tenant}:5678")}
	if got := h2.n8nTarget("acme", "chatwoot"); got != "http://n8n-acme:5678/webhook/chatwoot" {
		t.Fatalf("isolated template target wrong: %q", got)
	}
}
