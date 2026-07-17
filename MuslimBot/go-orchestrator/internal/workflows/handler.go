package workflows

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

type Handler struct {
	cfg *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg}
}

type triggerRequest struct {
	Workflow       string         `json:"workflow"`
	Payload        map[string]any `json:"payload"`
	IdempotencyKey string         `json:"idempotency_key"`
}

func (h *Handler) Trigger(c *gin.Context) {
	var req triggerRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Workflow) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workflow required"})
		return
	}
	tenant, _ := c.Get("tenant_id")
	tenantID, _ := tenant.(string)
	if tenantID == "" {
		tenantID = "default"
	}
	user, _ := c.Get("user_email")
	email, _ := user.(string)

	if req.Payload == nil {
		req.Payload = map[string]any{}
	}
	req.Payload["_triggered_by"] = email
	req.Payload["_tenant_id"] = tenantID

	body, _ := json.Marshal(req.Payload)
	idem := strings.TrimSpace(req.IdempotencyKey)
	if idem == "" {
		idem = uuid.NewString()
	}

	event := store.EventOutbox{
		Type:           "workflow.trigger",
		TenantID:       tenantID,
		Source:         req.Workflow,
		Payload:        string(body),
		IdempotencyKey: idem,
		Status:         "pending",
	}
	if store.DB != nil {
		if err := store.DB.Create(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue workflow"})
			return
		}
	}

	c.JSON(http.StatusAccepted, gin.H{
		"status":   "accepted",
		"event_id": event.ID,
		"workflow": req.Workflow,
		"tenant":   tenantID,
	})
}
