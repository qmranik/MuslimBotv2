package config

import (
	"os"
	"testing"
)

func TestActiveRagCorpusID_PrefersV2(t *testing.T) {
	cfg := &Config{GCPRagCorpusID: "legacy", GCPRagCorpusIDV2: "v2corp"}
	if cfg.ActiveRagCorpusID() != "v2corp" {
		t.Fatal(cfg.ActiveRagCorpusID())
	}
	cfg.GCPRagCorpusIDV2 = ""
	if cfg.ActiveRagCorpusID() != "legacy" {
		t.Fatal(cfg.ActiveRagCorpusID())
	}
}

func TestMustValidate_RejectsUnfilteredInProduction(t *testing.T) {
	cfg := &Config{
		Env:                       "production",
		AuthLocalBypass:           false,
		TrustedProxyCIDRs:         "10.0.0.1/32",
		OrchestratorServiceAPIKey: "real-secret-value-here",
		WebhookSecret:             "real-webhook-secret-here",
		RagAllowUnfiltered:        true,
		RagTenancyMode:            "shared_metadata",
	}
	if err := cfg.MustValidate(); err == nil {
		t.Fatal("expected RAG_ALLOW_UNFILTERED rejection")
	}
}

func TestLoadConfig_RAGDefaults(t *testing.T) {
	_ = os.Unsetenv("RAG_ALLOW_UNFILTERED")
	_ = os.Unsetenv("KB_EVENT_STREAM_PREFIX")
	cfg := LoadConfig()
	if cfg.RagAllowUnfiltered {
		t.Fatal("default must be false")
	}
	if cfg.KBEventStreamPrefix != "kb:events:" {
		t.Fatal(cfg.KBEventStreamPrefix)
	}
	if cfg.RagTenancyMode != "shared_metadata" {
		t.Fatal(cfg.RagTenancyMode)
	}
}
