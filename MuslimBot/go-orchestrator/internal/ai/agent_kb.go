package ai

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/auth"
	"muslimbot-orchestrator/internal/knowledge"
	"muslimbot-orchestrator/internal/store"
)

// AgentRetrieveHandler is the workload-authenticated KB retrieve endpoint.
func (h *KBHandler) AgentRetrieveHandler(c *gin.Context) {
	if !auth.HasScope(c, auth.ScopeKBRead) {
		c.JSON(http.StatusForbidden, gin.H{"error": "missing kb:read scope"})
		return
	}
	if !knowledge.VertexConfigured(h.config) {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Vertex AI RAG configurations not set (GCP_PROJECT_ID, GCP_LOCATION, GCP_RAG_CORPUS_ID_V2)",
		})
		return
	}
	access, err := knowledge.PolicyFromWorkload(c)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var req struct {
		Query     string `json:"query"`
		TopK      int    `json:"top_k"`
		SessionID string `json:"session_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.TopK <= 0 {
		req.TopK = 8
	}
	if req.TopK > 20 {
		req.TopK = 20
	}

	ctx := context.Background()
	result, err := knowledge.RetrieveFiltered(ctx, h.config, access, req.Query, req.TopK)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":           result.Query,
		"chunks":          result.Chunks,
		"chunks_used":     result.ChunksUsed,
		"tenant_id":       access.TenantID,
		"session_id":      req.SessionID,
		"kb_generation":   result.KBGeneration,
		"access_policy":   result.AccessPolicy,
		"metadata_filter": result.MetadataFilter,
	})
}

// AgentVoiceBriefHandler returns the cached/generated voice brief for the bound tenant.
func (h *KBHandler) AgentVoiceBriefHandler(c *gin.Context) {
	if !auth.HasScope(c, auth.ScopeKBRead) {
		c.JSON(http.StatusForbidden, gin.H{"error": "missing kb:read scope"})
		return
	}
	access, err := knowledge.PolicyFromWorkload(c)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	brief, err := knowledge.GetOrBuildVoiceBrief(ctx, h.config, access)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	etag := fmt.Sprintf(`W/"kb-%d-%s"`, brief.KBGeneration, brief.Digest)
	if match := c.GetHeader("If-None-Match"); match != "" && match == etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.Header("ETag", etag)
	c.JSON(http.StatusOK, gin.H{
		"tenant_id":     brief.TenantID,
		"context":       brief.Context,
		"kb_generation": brief.KBGeneration,
		"generated_at":  brief.GeneratedAt,
		"digest":        brief.Digest,
		"access_policy": brief.AccessPolicy,
	})
}

// AgentSessionHeartbeatHandler records liveness and returns current KB generation.
func (h *KBHandler) AgentSessionHeartbeatHandler(c *gin.Context) {
	sessionID, _ := c.Get("session_id")
	sid, _ := sessionID.(string)
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if sid == "" || tid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id and tenant_id required"})
		return
	}
	now := time.Now().UTC()
	generation := knowledge.CurrentGeneration(tid)
	if store.DB != nil {
		_ = store.DB.Model(&store.VoiceSession{}).
			Where("id = ? AND tenant_id = ? AND status = ?", sid, tid, "active").
			Updates(map[string]interface{}{
				"last_heartbeat_at": now,
				"kb_generation":     generation,
				"updated_at":        now,
			}).Error
	}
	c.JSON(http.StatusOK, gin.H{
		"session_id":    sid,
		"tenant_id":     tid,
		"kb_generation": generation,
		"heartbeat_at":  now,
	})
}

// AgentSessionEndHandler closes the VoiceSession.
func (h *KBHandler) AgentSessionEndHandler(c *gin.Context) {
	sessionID, _ := c.Get("session_id")
	sid, _ := sessionID.(string)
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Reason == "" {
		req.Reason = "disconnected"
	}
	now := time.Now().UTC()
	if store.DB != nil && sid != "" {
		_ = store.DB.Model(&store.VoiceSession{}).
			Where("id = ? AND tenant_id = ?", sid, tid).
			Updates(map[string]interface{}{
				"status":     "ended",
				"end_reason": req.Reason,
				"ended_at":   now,
				"updated_at": now,
			}).Error
	}
	c.JSON(http.StatusOK, gin.H{
		"session_id": sid,
		"tenant_id":  tid,
		"status":     "ended",
		"reason":     req.Reason,
	})
}
