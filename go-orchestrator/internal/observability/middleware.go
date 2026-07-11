// Package observability provides request-scoped logging and tracing hooks for
// the orchestrator (MUSLIMBOT_PRODUCTION_PLAN W5.1). Kept dependency-light; an
// OTel exporter can be layered on the same middleware later.
package observability

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

const RequestIDHeader = "X-Request-Id"

// RequestLogger assigns/propagates a request id and emits a structured line per
// request including latency, status, tenant and acting user. One id flows from
// client → orchestrator → backends so traces can be correlated.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		reqID := c.GetHeader(RequestIDHeader)
		if reqID == "" {
			reqID = newID()
		}
		c.Set("request_id", reqID)
		c.Writer.Header().Set(RequestIDHeader, reqID)

		c.Next()

		tenant, _ := c.Get("tenant_id")
		user, _ := c.Get("user_email")
		log.Printf(
			"[req] id=%s method=%s path=%s status=%d latency=%s tenant=%v user=%v bytes=%d",
			reqID,
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			time.Since(start).Round(time.Millisecond),
			tenant,
			user,
			c.Writer.Size(),
		)
	}
}

func newID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "req-unknown"
	}
	return hex.EncodeToString(b)
}
