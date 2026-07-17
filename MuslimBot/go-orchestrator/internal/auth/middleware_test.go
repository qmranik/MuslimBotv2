package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
)

func TestAuthentikMiddleware_LocalBypass(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "local", PlatformBaseDomain: "smb.localhost"}

	r := gin.New()
	r.Use(AuthentikMiddleware(cfg))
	r.GET("/v1/auth/me", MeHandler)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["email"] != "Administrator@small.localhost" {
		t.Fatalf("email = %v", body["email"])
	}
	if body["username"] != "Administrator" {
		t.Fatalf("username = %v", body["username"])
	}
	if body["auth"] != "local-bypass" {
		t.Fatalf("auth = %v", body["auth"])
	}
	if body["tenant_id"] != "default" {
		t.Fatalf("tenant_id = %v", body["tenant_id"])
	}
}

func TestAuthentikMiddleware_RequiresHeadersWhenNotLocal(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "", PlatformBaseDomain: "smb.localhost"}

	r := gin.New()
	r.Use(AuthentikMiddleware(cfg))
	r.GET("/v1/auth/me", MeHandler)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}

func TestAuthentikMiddleware_HeadersWinOverLocalBypass(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "local", PlatformBaseDomain: "smb.localhost"}

	r := gin.New()
	r.Use(AuthentikMiddleware(cfg))
	r.GET("/v1/auth/me", MeHandler)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req.Header.Set("X-authentik-email", "ops@smb.localhost")
	req.Header.Set("X-authentik-username", "ops")
	req.Header.Set("X-authentik-groups", "admins")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["email"] != "ops@smb.localhost" {
		t.Fatalf("email = %v", body["email"])
	}
	if body["auth"] != "authentik" {
		t.Fatalf("auth = %v", body["auth"])
	}
}
