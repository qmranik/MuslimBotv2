package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"muslimbot-orchestrator/internal/config"
)

const (
	WorkloadAudience = "go-orchestrator"
	WorkloadSubject  = "livekit-worker"
	ScopeKBRead      = "kb:read"
	ScopeERPRead     = "erp:read"
	ScopeERPWrite    = "erp:write:prepare"
)

// WorkloadClaims binds a LiveKit worker to a tenant/session/scopes.
type WorkloadClaims struct {
	TenantID  string   `json:"tenant_id"`
	RoomName  string   `json:"room_name"`
	SessionID string   `json:"session_id"`
	UserEmail string   `json:"user_email"`
	UserName  string   `json:"user_name"`
	Scopes    []string `json:"scopes"`
	jwt.RegisteredClaims
}

// MintWorkloadToken issues a short-lived worker JWT for a dispatched voice room.
func MintWorkloadToken(cfg *config.Config, tenantID, roomName, sessionID, userEmail, userName string, scopes []string, ttl time.Duration) (string, string, error) {
	secret := cfg.WorkloadJWTSecret
	if secret == "" {
		secret = cfg.OrchestratorServiceAPIKey
	}
	if secret == "" {
		return "", "", errors.New("WORKLOAD_JWT_SECRET or ORCHESTRATOR_SERVICE_API_KEY required")
	}
	if ttl <= 0 {
		ttl = time.Hour
	}
	jti, err := randomHex(16)
	if err != nil {
		return "", "", err
	}
	now := time.Now()
	claims := WorkloadClaims{
		TenantID:  tenantID,
		RoomName:  roomName,
		SessionID: sessionID,
		UserEmail: userEmail,
		UserName:  userName,
		Scopes:    scopes,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "liteerp-orchestrator",
			Subject:   WorkloadSubject,
			Audience:  []string{WorkloadAudience},
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-30 * time.Second)),
			ID:        jti,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}
	return signed, jti, nil
}

// ParseWorkloadToken validates a worker JWT.
func ParseWorkloadToken(cfg *config.Config, raw string) (*WorkloadClaims, error) {
	secret := cfg.WorkloadJWTSecret
	if secret == "" {
		secret = cfg.OrchestratorServiceAPIKey
	}
	if secret == "" {
		return nil, errors.New("workload JWT secret not configured")
	}
	parsed, err := jwt.ParseWithClaims(raw, &WorkloadClaims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithAudience(WorkloadAudience))
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*WorkloadClaims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid workload token")
	}
	if claims.Subject != WorkloadSubject {
		return nil, errors.New("invalid workload subject")
	}
	if claims.TenantID == "" || claims.RoomName == "" || claims.SessionID == "" {
		return nil, errors.New("workload token missing required claims")
	}
	return claims, nil
}

// WorkloadMiddleware authenticates LiveKit worker requests via Bearer JWT.
// Tenant and scopes are taken exclusively from signed claims.
func WorkloadMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := bearerToken(c.GetHeader("Authorization"))
		if raw == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing workload bearer token"})
			c.Abort()
			return
		}
		claims, err := ParseWorkloadToken(cfg, raw)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid workload token", "details": err.Error()})
			c.Abort()
			return
		}
		c.Set("tenant_id", claims.TenantID)
		c.Set("user_email", claims.UserEmail)
		c.Set("user_name", claims.UserName)
		c.Set("user_full_name", claims.UserName)
		c.Set("session_id", claims.SessionID)
		c.Set("room_name", claims.RoomName)
		c.Set("workload_scopes", claims.Scopes)
		c.Set("workload_jti", claims.ID)
		c.Set("auth_mode", "workload-jwt")
		c.Set("user_groups", []string{"voice-worker"})
		c.Next()
	}
}

// HasScope reports whether the request workload token includes a scope.
func HasScope(c *gin.Context, scope string) bool {
	raw, ok := c.Get("workload_scopes")
	if !ok {
		return false
	}
	scopes, ok := raw.([]string)
	if !ok {
		return false
	}
	for _, s := range scopes {
		if s == scope {
			return true
		}
	}
	return false
}

func bearerToken(header string) string {
	header = strings.TrimSpace(header)
	if header == "" {
		return ""
	}
	const prefix = "Bearer "
	if strings.HasPrefix(header, prefix) {
		return strings.TrimSpace(header[len(prefix):])
	}
	return ""
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// DefaultVoiceScopes are granted to dispatched voice workers.
func DefaultVoiceScopes() []string {
	return []string{ScopeKBRead, ScopeERPRead, ScopeERPWrite}
}
