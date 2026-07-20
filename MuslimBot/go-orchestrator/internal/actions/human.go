package actions

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"muslimbot-orchestrator/internal/ai"
	"muslimbot-orchestrator/internal/store"
)

// Human-plane ToolAction API. This is the browser counterpart of the workload
// (voice) prepare/confirm flow in handler.go. Identity comes from the Authentik
// forward-auth context (user_email / tenant_id) rather than a workload JWT, so
// these routes live under AuthentikMiddleware. It closes GAP-1: before this,
// every write returned 428 pointing at /v1/agent/* which browsers can never reach.
//
// Both planes write the SAME store.ToolAction table and audit trail (GAP-9);
// ActorKind keeps them from confirming each other's actions.

type humanConfirmRequest struct {
	Decision string `json:"decision"` // "approve" (default) | "reject"
}

// PrepareHuman: POST /v1/tool-actions {tool, arguments, idempotency_key?}
// Reads execute immediately; writes create a durable, single-use, expiring
// ToolAction the UI must confirm. Returns the server-normalized parameters so
// the confirmation card shows exactly what will run.
func (h *Handler) PrepareHuman(c *gin.Context) {
	tenantID := mustString(c, "tenant_id")
	actingUser := mustString(c, "user_email")
	if tenantID == "" || actingUser == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "no identity context"})
		return
	}

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
	if spec.IsUnsupported() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tool not available on this surface", "tool": req.Tool})
		return
	}
	if req.Arguments == nil {
		req.Arguments = map[string]any{}
	}

	// Reads are safe and instant.
	if spec.Kind == ai.ToolRead {
		result := h.executor.Execute(c.Request.Context(), req.Tool, req.Arguments, tenantID, actingUser)
		status := http.StatusOK
		if !result.OK {
			status = http.StatusBadGateway
		}
		c.JSON(status, gin.H{"status": "executed", "kind": "read", "result": result})
		return
	}

	// Writes require durable confirmation.
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable for durable confirmations"})
		return
	}

	argsJSON, err := json.Marshal(req.Arguments)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid arguments"})
		return
	}
	idem := strings.TrimSpace(req.IdempotencyKey)
	if idem == "" {
		idem = uuid.NewString()
	}
	// Idempotency: same key returns the existing action instead of duplicating.
	var existing store.ToolAction
	if err := store.DB.Where("idempotency_key = ?", idem).First(&existing).Error; err == nil {
		c.JSON(http.StatusOK, humanActionResponse(&existing))
		return
	}

	now := time.Now().UTC()
	action := store.ToolAction{
		ID:             "TA-" + strings.ToUpper(uuid.NewString()[:12]),
		TenantID:       tenantID,
		Tool:           req.Tool,
		Kind:           string(ai.ToolWrite),
		ArgsJSON:       string(argsJSON),
		ArgsDigest:     sha256Hex(argsJSON),
		Summary:        summarizeWrite(req.Tool, req.Arguments),
		Status:         store.ToolActionPending,
		IdempotencyKey: idem,
		ActingUser:     actingUser,
		ActorKind:      "human",
		ExpiresAt:      now.Add(confirmationTTL),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := store.DB.Create(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = appendAudit(action.ID, tenantID, "prepared", actingUser, action.Summary)
	c.JSON(http.StatusAccepted, humanActionResponse(&action))
}

// ConfirmHuman: POST /v1/tool-actions/:id/confirm {decision?}
// Default decision is "approve". Single-use, tenant-scoped, actor-scoped, and
// expiry-checked; on approve it executes via the same executor as reads and
// records the result on the action row.
func (h *Handler) ConfirmHuman(c *gin.Context) {
	tenantID := mustString(c, "tenant_id")
	actingUser := mustString(c, "user_email")
	actionID := c.Param("id")

	var req humanConfirmRequest
	_ = c.ShouldBindJSON(&req) // body optional; empty ⇒ approve
	decision := strings.ToLower(strings.TrimSpace(req.Decision))
	if decision == "" {
		decision = "approve"
	}
	if decision != "approve" && decision != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision must be approve or reject"})
		return
	}
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var action store.ToolAction
	if err := store.DB.Where("id = ? AND tenant_id = ? AND actor_kind = ?", actionID, tenantID, "human").
		First(&action).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "action not found"})
		return
	}
	if action.Status != store.ToolActionPending {
		c.JSON(http.StatusConflict, gin.H{"error": "action is not pending confirmation", "status": action.Status})
		return
	}
	now := time.Now().UTC()
	if now.After(action.ExpiresAt) {
		action.Status = store.ToolActionExpired
		action.UpdatedAt = now
		_ = store.DB.Save(&action).Error
		_ = appendAudit(action.ID, tenantID, "expired", actingUser, "confirmation window elapsed")
		c.JSON(http.StatusGone, gin.H{"error": "action expired", "status": action.Status})
		return
	}

	confirmed := now
	action.ConfirmedAt = &confirmed
	action.UpdatedAt = now

	if decision == "reject" {
		action.Status = store.ToolActionRejected
		_ = store.DB.Save(&action).Error
		_ = appendAudit(action.ID, tenantID, "rejected", actingUser, "user cancelled")
		c.JSON(http.StatusOK, humanActionResponse(&action))
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
	_ = store.DB.Save(&action).Error
	_ = appendAudit(action.ID, tenantID, "approved", actingUser, "confirmed in GenUI")

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
	resp := humanActionResponse(&action)
	resp["result"] = result
	c.JSON(status, resp)
}

// GetHuman: GET /v1/tool-actions/:id — tenant + actor scoped.
func (h *Handler) GetHuman(c *gin.Context) {
	tenantID := mustString(c, "tenant_id")
	actionID := c.Param("id")
	if store.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	var action store.ToolAction
	if err := store.DB.Where("id = ? AND tenant_id = ? AND actor_kind = ?", actionID, tenantID, "human").
		First(&action).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "action not found"})
		return
	}
	if action.Status == store.ToolActionPending && time.Now().UTC().After(action.ExpiresAt) {
		action.Status = store.ToolActionExpired
		action.UpdatedAt = time.Now().UTC()
		_ = store.DB.Save(&action).Error
	}
	c.JSON(http.StatusOK, humanActionResponse(&action))
}

func humanActionResponse(a *store.ToolAction) gin.H {
	var raw map[string]any
	_ = json.Unmarshal([]byte(a.ArgsJSON), &raw)
	return gin.H{
		"action_id":         a.ID,
		"tool":              a.Tool,
		"kind":              a.Kind,
		"status":            a.Status,
		"summary":           a.Summary,
		"normalized_params": ai.NormalizeArgs(a.Tool, raw),
		"expires_at":        a.ExpiresAt,
		"tenant_id":         a.TenantID,
		"error":             a.Error,
		"result_json":       a.ResultJSON,
		"confirmed_at":      a.ConfirmedAt,
		"executed_at":       a.ExecutedAt,
	}
}
