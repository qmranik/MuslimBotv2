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
	"muslimbot-orchestrator/internal/knowledge"
	"muslimbot-orchestrator/internal/observability"
	"muslimbot-orchestrator/internal/portals"
	"muslimbot-orchestrator/internal/store"
	"muslimbot-orchestrator/internal/tenants"
	"muslimbot-orchestrator/internal/webhooks"
	"muslimbot-orchestrator/internal/workflows"
	"muslimbot-orchestrator/internal/voice"
)

func probe(url string) string {
	client := &http.Client{Timeout: 2 * time.Second}
	res, err := client.Get(url)
	if err != nil {
		return "offline"
	}
	res.Body.Close()
	return "online"
}

func healthHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		services := map[string]string{
			"orchestrator": "online",
			"frappe":       probe(cfg.FrappeURL),
			"kb_bff":       probe(cfg.KBBffURL + "/health"),
			"vertex_rag":   "unconfigured",
		}
		if ai.VertexConfigured(cfg) {
			services["vertex_rag"] = "configured"
		}
		dbStatus := "unknown"
		if store.DB != nil {
			if sqlDB, err := store.DB.DB(); err == nil && sqlDB.Ping() == nil {
				dbStatus = "online"
			} else {
				dbStatus = "offline"
			}
		}
		services["platform_db"] = dbStatus

		status := "healthy"
		if services["frappe"] == "offline" {
			status = "degraded"
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    status,
			"services":  services,
			"models":    gin.H{"router": cfg.GeminiRouterModel, "voice": cfg.GeminiVoiceModel},
			"timestamp": time.Now().Unix(),
			"auth":      "authentik",
		})
	}
}

func main() {
	cfg := config.LoadConfig()

	store.InitDB()

	r := gin.New()
	r.Use(gin.Recovery(), observability.RequestLogger())

	proxy, err := gateway.NewRouterProxy(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize proxies: %v", err)
	}
	aiRouter := ai.NewRouter(cfg)
	aiBrain := ai.NewBrain(cfg)
	kbHandler := ai.NewKBHandler(cfg)
	knowledgeHandler := knowledge.NewHandler(cfg)
	portalsHandler := portals.NewHandler(cfg)
	eventsHandler := events.NewHandler(cfg)
	tenantsHandler := tenants.NewHandler(cfg)
	webhooksHandler := webhooks.NewHandler(cfg)
	workflowsHandler := workflows.NewHandler(cfg)
	voiceHandler := voice.NewHandler(cfg)

	events.NewDispatcher(cfg).Start()

	v1 := r.Group("/v1")
	{
		v1.GET("/sys/health", healthHandler(cfg))
		v1.POST("/webhooks/:source", webhooksHandler.Ingest)

		api := v1.Group("")
		api.Use(auth.AuthentikMiddleware(cfg))
		{
			api.GET("/auth/me", auth.MeHandler)
			api.GET("/voice/token", voiceHandler.GetToken)

			api.Any("/erp/*path", proxy.ErpProxyHandler())

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

				kb.POST("/org", knowledgeHandler.RegisterSource)
				kb.GET("/org", knowledgeHandler.ListSources)
				kb.DELETE("/org/:id", knowledgeHandler.DeleteSource)
			}

			api.GET("/portals/:app/url", portalsHandler.GetPortalURL)

			api.POST("/ai/chat", aiRouter.ChatHandler)
			api.POST("/ai/generate-ui", aiBrain.GenerateUIHandler)
			api.POST("/ai/tool/execute", aiBrain.ToolExecuteHandler)

			api.POST("/workflows/trigger", workflowsHandler.Trigger)

			api.POST("/events/ingest", eventsHandler.IngestEvent)

			api.POST("/tenants", tenantsHandler.CreateTenant)
			api.POST("/tenants/:id/onboard", tenantsHandler.Onboard)
			api.GET("/tenants/:id/status", tenantsHandler.GetTenantStatus)
			api.PATCH("/tenants/:id/features", tenantsHandler.UpdateFeatures)

			api.GET("/platform/services", healthHandler(cfg))
		}
	}

	log.Printf("Starting liteERP Platform Orchestrator on port :%s\n", cfg.Port)
	log.Println("Auth: Authentik forward-auth via Traefik (X-authentik-* headers)")
	r.Run(":" + cfg.Port)
}
