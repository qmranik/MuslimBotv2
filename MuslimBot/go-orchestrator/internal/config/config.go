package config

import (
	"os"
	"strconv"
	"strings"
)

// IsProduction reports whether the runtime is a non-local environment. Empty
// ENV is treated as production (fail-safe): security gates that must not be
// disabled by accident should key off this, not off ENV=="production".
func (c *Config) IsProduction() bool {
	switch c.Env {
	case "local", "test", "dev", "development":
		return false
	default:
		return true
	}
}

type Config struct {
	Port string
	Env  string

	DatabaseURL string

	FrappeURL      string
	FrappeSiteHost string
	FrappeToken    string
	FrappeSecret   string

	// OrchestratorServiceAPIKey authenticates trusted internal callers
	// (n8n, migration aliases). Prefer WorkloadJWTSecret for LiveKit workers.
	OrchestratorServiceAPIKey string
	WorkloadJWTSecret         string

	LiveKitInternalURL string
	LiveKitPublicURL   string
	LiveKitAPIKey      string
	LiveKitAPISecret   string
	LiveKitAgentName   string

	// Deprecated aliases kept for cutover compatibility.
	KBBffURL    string
	KBBffAPIKey string

	N8NWebhookURL  string
	N8NBaseURL     string
	N8NURLTemplate string
	N8NPublicURL   string
	WebhookSecret  string

	// Webhook ingestion worker pool (N4). QueueSize bounds the in-memory buffer;
	// Workers=0 → NumCPU*4.
	WebhookQueueSize int
	WebhookWorkers   int

	GeminiAPIKey      string
	GeminiRouterModel string
	GeminiVoiceModel  string

	ChatwootURL           string
	ChatwootPublicURL     string
	ChatwootAPIToken      string
	ChatwootPlatformToken string

	NextcloudURL    string
	FrappePublicURL string

	// Social scheduling = TryPost (MCP-native, replaces Postiz).
	// TryPostURL is the embeddable portal URL; the MCP/REST surface is what the
	// orchestrator ingests so GenUI can draft/schedule/read analytics agentically.
	TryPostURL        string
	TryPostMCPURL     string
	TryPostAPIToken   string
	TryPostMCPEnabled bool

	// Chatwoot agentic layer = fazer-ai/mcp-chatwoot (stdio, spawned as a subprocess).
	// It reuses ChatwootURL + ChatwootAPIToken (CHATWOOT_BASE_URL / CHATWOOT_API_TOKEN).
	ChatwootMCPEnabled bool

	// MCPWriteTools is a comma-separated allowlist of glob patterns (matched against
	// "server:tool" and bare "tool") that force an MCP tool to be treated as a
	// state-changing WRITE — routed through user confirmation (GAP-2). A verb
	// heuristic covers the common cases; this list handles exceptions.
	MCPWriteTools string

	AuthentikInternalURL string

	// AuthLocalBypass gates the dev-only "inject Administrator when headers are
	// absent" path (G4). It must be explicitly enabled AND ENV=local; it fails
	// closed otherwise so a production deploy can never silently run open.
	AuthLocalBypass bool

	// TrustedProxyCIDRs is the comma-separated allowlist of source networks
	// permitted to supply X-authentik-* identity headers (G2). Only Traefik's
	// forward-auth hop should be here. When set, headers from any other peer
	// (n8n, Chatwoot, a rogue container on the shared network) are rejected.
	TrustedProxyCIDRs string

	// AIRateLimitPerMin / AIRateLimitBurst cap billable /v1/ai/* traffic per
	// tenant (P8). 0 disables the limiter.
	AIRateLimitPerMin int
	AIRateLimitBurst  int

	PlatformBaseDomain string

	GCPProjectID   string
	GCPLocation    string
	GCSBucketName  string
	GCPRagCorpusID string
	// GCPRagCorpusIDV2 is the metadata-tagged shared corpus (ADR-0002).
	GCPRagCorpusIDV2 string

	// RAG tenancy (shared corpus + mandatory metadata filters).
	RagTenancyMode            string
	RagMetadataSchemaVersion  string
	RagAllowUnfiltered        bool
	KBEventStreamPrefix       string
	KBBriefTTLSec             int
	KBRetrieveCacheTTLSec     int
	KBEventStreamMaxLen       int64

	RedisURL string
}

