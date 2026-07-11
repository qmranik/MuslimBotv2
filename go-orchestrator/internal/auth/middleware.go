package auth

import (
	"crypto/subtle"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

// AuthentikMiddleware intercepts trusted identity headers injected by
// Traefik's ForwardAuth integration with Authentik. By the time a request
// reaches this middleware, Authentik has already validated the session via
// the wildcard .smb.localhost cookie and instructed Traefik to inject
// X-authentik-* headers.
//
// Header contract (set by Authentik outpost → Traefik):
//   - X-authentik-email    (required)  — verified user email
//   - X-authentik-username (optional)  — display username
//   - X-authentik-groups   (optional)  — comma-separated group slugs
//   - X-authentik-name     (optional)  — full display name
//
// Context keys set for downstream handlers:
//   - user_email   string
//   - user_name    string
//   - user_groups  []string
//   - tenant_id    string
func AuthentikMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Service identity: the KB BFF / voice worker present a shared key.
		// Compared in constant time and only honored when a non-empty key is
		// configured (MUSLIMBOT_PRODUCTION_PLAN W1.4). Replace with mTLS /
		// Authentik service account before multi-tenant GA.
		apiKey := c.GetHeader("X-KB-API-Key")
		if cfg.KBBffAPIKey != "" && apiKey != "" &&
			subtle.ConstantTimeCompare([]byte(apiKey), []byte(cfg.KBBffAPIKey)) == 1 {
			tenantID := c.GetHeader("X-Tenant-Id")
			if tenantID == "" {
				tenantID = "default"
			}
			c.Set("tenant_id", tenantID)
			c.Set("user_email", "system-voice@small.localhost")
			c.Set("user_name", "system-voice")
			c.Set("user_full_name", "System Voice Agent")
			c.Set("user_groups", []string{"admins"})
			c.Next()
			return
		}

		email := c.GetHeader("X-authentik-email")
		if email == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Missing identity headers",
				"details": "Request did not pass through Authentik/Traefik forward-auth",
			})
			c.Abort()
			return
		}

		username := c.GetHeader("X-authentik-username")
		groupsRaw := c.GetHeader("X-authentik-groups")
		fullName := c.GetHeader("X-authentik-name")

		// Parse comma-separated groups into a slice
		var groups []string
		if groupsRaw != "" {
			for _, g := range strings.Split(groupsRaw, ",") {
				trimmed := strings.TrimSpace(g)
				if trimmed != "" {
					groups = append(groups, trimmed)
				}
			}
		}

		// Resolve tenant mapping from platform DB
		tenantID := resolveTenantID(email)

		// Set identity context for all downstream handlers
		c.Set("user_email", email)
		c.Set("user_name", username)
		c.Set("user_full_name", fullName)
		c.Set("user_groups", groups)
		c.Set("tenant_id", tenantID)

		c.Next()
	}
}

// resolveTenantID looks up the tenant for a given email address.
// Falls back to "default" if the DB is unavailable or no mapping exists.
func resolveTenantID(email string) string {
	if store.DB == nil {
		return "default"
	}

	var mapping store.TenantUserMapping
	if err := store.DB.Where("email = ?", email).First(&mapping).Error; err != nil {
		log.Printf("[auth] No tenant mapping found for %s, using default: %v", email, err)
		return "default"
	}

	return mapping.TenantID
}

// MeHandler returns the authenticated user's identity and tenant context.
// This replaces the old JWT-claims-based /auth/me endpoint.
func MeHandler(c *gin.Context) {
	email, _ := c.Get("user_email")
	name, _ := c.Get("user_name")
	fullName, _ := c.Get("user_full_name")
	groups, _ := c.Get("user_groups")
	tenantID, _ := c.Get("tenant_id")

	c.JSON(http.StatusOK, gin.H{
		"email":     email,
		"username":  name,
		"full_name": fullName,
		"groups":    groups,
		"tenant_id": tenantID,
		"auth":      "authentik",
	})
}
