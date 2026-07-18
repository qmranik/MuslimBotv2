package ai

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/auth"
)

// AgentRetrieveHandler is the workload-authenticated KB retrieve endpoint.
func (h *KBHandler) AgentRetrieveHandler(c *gin.Context) {
	if !auth.HasScope(c, auth.ScopeKBRead) {
		c.JSON(http.StatusForbidden, gin.H{"error": "missing kb:read scope"})
		return
	}
	if !VertexConfigured(h.config) {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Vertex AI RAG configurations not set (GCP_PROJECT_ID, GCP_LOCATION, GCP_RAG_CORPUS_ID)",
		})
		return
	}
	tenantID, _ := c.Get("tenant_id")
	tid, _ := tenantID.(string)
	if tid == "" {
		tid = "default"
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
	chunks, err := RetrieveContextsFromVertex(ctx, h.config, req.Query, req.TopK)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":       req.Query,
		"chunks":      chunks,
		"chunks_used": len(chunks),
		"tenant_id":   tid,
		"session_id":  req.SessionID,
	})
}

// AgentVoiceBriefHandler returns the cached/generated voice brief for the bound tenant.
func (h *KBHandler) AgentVoiceBriefHandler(c *gin.Context) {
	if !auth.HasScope(c, auth.ScopeKBRead) {
		c.JSON(http.StatusForbidden, gin.H{"error": "missing kb:read scope"})
		return
	}
	h.VoiceBriefHandler(c)
}
