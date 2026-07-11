package config

import "os"

// Config holds all environment-driven configuration for the orchestrator.
// Auth-related config (JWT, cookies) has been removed — Authentik/Traefik
// now own the session lifecycle. The orchestrator only needs service
// connection details and API tokens for server-to-server calls.
type Config struct {
	Port string

	// Database
	DatabaseURL string

	// Frappe / ERPNext
	FrappeURL      string
	FrappeSiteHost string
	FrappeToken    string
	FrappeSecret   string

	// Muslimbot KB BFF
	KBBffURL    string
	KBBffAPIKey string

	// n8n Workflows
	N8NWebhookURL string

	// Gemini AI
	GeminiAPIKey string
	// Model governance — config-driven, pinned GA models (see MUSLIMBOT_PRODUCTION_PLAN W2.3).
	GeminiRouterModel string // structured generate-ui / chat
	GeminiVoiceModel  string // realtime voice (consumed by the voice worker via /config or env)

	// Chatwoot — server-to-server API for magic link SSO
	ChatwootURL      string
	ChatwootAPIToken string

	// Portal base URLs (OIDC-backed via Authentik)
	NextcloudURL string
	PostizURL    string

	// Authentik — for optional server-side token introspection
	AuthentikInternalURL string

	// Vertex AI & GCS
	GCPProjectID   string
	GCPLocation    string
	GCSBucketName  string
	GCPRagCorpusID string

	// Redis URL
	RedisURL string
}

// LoadConfig reads environment variables and returns a populated Config.
func LoadConfig() *Config {
	port := envOr("PORT", "8080")

	return &Config{
		Port:        port,
		DatabaseURL: os.Getenv("DATABASE_URL"),

		// Frappe
		FrappeURL:      envOr("FRAPPE_URL", "http://frappe-web:8000"),
		FrappeSiteHost: envOr("FRAPPE_SITE_HOST", "small.localhost"),
		FrappeToken:    os.Getenv("FRAPPE_API_KEY"),
		FrappeSecret:   os.Getenv("FRAPPE_API_SECRET"),

		// KB BFF
		KBBffURL:    envOr("KBBFF_URL", "http://muslimbot-kb-bff:8787"),
		KBBffAPIKey: os.Getenv("KBBFF_API_KEY"),

		// n8n
		N8NWebhookURL: os.Getenv("N8N_WEBHOOK_URL"),

		// AI — default to GA flash for the router; override per-env to pin exact GA ids.
		GeminiAPIKey:      os.Getenv("GEMINI_API_KEY"),
		GeminiRouterModel: envOr("GEMINI_ROUTER_MODEL", "gemini-2.0-flash"),
		GeminiVoiceModel:  envOr("GEMINI_VOICE_MODEL", "gemini-2.0-flash-live-001"),

		// Chatwoot
		ChatwootURL:      envOr("CHATWOOT_URL", "http://chatwoot:3000"),
		ChatwootAPIToken: os.Getenv("CHATWOOT_API_TOKEN"),

		// Portals
		NextcloudURL: envOr("NEXTCLOUD_URL", "https://files.smb.localhost"),
		PostizURL:    envOr("POSTIZ_URL", "https://social.smb.localhost"),

		// Authentik
		AuthentikInternalURL: envOr("AUTHENTIK_INTERNAL_URL", "http://authentik-server:9000"),

		// Vertex AI & GCS
		GCPProjectID:   os.Getenv("GCP_PROJECT_ID"),
		GCPLocation:    envOr("GCP_LOCATION", "us-central1"),
		GCSBucketName:  os.Getenv("GCS_BUCKET_NAME"),
		GCPRagCorpusID: os.Getenv("GCP_RAG_CORPUS_ID"),

		// Redis URL
		RedisURL: envOr("REDIS_URL", "redis://redis-cache:6379/2"),
	}
}

// envOr returns the value of the environment variable named key,
// or fallback if the variable is empty or unset.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
