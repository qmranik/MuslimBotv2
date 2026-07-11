package portals

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
)

// Handler serves portal embed URLs for the React WorkspaceManager.
// Each portal uses a different auth handshake:
//   - Nextcloud/Postiz: OIDC — Authentik cookie handles SSO automatically
//   - n8n: ForwardAuth — Traefik + Authentik handle SSO at the edge
//   - Chatwoot: Magic Link — server-to-server API call to get SSO token
//   - erp-ops: Proxied — goes through the Go orchestrator's own gateway
type Handler struct {
	config *config.Config
}

// NewHandler creates a new portals handler.
func NewHandler(cfg *config.Config) *Handler {
	return &Handler{config: cfg}
}

// GetPortalURL returns the embed URL for a given portal app.
// The frontend calls GET /v1/portals/:app/url and uses the returned URL
// in a SecurePortal iframe component.
func (h *Handler) GetPortalURL(c *gin.Context) {
	app := c.Param("app")
	userEmail, _ := c.Get("user_email")
	email, _ := userEmail.(string)

	var portalURL string
	var authMechanism string

	switch app {
	case "erp-ops":
		portalURL = h.config.FrappeURL + "/ops"
		authMechanism = "proxy"

	case "nextcloud":
		// Nextcloud is configured with OIDC pointing to Authentik.
		// When the iframe loads, Authentik sees the wildcard .smb.localhost
		// cookie and logs the user in automatically — zero extra work.
		portalURL = h.config.NextcloudURL
		authMechanism = "oidc"

	case "n8n":
		// n8n sits behind Traefik with ForwardAuth middleware.
		// Traefik intercepts the iframe request, Authentik validates the
		// cookie, and Traefik injects headers into the n8n container.
		portalURL = "https://workflow.smb.localhost"
		authMechanism = "forward_auth"

	case "chatwoot":
		// Chatwoot requires explicit session tokens. We execute a
		// server-to-server API call to get a magic link SSO token.
		ssoToken, err := fetchChatwootSSOToken(h.config, email)
		if err != nil {
			log.Printf("[portals/chatwoot] SSO token fetch failed for %s: %v", email, err)
			c.JSON(http.StatusBadGateway, gin.H{
				"error":   "Failed to generate Chatwoot SSO link",
				"details": err.Error(),
			})
			return
		}
		portalURL = h.config.ChatwootURL + "/auth/sso?sso_auth_token=" + ssoToken
		authMechanism = "magic_link"

	case "postiz":
		// Postiz supports OIDC natively via Authentik — same as Nextcloud.
		portalURL = h.config.PostizURL
		authMechanism = "oidc"

	default:
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":            portalURL,
		"embed_mode":     "iframe",
		"auth_mechanism": authMechanism,
	})
}

// chatwootSSOResponse models the Chatwoot SSO token API response.
type chatwootSSOResponse struct {
	URL string `json:"url"`
}

// fetchChatwootSSOToken calls the Chatwoot server-to-server API to
// generate a magic-link SSO token for the given user email.
func fetchChatwootSSOToken(cfg *config.Config, email string) (string, error) {
	if cfg.ChatwootAPIToken == "" {
		return "", fmt.Errorf("CHATWOOT_API_TOKEN not configured")
	}

	payload := fmt.Sprintf(`{"sso_auth_token":"","email":"%s"}`, email)
	reqURL := cfg.ChatwootURL + "/auth/sign_in"

	req, err := http.NewRequest("POST", reqURL, strings.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("failed to build Chatwoot SSO request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api_access_token", cfg.ChatwootAPIToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("chatwoot SSO request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("chatwoot returned %d: %s", resp.StatusCode, string(body))
	}

	var ssoResp chatwootSSOResponse
	if err := json.NewDecoder(resp.Body).Decode(&ssoResp); err != nil {
		return "", fmt.Errorf("failed to decode Chatwoot SSO response: %w", err)
	}

	// Extract the token from the returned URL or return the raw token
	// Chatwoot may return a full URL or just a token depending on config
	if ssoResp.URL != "" {
		// Extract token from URL if present
		parts := strings.Split(ssoResp.URL, "sso_auth_token=")
		if len(parts) > 1 {
			return parts[1], nil
		}
		return ssoResp.URL, nil
	}

	return "", fmt.Errorf("empty SSO token in Chatwoot response")
}
