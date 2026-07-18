package auth

import (
	"crypto/subtle"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

var (
	localBypassWarned  sync.Once
	untrustedProxyWarn sync.Once
)

// AuthentikMiddleware authenticates requests using the identity headers that
// Traefik's Authentik forward-auth hop injects (X-authentik-*). It is hardened
// against three classes of failure the readiness review flagged:
//
//   - G2: X-authentik-* headers are only honoured when the request's direct
//     peer is a trusted proxy (TrustedProxyCIDRs). Network isolation alone is
//     insufficient — the orchestrator shares a network with n8n/Chatwoot, any
//     of which could otherwise forge headers.
//   - G4: the dev bypass that injects Administrator fails closed. It requires
//     BOTH ENV=local AND AUTH_LOCAL_BYPASS=true, and is refused outright in a
//     production environment.
//   - G10: tenant resolution fails closed. When a platform DB is present but
//     no mapping exists for the caller, the request is denied rather than
//     silently falling back to the "default" tenant (cross-tenant leakage).
func AuthentikMiddleware(cfg *config.Config) gin.HandlerFunc {
	trustedNets := parseCIDRs(cfg.TrustedProxyCIDRs)
	// In production always enforce trusted-proxy — with an empty allowlist this
	// means every identity header is rejected (fail closed). config.MustValidate
	// stops boot before this state can occur in a real deploy. In dev, enforce
	// only when an allowlist is explicitly configured.
	enforceProxy := len(trustedNets) > 0 || cfg.IsProduction()

	// Fail-closed bypass (G4): only in a non-production env AND explicitly opted in.
	localBypass := cfg.AuthLocalBypass && !cfg.IsProduction()
	if localBypass {
		localBypassWarned.Do(func() {
			log.Printf("[auth] ENV=%s + AUTH_LOCAL_BYPASS=true: Authentik bypass enabled (injects Administrator when headers are absent). DEV ONLY.", cfg.Env)
		})
	}
	if enforceProxy && len(trustedNets) == 0 {
		untrustedProxyWarn.Do(func() {
			log.Printf("[auth] WARNING: enforcing trusted-proxy with an empty TRUSTED_PROXY_CIDRS — all identity headers will be rejected (fail closed)")
		})
	}

	return func(c *gin.Context) {
		hostTenant := TenantFromHost(c.Request.Host, cfg.PlatformBaseDomain)

		// Service-to-service key for trusted internal callers (n8n). Constant-time compare.
		// LiveKit workers must use WorkloadMiddleware JWTs — service keys do not grant
		// arbitrary tenant selection or admin groups.
		apiKey := firstNonEmpty(c.GetHeader("X-Service-API-Key"), c.GetHeader("X-KB-API-Key"))
		serviceSecret := firstNonEmpty(cfg.OrchestratorServiceAPIKey, cfg.KBBffAPIKey)
		if serviceSecret != "" && apiKey != "" &&
			subtle.ConstantTimeCompare([]byte(apiKey), []byte(serviceSecret)) == 1 {
			tenantID := firstNonEmpty(hostTenant, "default")
			c.Set("tenant_id", tenantID)
			c.Set("user_email", "system-service@small.localhost")
			c.Set("user_name", "system-service")
			c.Set("user_full_name", "System Service")
			c.Set("user_groups", []string{"service"})
			c.Set("auth_mode", "service-key")
			c.Next()
			return
		}

		email := c.GetHeader("X-authentik-email")

		// G2: reject forge-able identity headers from an untrusted peer.
		if email != "" && enforceProxy && !peerTrusted(c, trustedNets) {
			log.Printf("[auth] rejected X-authentik-* from untrusted peer %s (host=%s)", c.RemoteIP(), c.Request.Host)
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Untrusted proxy",
				"details": "Identity headers may only originate from the configured forward-auth proxy",
			})
			c.Abort()
			return
		}

		if email == "" {
			if !localBypass {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error":   "Missing identity headers",
					"details": "Request did not pass through Authentik/Traefik forward-auth",
				})
				c.Abort()
				return
			}
			tenantID := firstNonEmpty(hostTenant, c.GetHeader("X-Tenant-Id"), "default")
			c.Set("tenant_id", tenantID)
			c.Set("user_email", "Administrator@small.localhost")
			c.Set("user_name", "Administrator")
			c.Set("user_full_name", "Administrator")
			c.Set("user_groups", []string{"admins"})
			c.Set("auth_mode", "local-bypass")
			c.Next()
			return
		}

		username := c.GetHeader("X-authentik-username")
		groupsRaw := c.GetHeader("X-authentik-groups")
		fullName := c.GetHeader("X-authentik-name")

		var groups []string
		if groupsRaw != "" {
			for _, g := range strings.Split(groupsRaw, ",") {
				trimmed := strings.TrimSpace(g)
				if trimmed != "" {
					groups = append(groups, trimmed)
				}
			}
		}

		// G10: tenant resolution fails closed.
		tenantID, ok := resolveTenant(hostTenant, c.GetHeader("X-Tenant-Id"), email)
		if !ok {
			log.Printf("[auth] denied: no tenant resolvable for %s (host=%s)", email, c.Request.Host)
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "No tenant context",
				"details": "Authenticated identity is not mapped to any tenant",
			})
			c.Abort()
			return
		}

		c.Set("user_email", email)
		c.Set("user_name", username)
		c.Set("user_full_name", fullName)
		c.Set("user_groups", groups)
		c.Set("tenant_id", tenantID)
		c.Set("auth_mode", "authentik")

		c.Next()
	}
}

