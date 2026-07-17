package auth

import (
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

var localBypassWarned sync.Once

func AuthentikMiddleware(cfg *config.Config) gin.HandlerFunc {
	localBypass := strings.EqualFold(cfg.Env, "local")
	if localBypass {
		localBypassWarned.Do(func() {
			log.Printf("[auth] ENV=local: Authentik bypass enabled (injects Administrator when headers are absent)")
		})
	}

	return func(c *gin.Context) {
		hostTenant := TenantFromHost(c.Request.Host, cfg.PlatformBaseDomain)

		apiKey := c.GetHeader("X-KB-API-Key")
		if cfg.KBBffAPIKey != "" && apiKey != "" &&
			subtle.ConstantTimeCompare([]byte(apiKey), []byte(cfg.KBBffAPIKey)) == 1 {
			tenantID := firstNonEmpty(hostTenant, c.GetHeader("X-Tenant-Id"), "default")
			c.Set("tenant_id", tenantID)
			c.Set("user_email", "system-voice@small.localhost")
			c.Set("user_name", "system-voice")
			c.Set("user_full_name", "System Voice Agent")
			c.Set("user_groups", []string{"admins"})
			c.Set("auth_mode", "service-key")
			c.Next()
			return
		}

		email := c.GetHeader("X-authentik-email")
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

		tenantID := firstNonEmpty(hostTenant, c.GetHeader("X-Tenant-Id"))
		if tenantID == "" {
			tenantID = resolveTenantID(email)
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
