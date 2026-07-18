package actions

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"muslimbot-orchestrator/internal/ai"
	"muslimbot-orchestrator/internal/auth"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

const confirmationTTL = 5 * time.Minute

// Handler exposes durable prepare/confirm tool-action APIs for voice workers.
type Handler struct {
	cfg      *config.Config
	executor *ai.Executor
}

func NewHandler(cfg *config.Config, executor *ai.Executor) *Handler {
	return &Handler{cfg: cfg, executor: executor}
}

type prepareRequest struct {
	Tool           string         `json:"tool" binding:"required"`
	Arguments      map[string]any `json:"arguments"`
	IdempotencyKey string         `json:"idempotency_key"`
}

type confirmRequest struct {
	Decision string `json:"decision" binding:"required"` // approve | reject
	Evidence struct {
		Channel       string `json:"channel"`
		Transcript    string `json:"transcript"`
		LiveKitEventID string `json:"livekit_event_id"`
	} `json:"evidence"`
}

// ListTools returns the tools available for the current workload session.
func (h *Handler) ListTools(c *gin.Context) {
	tools := make([]gin.H, 0, len(ai.Catalog))
	for name, spec := range ai.Catalog {
		if spec.IsUnsupported() {
			continue
		}
		tools = append(tools, gin.H{
			"name": name,
			"kind": spec.Kind,
		})
	}
	c.JSON(http.StatusOK, gin.H{"tools": tools})
}

// Prepare creates a tool action. Reads execute immediately; writes require confirmation.
func (h *Handler) Prepare(c *gin.Context) {
	tenantID := mustString(c, "tenant_id")
	sessionID := mustString(c, "session_id")
	roomName := mustString(c, "room_name")
	actingUser := mustString(c, "user_email")

	var req prepareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	spec, ok := ai.Catalog[req.Tool]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown tool"})
		return
	}
	if req.Arguments == nil {
		req.Arguments = map[string]any{}
	}

	if spec.Kind == ai.ToolRead {
		if !auth.HasScope(c, auth.ScopeERPRead) && !auth.HasScope(c, auth.ScopeKBRead) {
			c.JSON(http.StatusForbidden, gin.H{"error": "missing read scope"})
			return
		}
		result := h.executor.Execute(c.Request.Context(), req.Tool, req.Arguments, tenantID, actingUser)
		status := http.StatusOK
		if !result.OK {
			status = http.StatusBadGateway
		}
		c.JSON(status, gin.H{
			"status": "executed",
			"kind":   "read",
			"result": result,
		})
		return
	}

	if !auth.HasScope(c, auth.ScopeERPWrite) {
		c.JSON(http.StatusForbidden, gin.H{"error": "missing write prepare scope"})
		return
	}
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable for durable confirmations"})
		return
	}

	argsJSON, err := json.Marshal(req.Arguments)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid arguments"})
		return
	}
	digest := sha256Hex(argsJSON)
	idem := strings.TrimSpace(req.IdempotencyKey)
	if idem == "" {
		idem = uuid.NewString()
	}

	var existing store.ToolAction
	if err := store.DB.Where("idempotency_key = ?", idem).First(&existing).Error; err == nil {
		c.JSON(http.StatusOK, actionResponse(&existing))
		return
	}

	now := time.Now().UTC()
	action := store.ToolAction{
		ID:             "TA-" + strings.ToUpper(uuid.NewString()[:12]),
		TenantID:       tenantID,
		SessionID:      sessionID,
		RoomName:       roomName,
		Tool:           req.Tool,
		Kind:           string(ai.ToolWrite),
		ArgsJSON:       string(argsJSON),
		ArgsDigest:     digest,
		Summary:        summarizeWrite(req.Tool, req.Arguments),
		Status:         store.ToolActionPending,
		IdempotencyKey: idem,
		ActingUser:     actingUser,
		ExpiresAt:      now.Add(confirmationTTL),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := store.DB.Create(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = appendAudit(action.ID, tenantID, "prepared", actingUser, action.Summary)

	c.JSON(http.StatusAccepted, actionResponse(&action))
}

// Confirm approves or rejects a pending write action.
func (h *Handler) Confirm(c *gin.Context) {
	tenantID := mustString(c, "tenant_id")
	sessionID := mustString(c, "session_id")
	actingUser := mustString(c, "user_email")
	actionID := c.Param("id")

	var req confirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	decision := strings.ToLower(strings.TrimSpace(req.Decision))
	if decision != "approve" && decision != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision must be approve or reject"})
		return
	}
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var action store.ToolAction
	if err := store.DB.Where("id = ? AND tenant_id = ?", actionID, tenantID).First(&action).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "action not found"})
		return
	}
	if action.SessionID != "" && action.SessionID != sessionID {
		c.JSON(http.StatusForbidden, gin.H{"error": "action belongs to a different session"})
		return
	}
	if action.Status != store.ToolActionPending {
		c.JSON(http.StatusConflict, gin.H{"error": "action is not pending confirmation", "status": action.Status})
		return
	}
	if time.Now().UTC().After(action.ExpiresAt) {
		action.Status = store.ToolActionExpired
		action.UpdatedAt = time.Now().UTC()
		_ = store.DB.Save(&action).Error
		_ = appendAudit(action.ID, tenantID, "expired", actingUser, "confirmation window elapsed")
		c.JSON(http.StatusGone, gin.H{"error": "action expired", "status": action.Status})
		return
	}

	evidence, _ := json.Marshal(req.Evidence)
	action.ConfirmEvidence = string(evidence)
	now := time.Now().UTC()
	action.UpdatedAt = now

	if decision == "reject" {
		action.Status = store.ToolActionRejected
		confirmed := now
		action.ConfirmedAt = &confirmed
		_ = store.DB.Save(&action).Error
		_ = appendAudit(action.ID, tenantID, "rejected", actingUser, string(evidence))
		c.JSON(http.StatusOK, actionResponse(&action))
		return
	}

	var args map[string]any
	if err := json.Unmarshal([]byte(action.ArgsJSON), &args); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "stored arguments corrupt"})
		return
	}
	if sha256Hex([]byte(action.ArgsJSON)) != action.ArgsDigest {
		c.JSON(http.StatusConflict, gin.H{"error": "argument digest mismatch"})
		return
	}

	action.Status = store.ToolActionApproved
	confirmed := now
	action.ConfirmedAt = &confirmed
	_ = store.DB.Save(&action).Error
	_ = appendAudit(action.ID, tenantID, "approved", actingUser, string(evidence))

	result := h.executor.Execute(context.Background(), action.Tool, args, tenantID, action.ActingUser)
	executed := time.Now().UTC()
	action.ExecutedAt = &executed
	action.UpdatedAt = executed
	if result.OK {
		action.Status = store.ToolActionExecuted
		if result.Data != nil {
			action.ResultJSON = string(result.Data)
		}
		_ = appendAudit(action.ID, tenantID, "executed", actingUser, "ok")
	} else {
		action.Status = store.ToolActionFailed
		action.Error = result.Error
		_ = appendAudit(action.ID, tenantID, "failed", actingUser, result.Error)
	}
	_ = store.DB.Save(&action).Error

	status := http.StatusOK
	if !result.OK {
		status = http.StatusBadGateway
	}
	resp := actionResponse(&action)
	resp["result"] = result
	c.JSON(status, resp)
}

