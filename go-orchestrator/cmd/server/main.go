package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/ai"
	"muslimbot-orchestrator/internal/auth"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/events"
	"muslimbot-orchestrator/internal/gateway"
	"muslimbot-orchestrator/internal/portals"
	"muslimbot-orchestrator/internal/store"
	"muslimbot-orchestrator/internal/tenants"
)

func healthHandler(c *gin.Context) {
	services := map[string]string{
		"orchestrator": "online",
		"frappe":       "offline",
		"n8n":          "offline",
		"chatwoot":     "offline",
		"qdrant":       "offline",
	}

	if res, err := http.Get("http://frappe-web:8000"); err == nil {
		res.Body.Close()
		services["frappe"] = "online"
	}
	
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"services":  services,
		"timestamp": time.Now().Unix(),
		"auth":      "authentik",
	})
}

func main() {
	cfg := config.LoadConfig()
	
	// Initialize Postgres DB (shared with Authentik on platform-postgres)
	store.InitDB()

	r := gin.Default()

	// Initialize service handlers
	proxy, err := gateway.NewRouterProxy(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize proxies: %v", err)
	}
	aiRouter := ai.NewRouter(cfg)
	aiBrain := ai.NewBrain(cfg)
	kbHandler := ai.NewKBHandler(cfg)
	portalsHandler := portals.NewHandler(cfg)
	eventsHandler := events.NewHandler(cfg)
	tenantsHandler := tenants.NewHandler(cfg)

	v1 := r.Group("/v1")
	{
		// ── Public Endpoints (no auth required) ──────────────────
		v1.GET("/sys/health", healthHandler)

		// ── Protected Endpoints ──────────────────────────────────
		// All routes below require Authentik forward-auth headers.
		// Traefik validates the session via Authentik outpost and
		// injects X-authentik-* headers before the request reaches here.
		api := v1.Group("")
		api.Use(auth.AuthentikMiddleware(cfg))
		{
			// Identity — returns the authenticated user's context
			// Replaces the old JWT-based /auth/me, /auth/login, etc.
			api.GET("/auth/me", auth.MeHandler)

			// ERP Proxy — masks Frappe API token, injects X-Frappe-User
			api.Any("/erp/*path", proxy.ErpProxyHandler())
			
			// KB Endpoints (replaces old python-based KB BFF)
			kb := api.Group("/kb")
			{
				kb.GET("/health", kbHandler.HealthHandler)
				kb.GET("/sources", kbHandler.ListSourcesHandler)
				kb.GET("/sources/:source_id", kbHandler.GetSourceHandler)
				kb.POST("/sources/:source_id/sync", kbHandler.SyncSourceHandler)
				kb.DELETE("/sources/:source_id", kbHandler.DeleteSourceHandler)
				kb.POST("/sources/upload", kbHandler.UploadHandler)
				kb.POST("/sources/url", kbHandler.URLHandler)
				kb.POST("/sources/url/classify", kbHandler.ClassifyURLHandler)
				kb.POST("/retrieve", kbHandler.RetrieveHandler)
				kb.POST("/chat", kbHandler.ChatHandler)
				kb.POST("/voice/session", kbHandler.VoiceSessionHandler)
				kb.GET("/voice-brief", kbHandler.VoiceBriefHandler)
				kb.POST("/voice-brief/rebuild", kbHandler.RebuildVoiceBriefHandler)
			}
			
			// Portals — returns embed URLs with SSO handshake
			api.GET("/portals/:app/url", portalsHandler.GetPortalURL)
			
			// Generative UI AI Chat (legacy plain-text)
			api.POST("/ai/chat", aiRouter.ChatHandler)

			// One MuslimBot brain — structured UiDescriptor + server-side tool executor.
			// Consumed by web genUI and erp-flutter; shares the 21-tool catalog with voice.
			api.POST("/ai/generate-ui", aiBrain.GenerateUIHandler)
			api.POST("/ai/tool/execute", aiBrain.ToolExecuteHandler)
			
			// Workflows Trigger (Event Outbox Phase)
			api.POST("/workflows/trigger", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "Workflow triggered successfully"})
			})

			// Events
			api.POST("/events/ingest", eventsHandler.IngestEvent)

			// Tenants
			api.POST("/tenants", tenantsHandler.CreateTenant)
			api.POST("/tenants/:id/onboard", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "onboarded"})
			})
			api.GET("/tenants/:id/status", tenantsHandler.GetTenantStatus)
			api.PATCH("/tenants/:id/features", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "features updated"})
			})

			// Platform
			api.GET("/platform/services", healthHandler)
		}
	}

	log.Printf("Starting liteERP Platform Orchestrator on port :%s\n", cfg.Port)
	log.Println("Auth: Authentik forward-auth via Traefik (X-authentik-* headers)")
	r.Run(":" + cfg.Port)
}
