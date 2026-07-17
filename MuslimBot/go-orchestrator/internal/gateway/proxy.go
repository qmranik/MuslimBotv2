package gateway

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
)

// RouterProxy holds pre-initialized reverse proxies for backend services.
type RouterProxy struct {
	frappeTarget *url.URL
	kbBffTarget  *url.URL
	config       *config.Config
}

// NewRouterProxy creates reverse proxy targets for Frappe and KB BFF.
func NewRouterProxy(cfg *config.Config) (*RouterProxy, error) {
	frappeURL := cfg.FrappeURL
	if frappeURL == "" {
		frappeURL = "http://frappe-web:8000"
	}
	frappeTarget, err := url.Parse(frappeURL)
	if err != nil {
		return nil, err
	}

	kbURL := cfg.KBBffURL
	if kbURL == "" {
		kbURL = "http://muslimbot-kb-bff:8787"
	}
	kbTarget, err := url.Parse(kbURL)
	if err != nil {
		return nil, err
	}

	return &RouterProxy{
		frappeTarget: frappeTarget,
		kbBffTarget:  kbTarget,
		config:       cfg,
	}, nil
}

// ErpProxyHandler reverse-proxies requests to Frappe/ERPNext.
// It injects the master API token (masked from the browser) and forwards
// the Authentik-verified user email as X-Frappe-User so Frappe knows
// who is acting.
func (rp *RouterProxy) ErpProxyHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Param("path")

		// Read identity from Authentik middleware context
		userEmail, _ := c.Get("user_email")
		tenantID, _ := c.Get("tenant_id")

		proxy := httputil.NewSingleHostReverseProxy(rp.frappeTarget)

		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = rp.frappeTarget.Scheme
			req.URL.Host = rp.frappeTarget.Host
			req.URL.Path = "/api/method/small_erp" + strings.ReplaceAll(path, "/", ".")
			req.Host = rp.config.FrappeSiteHost
			req.Header.Set("Host", rp.config.FrappeSiteHost)

			// Inject master Frappe API token (hidden from client)
			if rp.config.FrappeToken != "" {
				req.Header.Set("Authorization", "token "+rp.config.FrappeToken+":"+rp.config.FrappeSecret)
			}

			// Forward Authentik-verified user identity to Frappe
			if email, ok := userEmail.(string); ok && email != "" {
				req.Header.Set("X-Frappe-User", email)
			}

			// Forward tenant context
			if tid, ok := tenantID.(string); ok && tid != "" {
				req.Header.Set("X-Tenant-Id", tid)
			}

			log.Printf("[gateway/erp] %s %s → %s (user=%v, tenant=%v)",
				c.Request.Method, c.Request.URL.Path, req.URL.Path, userEmail, tenantID)
		}

		proxy.ModifyResponse = func(res *http.Response) error {
			res.Header.Del("X-Frame-Options")
			res.Header.Set("Content-Security-Policy",
				"frame-ancestors 'self' https://*.smb.localhost http://localhost:5173")
			return nil
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

// KBBffProxyHandler reverse-proxies requests to the Muslimbot KB BFF.
// It injects the server-side API key and forwards tenant context from
// the Authentik middleware.
func (rp *RouterProxy) KBBffProxyHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Param("path")

		// Read tenant from Authentik middleware context
		tenantID, _ := c.Get("tenant_id")
		userEmail, _ := c.Get("user_email")

		proxy := httputil.NewSingleHostReverseProxy(rp.kbBffTarget)

		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = rp.kbBffTarget.Scheme
			req.URL.Host = rp.kbBffTarget.Host
			req.URL.Path = path

			// Inject server-side API key (masked from client)
			if rp.config.KBBffAPIKey != "" {
				req.Header.Set("X-KB-API-Key", rp.config.KBBffAPIKey)
			}

			// Forward tenant context from Authentik middleware
			if tid, ok := tenantID.(string); ok && tid != "" {
				req.Header.Set("X-Tenant-Id", tid)
			}
			if email, ok := userEmail.(string); ok && email != "" {
				req.Header.Set("X-User-Email", email)
			}

			log.Printf("[gateway/kb] %s %s → %s (tenant=%v)",
				c.Request.Method, c.Request.URL.Path, req.URL.Path, tenantID)
		}

		proxy.ModifyResponse = func(res *http.Response) error {
			res.Header.Del("X-Frame-Options")
			res.Header.Set("Content-Security-Policy",
				"frame-ancestors 'self' https://*.smb.localhost http://localhost:5173")
			return nil
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
