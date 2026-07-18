package knowledge

import (
	"sync"

	"github.com/redis/go-redis/v9"
	"muslimbot-orchestrator/internal/config"
)

var (
	redisMu     sync.Mutex
	redisClient *redis.Client
	redisURL    string
)

// Redis returns a shared Redis client for the configured URL, or nil.
func Redis(cfg *config.Config) *redis.Client {
	if cfg == nil || cfg.RedisURL == "" {
		return nil
	}
	redisMu.Lock()
	defer redisMu.Unlock()
	if redisClient != nil && redisURL == cfg.RedisURL {
		return redisClient
	}
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil
	}
	redisClient = redis.NewClient(opt)
	redisURL = cfg.RedisURL
	return redisClient
}
