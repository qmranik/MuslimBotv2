package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/actions"
	"muslimbot-orchestrator/internal/ai"
	"muslimbot-orchestrator/internal/auth"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/events"
	"muslimbot-orchestrator/internal/gateway"
	"muslimbot-orchestrator/internal/knowledge"
	"muslimbot-orchestrator/internal/mcp"
	"muslimbot-orchestrator/internal/observability"
	"muslimbot-orchestrator/internal/portals"
	"muslimbot-orchestrator/internal/ratelimit"
	"muslimbot-orchestrator/internal/store"
	"muslimbot-orchestrator/internal/tenants"
	"muslimbot-orchestrator/internal/voice"
	"muslimbot-orchestrator/internal/webhooks"
	"muslimbot-orchestrator/internal/workflows"
)

func probe(url string) string {
	if url == "" {
		return "unconfigured"
	}
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
			"livekit":      "unconfigured",
			"vertex_rag":   "unconfigured",
			"redis":        "unconfigured",
		}
		if cfg.LiveKitInternalURL != "" || cfg.LiveKitPublicURL != "" {
			services["livekit"] = "configured"
		}
		if ai.VertexConfigured(cfg) {
			services["vertex_rag"] = "configured"
		}
		if cfg.RedisURL != "" {
			services["redis"] = "configured"
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

	if err := cfg.MustValidate(); err != nil {
		log.Fatalf("[config] %v", err)
	}

	store.InitDB()

	aiLimiter := ratelimit.New(cfg.AIRateLimitPerMin, cfg.AIRateLimitBurst)

	r := gin.New()
	r.Use(gin.Recovery(), observability.RequestLogger())

	proxy, err := gateway.NewRouterProxy(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize proxies: %v", err)
	}
	mcpManager := mcp.NewManager(cfg)
	mcpHandler := mcp.NewHandler(mcpManager)
	aiRouter := ai.NewRouter(cfg, mcpManager)
	aiBrain := ai.NewBrain(cfg)
	kbHandler := ai.NewKBHandler(cfg)
	knowledgeHandler := knowledge.NewHandler(cfg)
	portalsHandler := portals.NewHandler(cfg)
	eventsHandler := events.NewHandler(cfg)
	tenantsHandler := tenants.NewHandler(cfg)
	webhooksHandler := webhooks.NewHandler(cfg)
	workflowsHandler := workflows.NewHandler(cfg)
	voiceHandler := voice.NewHandler(cfg)

	frappeClient := ai.NewFrappeClient(cfg)
	kbClient := ai.NewKBClient(cfg)
	n8nClient := ai.NewN8NClient(cfg)
	executor := ai.NewExecutor(frappeClient, kbClient, n8nClient)
	actionsHandler := actions.NewHandler(cfg, executor)

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

			api.GET("/erp/*path", proxy.ErpProxyHandler())
			api.HEAD("/erp/*path", proxy.ErpProxyHandler())

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

			aiGroup := api.Group("/ai")
			aiGroup.Use(aiLimiter.Middleware())
			{
				aiGroup.POST("/chat", aiRouter.ChatHandler)
				aiGroup.POST("/generate-ui", aiBrain.GenerateUIHandler)
				aiGroup.POST("/tool/execute", aiBrain.ToolExecuteHandler)
			}

			mcpGroup := api.Group("/mcp")
			{
				mcpGroup.GET("/servers", mcpHandler.GetServers)
				mcpGroup.GET("/tools", mcpHandler.GetTools)
				mcpGroup.POST("/call", mcpHandler.CallTool)
			}

			api.POST("/workflows/trigger", workflowsHandler.Trigger)
			api.POST("/events/ingest", eventsHandler.IngestEvent)
			api.POST("/tenants", tenantsHandler.CreateTenant)
			api.POST("/tenants/:id/onboard", tenantsHandler.Onboard)
			api.GET("/tenants/:id/status", tenantsHandler.GetTenantStatus)
			api.PATCH("/tenants/:id/features", tenantsHandler.UpdateFeatures)
			api.GET("/platform/services", healthHandler(cfg))
		}

		// LiveKit worker surface — JWT-bound tenant/session/scopes.
		agent := v1.Group("/agent")
		agent.Use(auth.WorkloadMiddleware(cfg))
		{
			agent.GET("/tools", actionsHandler.ListTools)
			agent.POST("/kb/retrieve", kbHandler.AgentRetrieveHandler)
			agent.GET("/kb/voice-brief", kbHandler.AgentVoiceBriefHandler)
			agent.POST("/tool-actions", actionsHandler.Prepare)
			agent.POST("/tool-actions/:id/confirm", actionsHandler.Confirm)
			agent.GET("/tool-actions/:id", actionsHandler.Get)
		}
	}

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}

	go func() {
		log.Printf("Starting liteERP Platform Orchestrator on port :%s\n", cfg.Port)
		log.Println("Auth: Authentik forward-auth via Traefik; workers via workload JWT")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down — draining connections and webhook queue...")

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("http shutdown: %v", err)
	}
	if err := webhooksHandler.Shutdown(ctx); err != nil {
		log.Printf("webhook pool drain: %v", err)
	}
	log.Println("Shutdown complete.")
}
