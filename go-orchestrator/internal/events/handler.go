package events

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

type Handler struct {
	config *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{config: cfg}
}

type EventRequest struct {
	Type           string                 `json:"type"`
	TenantID       string                 `json:"tenant_id"`
	Source         string                 `json:"source"`
	Data           map[string]interface{} `json:"data"`
	IdempotencyKey string                 `json:"idempotency_key"`
}

func (h *Handler) IngestEvent(c *gin.Context) {
	var req EventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event payload"})
		return
	}

	tenantID := req.TenantID
	if tenantID == "" {
		if t, ok := c.Get("tenant_id"); ok {
			tenantID, _ = t.(string)
		}
	}
	if tenantID == "" {
		tenantID = "default"
	}

	payloadBytes, _ := json.Marshal(req.Data)

	event := store.EventOutbox{
		Type:           req.Type,
		TenantID:       tenantID,
		Source:         req.Source,
		Payload:        string(payloadBytes),
		IdempotencyKey: req.IdempotencyKey,
		Status:         "pending",
	}

	if store.DB != nil {
		if err := store.DB.Create(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist event"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ingested", "event_id": event.ID})
}
