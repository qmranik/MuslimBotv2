package knowledge

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"muslimbot-orchestrator/internal/config"
)

func GenerationKey(tenantID string) string {
	return "kb:generation:" + tenantID
}

func VoiceBriefKey(tenantID, policy string, generation int64) string {
	return fmt.Sprintf("kb:voice-brief:%s:%s:%d", tenantID, policy, generation)
}

func RetrieveCacheKey(tenantID, policy string, generation int64, query string) string {
	sum := sha256.Sum256([]byte(query))
	return fmt.Sprintf("kb:retrieve:%s:%s:%d:%s", tenantID, policy, generation, hex.EncodeToString(sum[:8]))
}

// GetVoiceBrief returns a generation-scoped brief, or empty on miss.
func GetVoiceBrief(ctx context.Context, cfg *config.Config, access KnowledgeAccess, generation int64) string {
	rdb := Redis(cfg)
	if rdb == nil {
		return ""
	}
	val, err := rdb.Get(ctx, VoiceBriefKey(access.TenantID, access.PolicyKey, generation)).Result()
	if err != nil {
		return ""
	}
	return val
}

// SetVoiceBriefCAS writes the brief only if the tenant generation has not advanced.
func SetVoiceBriefCAS(ctx context.Context, cfg *config.Config, access KnowledgeAccess, generation int64, brief string) error {
	rdb := Redis(cfg)
	if rdb == nil {
		return nil
	}
	ttl := time.Duration(cfg.KBBriefTTLSec) * time.Second
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	key := VoiceBriefKey(access.TenantID, access.PolicyKey, generation)
	genKey := GenerationKey(access.TenantID)
	script := redis.NewScript(`
local current = redis.call("GET", KEYS[1])
if current and tonumber(current) and tonumber(current) > tonumber(ARGV[1]) then
  return 0
end
redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
redis.call("SET", KEYS[1], ARGV[1])
return 1
`)
	_, err := script.Run(ctx, rdb, []string{genKey, key}, generation, brief, int(ttl.Seconds())).Result()
	return err
}

// GetCachedRetrieve returns a short-lived retrieve payload.
func GetCachedRetrieve(ctx context.Context, cfg *config.Config, access KnowledgeAccess, generation int64, query string) string {
	rdb := Redis(cfg)
	if rdb == nil || cfg.KBRetrieveCacheTTLSec <= 0 {
		return ""
	}
	val, err := rdb.Get(ctx, RetrieveCacheKey(access.TenantID, access.PolicyKey, generation, query)).Result()
	if err != nil {
		return ""
	}
	return val
}

// SetCachedRetrieve stores a short-lived retrieve payload for the generation.
func SetCachedRetrieve(ctx context.Context, cfg *config.Config, access KnowledgeAccess, generation int64, query, payload string) {
	rdb := Redis(cfg)
	if rdb == nil || cfg.KBRetrieveCacheTTLSec <= 0 {
		return
	}
	ttl := time.Duration(cfg.KBRetrieveCacheTTLSec) * time.Second
	_ = rdb.Set(ctx, RetrieveCacheKey(access.TenantID, access.PolicyKey, generation, query), payload, ttl).Err()
}
