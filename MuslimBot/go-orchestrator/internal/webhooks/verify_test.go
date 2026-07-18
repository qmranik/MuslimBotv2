package webhooks

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func ctxWith(headers map[string]string, body []byte) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/webhooks/chatwoot", nil)
	for k, v := range headers {
		c.Request.Header.Set(k, v)
	}
	return c
}

func TestVerify_NoSecretAllows(t *testing.T) {
	h := &Handler{cfg: &config.Config{WebhookSecret: ""}}
	if !h.verify(ctxWith(nil, nil), []byte("x")) {
		t.Fatal("empty secret should skip verification (dev)")
	}
}

func TestVerify_HMACValidAndInvalid(t *testing.T) {
	body := []byte(`{"event":"message_created"}`)
	h := &Handler{cfg: &config.Config{WebhookSecret: "topsecret"}}

	good := ctxWith(map[string]string{"X-Webhook-Signature": "sha256=" + sign("topsecret", body)}, body)
	if !h.verify(good, body) {
		t.Fatal("valid HMAC should pass")
	}

	bad := ctxWith(map[string]string{"X-Webhook-Signature": sign("wrong", body)}, body)
	if h.verify(bad, body) {
		t.Fatal("HMAC signed with wrong secret must fail")
	}

	// X-Hub-Signature-256 alias.
	hub := ctxWith(map[string]string{"X-Hub-Signature-256": "sha256=" + sign("topsecret", body)}, body)
	if !h.verify(hub, body) {
		t.Fatal("X-Hub-Signature-256 alias should be accepted")
	}
}

func TestVerify_SharedSecretFallback(t *testing.T) {
	h := &Handler{cfg: &config.Config{WebhookSecret: "topsecret"}}
	ok := ctxWith(map[string]string{"X-Webhook-Secret": "topsecret"}, nil)
	if !h.verify(ok, nil) {
		t.Fatal("matching shared secret should pass")
	}
	no := ctxWith(map[string]string{"X-Webhook-Secret": "nope"}, nil)
	if h.verify(no, nil) {
		t.Fatal("wrong shared secret must fail")
	}
	missing := ctxWith(nil, nil)
	if h.verify(missing, nil) {
		t.Fatal("no signature and no secret header must fail when a secret is configured")
	}
}
