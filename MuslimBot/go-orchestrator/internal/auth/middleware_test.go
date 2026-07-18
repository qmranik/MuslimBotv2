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
	// G4: bypass now requires explicit opt-in in addition to ENV=local.
	cfg := &config.Config{Env: "local", AuthLocalBypass: true, PlatformBaseDomain: "smb.localhost"}

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

// G4: ENV=local alone no longer enables the bypass; it must be opted in.
func TestAuthentikMiddleware_BypassRequiresOptIn(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "local", AuthLocalBypass: false, PlatformBaseDomain: "smb.localhost"}

	r := gin.New()
	r.Use(AuthentikMiddleware(cfg))
	r.GET("/v1/auth/me", MeHandler)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 (bypass not opted in); body=%s", w.Code, w.Body.String())
	}
}

// G2: identity headers from a peer outside TRUSTED_PROXY_CIDRS are rejected.
func TestAuthentikMiddleware_RejectsForgedHeadersFromUntrustedPeer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "local", TrustedProxyCIDRs: "10.0.0.0/8", PlatformBaseDomain: "smb.localhost"}

	r := gin.New()
	r.Use(AuthentikMiddleware(cfg))
	r.GET("/v1/auth/me", MeHandler)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req.RemoteAddr = "192.0.2.1:1234" // not within 10.0.0.0/8
	req.Header.Set("X-authentik-email", "attacker@evil.example")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 (untrusted proxy); body=%s", w.Code, w.Body.String())
	}
}

// G2: headers from a trusted peer are honoured.
func TestAuthentikMiddleware_HonoursHeadersFromTrustedPeer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "local", TrustedProxyCIDRs: "192.0.2.0/24", PlatformBaseDomain: "smb.localhost"}

	r := gin.New()
	r.Use(AuthentikMiddleware(cfg))
	r.GET("/v1/auth/me", MeHandler)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req.RemoteAddr = "192.0.2.7:1234" // within 192.0.2.0/24
	req.Header.Set("X-authentik-email", "ops@smb.localhost")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (trusted peer); body=%s", w.Code, w.Body.String())
	}
}

// G10: resolveTenant precedence — email mapping preferred when DB exists;
// X-Tenant-Id is never trusted alone. With nil DB, host slug or default.
func TestResolveTenant(t *testing.T) {
	if tid, ok := resolveTenant("acme", "", "x@y.z"); !ok || tid != "acme" {
		t.Fatalf("host slug should win without DB: got %q ok=%v", tid, ok)
	}
	// X-Tenant-Id alone is ignored when no platform DB / host slug exists.
	if tid, ok := resolveTenant("", "beta", "x@y.z"); !ok || tid != "default" {
		t.Fatalf("header alone must not select tenant without DB: got %q ok=%v", tid, ok)
	}
	// store.DB is nil in unit tests → single-tenant default is allowed.
	if tid, ok := resolveTenant("", "", "x@y.z"); !ok || tid != "default" {
		t.Fatalf("nil DB should allow default: got %q ok=%v", tid, ok)
	}
}
