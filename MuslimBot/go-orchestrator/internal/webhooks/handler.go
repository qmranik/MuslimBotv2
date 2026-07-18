// Package webhooks is the single ingress for external service callbacks
// (Chatwoot, Twilio, Stripe, …). It verifies the source, resolves the tenant,
// records the event in the outbox, and routes the payload to that tenant's n8n
// so one tenant's traffic never touches another's workflows
// (UNIFIED_SYSTEM_PLAN U1). This endpoint is PUBLIC (external services cannot
// pass Authentik), so it is gated on a shared secret / signature instead.
package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
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
	pool *Pool
}

func NewHandler(cfg *config.Config) *Handler {
	h := &Handler{cfg: cfg, http: &http.Client{Timeout: 10 * time.Second}}
	h.pool = NewPool(cfg.WebhookQueueSize, cfg.WebhookWorkers, h.forward)
	return h
}

// Shutdown drains in-flight webhook forwards (graceful shutdown, N4).
func (h *Handler) Shutdown(ctx context.Context) error {
	if h.pool == nil {
		return nil
	}
	return h.pool.Shutdown(ctx)
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

	if !h.verify(c, body) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature/secret"})
		return
	}

	var parsed map[string]any
	_ = json.Unmarshal(body, &parsed) // best-effort; some sources send form-encoded

	tenant := ResolveTenant(source, parsed, c.Query("tenant"), c.GetHeader("X-Tenant-Id"), c.Request.Host)

	// Route to the tenant's n8n asynchronously via the bounded worker pool —
	// webhooks must be ack'd fast (N4). A full buffer means we are overloaded:
	// reply 503 so the caller retries with its own backoff instead of us
	// spawning unbounded goroutines or exhausting memory.
	target := h.n8nTarget(tenant, source)
	if !h.pool.Submit(job{target: target, tenant: tenant, source: source, body: body}) {
		log.Printf("[webhooks] queue full — shedding %s tenant=%s (503)", source, tenant)
		c.Header("Retry-After", "5")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "queue_full", "tenant": tenant})
		return
	}

	// Record for audit / idempotency / later replay only once accepted.
	if store.DB != nil {
		_ = store.DB.Create(&store.EventOutbox{
			Type:     "webhook." + source,
			TenantID: tenant,
			Source:   source,
			Payload:  string(body),
			Status:   "received",
		}).Error
	}

	c.JSON(http.StatusAccepted, gin.H{"status": "accepted", "tenant": tenant, "routed_to": target})
}

// verify authenticates the caller. When WEBHOOK_SECRET is empty (dev only —
// MustValidate requires it in production) verification is skipped. Otherwise it
// accepts either:
//   - an HMAC-SHA256 signature over the raw body in X-Webhook-Signature or
//     X-Hub-Signature-256 (optionally "sha256=" prefixed), the preferred path; or
//   - a shared-secret match in X-Webhook-Secret / ?secret= (fallback for
//     sources that cannot sign).
func (h *Handler) verify(c *gin.Context, body []byte) bool {
	secret := h.cfg.WebhookSecret
	if secret == "" {
		return true
	}

	if sig := firstNonEmpty(c.GetHeader("X-Webhook-Signature"), c.GetHeader("X-Hub-Signature-256")); sig != "" {
		return verifyHMAC(secret, body, sig)
	}

	provided := c.GetHeader("X-Webhook-Secret")
	if provided == "" {
		provided = c.Query("secret")
	}
	return provided != "" && subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) == 1
}

// verifyHMAC constant-time compares an HMAC-SHA256 hex signature over body.
func verifyHMAC(secret string, body []byte, sig string) bool {
	sig = strings.TrimPrefix(strings.TrimSpace(sig), "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(sig), []byte(expected)) == 1
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
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
