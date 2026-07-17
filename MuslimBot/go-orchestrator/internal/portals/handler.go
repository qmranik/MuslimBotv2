package portals

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
)

type Handler struct {
	config *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{config: cfg}
}

func (h *Handler) GetPortalURL(c *gin.Context) {
	app := c.Param("app")
	userEmail, _ := c.Get("user_email")
	email, _ := userEmail.(string)

	var portalURL string
	var authMechanism string

	switch app {
	case "erp-ops":
		portalURL = strings.TrimRight(h.config.FrappePublicURL, "/") + "/ops"
		authMechanism = "proxy"

	case "nextcloud":
		portalURL = h.config.NextcloudURL
		authMechanism = "oidc"

	case "n8n":
		portalURL = h.config.N8NPublicURL
		authMechanism = "forward_auth"

	case "chatwoot":
		ssoURL, err := fetchChatwootSSOURL(h.config, email)
		if err != nil {
			log.Printf("[portals/chatwoot] SSO token fetch failed for %s: %v", email, err)
			c.JSON(http.StatusBadGateway, gin.H{
				"error":   "Failed to generate Chatwoot SSO link",
				"details": err.Error(),
			})
			return
		}
		portalURL = ssoURL
		authMechanism = "magic_link"

	case "postiz":
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

type chatwootSSOResponse struct {
	URL           string `json:"url"`
	SSOAuthToken  string `json:"sso_auth_token"`
	AccessToken   string `json:"access_token"`
}

func fetchChatwootSSOURL(cfg *config.Config, email string) (string, error) {
	token := cfg.ChatwootPlatformToken
	if token == "" {
		token = cfg.ChatwootAPIToken
	}
	if token == "" {
		return "", fmt.Errorf("CHATWOOT_PLATFORM_TOKEN not configured")
	}
	if email == "" {
		return "", fmt.Errorf("user email required for Chatwoot SSO")
	}

	publicBase := strings.TrimRight(firstNonEmpty(cfg.ChatwootPublicURL, cfg.ChatwootURL), "/")
	internalBase := strings.TrimRight(cfg.ChatwootURL, "/")

	userID, err := lookupChatwootUserID(internalBase, token, email)
	if err != nil {
		return "", err
	}

	reqURL := fmt.Sprintf("%s/platform/api/v1/users/%d/login", internalBase, userID)
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to build Chatwoot SSO request: %w", err)
	}
	req.Header.Set("api_access_token", token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("chatwoot SSO request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("chatwoot returned %d: %s", resp.StatusCode, string(body))
	}

	var ssoResp chatwootSSOResponse
	if err := json.Unmarshal(body, &ssoResp); err != nil {
		return "", fmt.Errorf("failed to decode Chatwoot SSO response: %w", err)
	}

	if ssoResp.URL != "" {
		if strings.HasPrefix(ssoResp.URL, "http") {
			return ssoResp.URL, nil
		}
		return publicBase + ssoResp.URL, nil
	}
	if ssoResp.SSOAuthToken != "" {
		return publicBase + "/auth/sso?sso_auth_token=" + url.QueryEscape(ssoResp.SSOAuthToken), nil
	}
	if ssoResp.AccessToken != "" {
		return publicBase + "/auth/sso?sso_auth_token=" + url.QueryEscape(ssoResp.AccessToken), nil
	}
	return "", fmt.Errorf("chatwoot SSO response missing url/token")
}

func lookupChatwootUserID(base, token, email string) (int, error) {
	reqURL := base + "/platform/api/v1/users"
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("api_access_token", token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("chatwoot users list returned %d: %s", resp.StatusCode, string(body))
	}

	var users []struct {
		ID    int    `json:"id"`
		Email string `json:"email"`
	}
	if err := json.Unmarshal(body, &users); err != nil {
		var wrapped struct {
			Payload []struct {
				ID    int    `json:"id"`
				Email string `json:"email"`
			} `json:"payload"`
		}
		if err2 := json.Unmarshal(body, &wrapped); err2 != nil {
			return 0, fmt.Errorf("failed to decode chatwoot users: %w", err)
		}
		for _, u := range wrapped.Payload {
			if strings.EqualFold(u.Email, email) {
				return u.ID, nil
			}
		}
		return 0, fmt.Errorf("chatwoot user not found for %s", email)
	}
	for _, u := range users {
		if strings.EqualFold(u.Email, email) {
			return u.ID, nil
		}
	}
	return 0, fmt.Errorf("chatwoot user not found for %s", email)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
