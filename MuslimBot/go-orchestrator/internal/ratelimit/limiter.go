// Package ratelimit provides a lightweight, dependency-free token-bucket
// limiter and a Gin middleware. It exists to cap billable /v1/ai/* traffic
// per tenant (readiness gap P8) so a single tenant — or a runaway loop — cannot
// exhaust the Gemini budget for the whole platform.
package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// bucket is a single token bucket. Tokens refill continuously at `refill`
// tokens/second up to `capacity`.
type bucket struct {
	tokens   float64
	capacity float64
	refill   float64 // tokens per second
	last     time.Time
}

func (b *bucket) allow(now time.Time) bool {
	elapsed := now.Sub(b.last).Seconds()
	b.last = now
	b.tokens += elapsed * b.refill
	if b.tokens > b.capacity {
		b.tokens = b.capacity
	}
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// Limiter holds one bucket per key and evicts idle buckets so memory stays flat
// under a churning key space (e.g. per-IP fallback).
type Limiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	capacity float64
	refill   float64
	ttl      time.Duration
}

// New returns a Limiter allowing `perMinute` sustained requests with a burst of
// `burst`. If perMinute <= 0 the limiter is disabled (Allow always true).
func New(perMinute, burst int) *Limiter {
	if burst < 1 {
		burst = 1
	}
	l := &Limiter{
		buckets:  make(map[string]*bucket),
		capacity: float64(burst),
		refill:   float64(perMinute) / 60.0,
		ttl:      10 * time.Minute,
	}
	if perMinute > 0 {
		go l.sweep()
	}
	return l
}

// Enabled reports whether the limiter actually enforces anything.
func (l *Limiter) Enabled() bool { return l.refill > 0 }

// Allow consumes a token for key, returning false when the caller is over limit.
func (l *Limiter) Allow(key string) bool {
	if !l.Enabled() {
		return true
	}
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.capacity, capacity: l.capacity, refill: l.refill, last: now}
		l.buckets[key] = b
	}
	return b.allow(now)
}

func (l *Limiter) sweep() {
	ticker := time.NewTicker(l.ttl)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-l.ttl)
		l.mu.Lock()
		for k, b := range l.buckets {
			if b.last.Before(cutoff) {
				delete(l.buckets, k)
			}
		}
		l.mu.Unlock()
	}
}

// Middleware returns a Gin middleware that rate-limits by tenant_id (set by the
// auth middleware) and falls back to the client IP when no tenant is present.
// On rejection it returns 429 with a Retry-After hint.
func (l *Limiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !l.Enabled() {
			c.Next()
			return
		}
		key := "ip:" + c.ClientIP()
		if t, ok := c.Get("tenant_id"); ok {
			if s, ok := t.(string); ok && s != "" {
				key = "tenant:" + s
			}
		}
		if !l.Allow(key) {
			c.Header("Retry-After", "1")
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limit exceeded",
				"details": "Too many AI requests for this tenant; retry shortly",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