func LoadConfig() *Config {
	port := envOr("PORT", "8080")

	return &Config{
		Port:        port,
		Env:         os.Getenv("ENV"),
		DatabaseURL: os.Getenv("DATABASE_URL"),

		FrappeURL:      envOr("FRAPPE_URL", "http://frappe-web:8000"),
		FrappeSiteHost: envOr("FRAPPE_SITE_HOST", "small.localhost"),
		FrappeToken:    os.Getenv("FRAPPE_API_KEY"),
		FrappeSecret:   os.Getenv("FRAPPE_API_SECRET"),

		OrchestratorServiceAPIKey: firstEnv("ORCHESTRATOR_SERVICE_API_KEY", "KBBFF_API_KEY", "KB_BFF_API_KEY"),
		WorkloadJWTSecret:         firstEnv("WORKLOAD_JWT_SECRET", "ORCHESTRATOR_SERVICE_API_KEY", "KBBFF_API_KEY", "KB_BFF_API_KEY"),

		LiveKitInternalURL: firstEnv("LIVEKIT_INTERNAL_URL", "LIVEKIT_URL"),
		LiveKitPublicURL:   firstEnv("LIVEKIT_PUBLIC_URL", "LIVEKIT_URL"),
		LiveKitAPIKey:      os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret:   os.Getenv("LIVEKIT_API_SECRET"),
		LiveKitAgentName:   envOr("LIVEKIT_AGENT_NAME", "muslimbot"),

		KBBffURL:    envOr("KBBFF_URL", ""),
		KBBffAPIKey: firstEnv("KBBFF_API_KEY", "KB_BFF_API_KEY", "ORCHESTRATOR_SERVICE_API_KEY"),

		N8NWebhookURL:  os.Getenv("N8N_WEBHOOK_URL"),
		N8NBaseURL:     envOr("N8N_BASE_URL", "http://n8n:5678"),
		N8NURLTemplate: os.Getenv("N8N_URL_TEMPLATE"),
		N8NPublicURL:   envOr("N8N_PUBLIC_URL", "https://workflow.smb.localhost"),
		WebhookSecret:  os.Getenv("WEBHOOK_SECRET"),

		WebhookQueueSize: envInt("QUEUE_SIZE", 10000),
		WebhookWorkers:   envInt("WEBHOOK_WORKERS", 0),

		GeminiAPIKey:      os.Getenv("GEMINI_API_KEY"),
		GeminiRouterModel: envOr("GEMINI_ROUTER_MODEL", "gemini-2.0-flash"),
		GeminiVoiceModel:  envOr("GEMINI_VOICE_MODEL", "gemini-2.0-flash-live-001"),

		ChatwootURL:           envOr("CHATWOOT_URL", "http://chatwoot:3000"),
		ChatwootPublicURL:     envOr("CHATWOOT_PUBLIC_URL", "https://chat.smb.localhost"),
		ChatwootAPIToken:      os.Getenv("CHATWOOT_API_TOKEN"),
		ChatwootPlatformToken: firstEnv("CHATWOOT_PLATFORM_TOKEN", "CHATWOOT_API_TOKEN"),

		NextcloudURL:    envOr("NEXTCLOUD_URL", "https://files.smb.localhost"),
		FrappePublicURL: envOr("FRAPPE_PUBLIC_URL", "https://erp.smb.localhost"),

		// TRYPOST_URL supersedes POSTIZ_URL (kept as a deprecated fallback).
		TryPostURL:        envOr("TRYPOST_URL", envOr("POSTIZ_URL", "https://social.smb.localhost")),
		TryPostMCPURL:     os.Getenv("TRYPOST_MCP_URL"),
		TryPostAPIToken:   os.Getenv("TRYPOST_API_TOKEN"),
		TryPostMCPEnabled: envOr("TRYPOST_MCP_ENABLED", "false") == "true",

		ChatwootMCPEnabled: envOr("CHATWOOT_MCP_ENABLED", "false") == "true",
		MCPWriteTools:      os.Getenv("MCP_WRITE_TOOLS"),

		AuthentikInternalURL: envOr("AUTHENTIK_INTERNAL_URL", "http://authentik-server:9000"),

		AuthLocalBypass:   envOr("AUTH_LOCAL_BYPASS", "false") == "true",
		TrustedProxyCIDRs: os.Getenv("TRUSTED_PROXY_CIDRS"),
		AIRateLimitPerMin: envInt("AI_RATE_LIMIT_PER_MIN", 30),
		AIRateLimitBurst:  envInt("AI_RATE_LIMIT_BURST", 10),

		PlatformBaseDomain: envOr("PLATFORM_BASE_DOMAIN", "smb.localhost"),

		GCPProjectID:     os.Getenv("GCP_PROJECT_ID"),
		GCPLocation:      envOr("GCP_LOCATION", "us-central1"),
		GCSBucketName:    os.Getenv("GCS_BUCKET_NAME"),
		GCPRagCorpusID:   os.Getenv("GCP_RAG_CORPUS_ID"),
		GCPRagCorpusIDV2: os.Getenv("GCP_RAG_CORPUS_ID_V2"),

		RagTenancyMode:           envOr("RAG_TENANCY_MODE", "shared_metadata"),
		RagMetadataSchemaVersion: envOr("RAG_METADATA_SCHEMA_VERSION", "2"),
		RagAllowUnfiltered:       envOr("RAG_ALLOW_UNFILTERED", "false") == "true",
		KBEventStreamPrefix:      envOr("KB_EVENT_STREAM_PREFIX", "kb:events:"),
		KBBriefTTLSec:            envInt("KB_BRIEF_TTL_SEC", 86400),
		KBRetrieveCacheTTLSec:    envInt("KB_RETRIEVE_CACHE_TTL_SEC", 60),
		KBEventStreamMaxLen:      int64(envInt("KB_EVENT_STREAM_MAXLEN", 5000)),

		RedisURL: envOr("REDIS_URL", "redis://redis-cache:6379/2"),
	}
}

// ActiveRagCorpusID returns the corpus used for new ingestion and filtered retrieve.
// Prefers V2 when set (ADR-0002 cutover).
func (c *Config) ActiveRagCorpusID() string {
	if c == nil {
		return ""
	}
	if strings.TrimSpace(c.GCPRagCorpusIDV2) != "" {
		return strings.TrimSpace(c.GCPRagCorpusIDV2)
	}
	return strings.TrimSpace(c.GCPRagCorpusID)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return ""
}