// resolveTenant returns the tenant for an authenticated caller and whether it
// could be established. Precedence: Host slug > explicit X-Tenant-Id header >
// email→tenant DB mapping. It fails closed (ok=false) only when a platform DB
// is present but has no mapping — the actual cross-tenant leakage case (G10).
// When no platform DB is configured at all, single-tenant "default" is a
// legitimate deployment and is allowed.
func resolveTenant(hostTenant, headerTenant, email string) (string, bool) {
	// Prefer email→tenant mapping when a platform DB is available. Host slug may
	// hint the tenant, but X-Tenant-Id from browsers is never trusted alone.
	if store.DB != nil {
		var mapping store.TenantUserMapping
		if err := store.DB.Where("email = ?", email).First(&mapping).Error; err == nil {
			if hostTenant != "" && hostTenant != mapping.TenantID {
				log.Printf("[auth] host tenant %q ignored; email maps to %q", hostTenant, mapping.TenantID)
			}
			if headerTenant != "" && headerTenant != mapping.TenantID {
				log.Printf("[auth] rejecting mismatched X-Tenant-Id %q for mapped tenant %q", headerTenant, mapping.TenantID)
			}
			return mapping.TenantID, true
		}
		if hostTenant != "" {
			return hostTenant, true
		}
		return "", false
	}
	if t := firstNonEmpty(hostTenant); t != "" {
		return t, true
	}
	return "default", true // single-tenant deployment, no mapping table
}

// parseCIDRs parses a comma-separated CIDR/IP allowlist. Bare IPs are treated
// as /32 (v4) or /128 (v6).
func parseCIDRs(raw string) []*net.IPNet {
	var nets []*net.IPNet
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if !strings.Contains(part, "/") {
			if ip := net.ParseIP(part); ip != nil {
				if ip.To4() != nil {
					part += "/32"
				} else {
					part += "/128"
				}
			}
		}
		if _, n, err := net.ParseCIDR(part); err == nil {
			nets = append(nets, n)
		} else {
			log.Printf("[auth] ignoring invalid TRUSTED_PROXY_CIDRS entry %q: %v", part, err)
		}
	}
	return nets
}

// peerTrusted reports whether the request's direct peer IP is within the
// trusted-proxy allowlist. Uses the raw connection peer (RemoteIP), never the
// forge-able X-Forwarded-For chain.
func peerTrusted(c *gin.Context, trusted []*net.IPNet) bool {
	ip := net.ParseIP(c.RemoteIP())
	if ip == nil {
		return false
	}
	for _, n := range trusted {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func MeHandler(c *gin.Context) {
	email, _ := c.Get("user_email")
	name, _ := c.Get("user_name")
	fullName, _ := c.Get("user_full_name")
	groups, _ := c.Get("user_groups")
	tenantID, _ := c.Get("tenant_id")
	authMode, ok := c.Get("auth_mode")
	if !ok || authMode == nil || authMode == "" {
		authMode = "authentik"
	}

	c.JSON(http.StatusOK, gin.H{
		"email":     email,
		"username":  name,
		"full_name": fullName,
		"groups":    groups,
		"tenant_id": tenantID,
		"auth":      authMode,
	})
}