// Get returns a tool action by ID (tenant-scoped).
func (h *Handler) Get(c *gin.Context) {
	tenantID := mustString(c, "tenant_id")
	actionID := c.Param("id")
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	var action store.ToolAction
	if err := store.DB.Where("id = ? AND tenant_id = ?", actionID, tenantID).First(&action).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "action not found"})
		return
	}
	if time.Now().UTC().After(action.ExpiresAt) && action.Status == store.ToolActionPending {
		action.Status = store.ToolActionExpired
		action.UpdatedAt = time.Now().UTC()
		_ = store.DB.Save(&action).Error
	}
	c.JSON(http.StatusOK, actionResponse(&action))
}

func actionResponse(a *store.ToolAction) gin.H {
	return gin.H{
		"action_id":    a.ID,
		"tool":         a.Tool,
		"kind":         a.Kind,
		"status":       a.Status,
		"summary":      a.Summary,
		"args_digest":  a.ArgsDigest,
		"expires_at":   a.ExpiresAt,
		"session_id":   a.SessionID,
		"tenant_id":    a.TenantID,
		"error":        a.Error,
		"result_json":  a.ResultJSON,
		"confirmed_at": a.ConfirmedAt,
		"executed_at":  a.ExecutedAt,
	}
}

func summarizeWrite(tool string, args map[string]any) string {
	switch tool {
	case "create_order":
		return fmt.Sprintf("Create sales order for customer %v with items %v", args["customer"], args["items"])
	case "record_payment":
		return fmt.Sprintf("Record payment of %v on invoice %v", args["amount"], args["invoice_name"])
	case "create_customer":
		return fmt.Sprintf("Create customer %v", args["customer_name"])
	case "create_item":
		return fmt.Sprintf("Create item %v at rate %v", args["item_name"], args["rate"])
	case "add_stock":
		return fmt.Sprintf("Add stock for item %v qty %v", args["item_code"], args["qty"])
	case "trigger_workflow":
		return fmt.Sprintf("Trigger workflow with args %v", args)
	case "send_notification":
		return fmt.Sprintf("Send notification with args %v", args)
	default:
		return fmt.Sprintf("Execute write tool %s", tool)
	}
}

func appendAudit(actionID, tenantID, eventType, actor, detail string) error {
	if store.DB == nil {
		return errors.New("no db")
	}
	return store.DB.Create(&store.ToolAuditEvent{
		ActionID:  actionID,
		TenantID:  tenantID,
		EventType: eventType,
		Detail:    truncate(detail, 2000),
		Actor:     actor,
		CreatedAt: time.Now().UTC(),
	}).Error
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func mustString(c *gin.Context, key string) string {
	v, _ := c.Get(key)
	s, _ := v.(string)
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
