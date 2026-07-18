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
	config       *config.Config
}

// NewRouterProxy creates reverse proxy targets for Frappe.
func NewRouterProxy(cfg *config.Config) (*RouterProxy, error) {
	frappeURL := cfg.FrappeURL
	if frappeURL == "" {
		frappeURL = "http://frappe-web:8000"
	}
	frappeTarget, err := url.Parse(frappeURL)
	if err != nil {
		return nil, err
	}

	return &RouterProxy{
		frappeTarget: frappeTarget,
		config:       cfg,
	}, nil
}

// ErpProxyHandler reverse-proxies GET/HEAD requests to Frappe/ERPNext.
// Mutations must go through /v1/agent/tool-actions with durable confirmation.
func (rp *RouterProxy) ErpProxyHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := strings.ToUpper(c.Request.Method)
		if method != http.MethodGet && method != http.MethodHead {
			c.JSON(http.StatusMethodNotAllowed, gin.H{
				"error":   "ERP proxy is read-only",
				"details": "Use POST /v1/agent/tool-actions for confirmed writes",
			})
			return
		}

		path := c.Param("path")

		userEmail, _ := c.Get("user_email")
		tenantID, _ := c.Get("tenant_id")

		proxy := httputil.NewSingleHostReverseProxy(rp.frappeTarget)

		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = rp.frappeTarget.Scheme
			req.URL.Host = rp.frappeTarget.Host
			req.URL.Path = "/api/method/small_erp" + strings.ReplaceAll(path, "/", ".")
			req.Host = rp.config.FrappeSiteHost
			req.Header.Set("Host", rp.config.FrappeSiteHost)

			if rp.config.FrappeToken != "" {
				req.Header.Set("Authorization", "token "+rp.config.FrappeToken+":"+rp.config.FrappeSecret)
			}

			if email, ok := userEmail.(string); ok && email != "" {
				req.Header.Set("X-Frappe-User", email)
			}

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
