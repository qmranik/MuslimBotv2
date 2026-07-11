// Package webhooks is the single ingress for external service callbacks
// (Chatwoot, Twilio, Stripe, …). It verifies the source, resolves the tenant,
// records the event in the outbox, and routes the payload to that tenant's n8n
// so one tenant's traffic never touches another's workflows
// (UNIFIED_SYSTEM_PLAN U1). This endpoint is PUBLIC (external services cannot
// pass Authentik), so it is gated on a shared secret / signature instead.
package webhooks

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

type Handler struct {
	cfg  *config.Config
	http *http.Client
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg, http: &http.Client{Timeout: 10 * time.Second}}
}

// Ingest handles POST /v1/webhooks/:source.
func (h *Handler) Ingest(c *gin.Context) {
	source := strings.ToLower(c.Param("source"))
	if source == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source required"})
		return
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unreadable body"})
		return
	}

	if !h.verify(c) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature/secret"})
		return
	}

	var parsed map[string]any
	_ = json.Unmarshal(body, &parsed) // best-effort; some sources send form-encoded

	tenant := ResolveTenant(source, parsed, c.Query("tenant"), c.GetHeader("X-Tenant-Id"), c.Request.Host)

	// Record for audit / idempotency / later replay.
	if store.DB != nil {
		_ = store.DB.Create(&store.EventOutbox{
			Type:     "webhook." + source,
			TenantID: tenant,
			Source:   source,
			Payload:  string(body),
			Status:   "received",
		}).Error
	}

	// Route to the tenant's n8n asynchronously — webhooks must be ack'd fast.
	target := h.n8nTarget(tenant, source)
	go h.forward(target, tenant, source, body)

	c.JSON(http.StatusAccepted, gin.H{"status": "accepted", "tenant": tenant, "routed_to": target})
}

// verify checks the shared secret when one is configured. If WEBHOOK_SECRET is
// empty (dev), verification is skipped. Real deployments MUST set it and,
// per-source, upgrade to HMAC signature validation.
func (h *Handler) verify(c *gin.Context) bool {
	if h.cfg.WebhookSecret == "" {
		return true
	}
	provided := c.GetHeader("X-Webhook-Secret")
	if provided == "" {
		provided = c.Query("secret")
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(h.cfg.WebhookSecret)) == 1
}

func (h *Handler) n8nTarget(tenant, source string) string {
	base := h.cfg.N8NBaseURL
	if h.cfg.N8NURLTemplate != "" {
		base = strings.ReplaceAll(h.cfg.N8NURLTemplate, "{tenant}", tenant)
	}
	return strings.TrimRight(base, "/") + "/webhook/" + source
}

func (h *Handler) forward(target, tenant, source string, body []byte) {
	req, err := http.NewRequest(http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		log.Printf("[webhooks] build %s → %s failed: %v", source, target, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-Id", tenant)
	req.Header.Set("X-Webhook-Source", source)
	res, err := h.http.Do(req)
	if err != nil {
		log.Printf("[webhooks] forward %s tenant=%s → %s failed: %v", source, tenant, target, err)
		return
	}
	res.Body.Close()
	log.Printf("[webhooks] %s tenant=%s → %s status=%d", source, tenant, target, res.StatusCode)
}

// ResolveTenant derives the tenant id from (in priority order) an explicit
// query param, the X-Tenant-Id header, a source-specific field in the payload,
// then the request host subdomain, falling back to "default". Pure + testable.
func ResolveTenant(source string, body map[string]any, query, header, host string) string {
	if query != "" {
		return query
	}
	if header != "" {
		return header
	}
	switch source {
	case "chatwoot":
		// Chatwoot puts the tenant boundary in account.id / account_id.
		if acct, ok := body["account"].(map[string]any); ok {
			if id := stringify(acct["id"]); id != "" {
				return "chatwoot-" + id
			}
		}
		if id := stringify(body["account_id"]); id != "" {
			return "chatwoot-" + id
		}
	case "stripe":
		if id := stringify(body["account"]); id != "" {
			return id
		}
	case "twilio":
		if id := stringify(body["AccountSid"]); id != "" {
			return id
		}
	}
	if sub := subdomain(host); sub != "" {
		return sub
	}
	return "default"
}

func subdomain(host string) string {
	host = strings.Split(host, ":")[0] // strip port
	parts := strings.Split(host, ".")
	if len(parts) >= 3 && parts[0] != "www" {
		return parts[0]
	}
	return ""
}

func stringify(v any) string {
	switch n := v.(type) {
	case nil:
		return ""
	case string:
		return n
	case float64:
		if n == float64(int64(n)) {
			return strings.TrimSuffix(strings.TrimRight(formatFloat(n), "0"), ".")
		}
		return formatFloat(n)
	default:
		return ""
	}
}

func formatFloat(f float64) string {
	b, _ := json.Marshal(f)
	return string(b)
}
