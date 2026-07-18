package knowledge

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

const (
	EventGenerationChanged = "kb.generation.changed"
	EventSourceIndexed     = "kb.source.indexed"
	EventSourceDeleted     = "kb.source.deleted"
	EventVisibilityChanged = "kb.source.visibility_changed"

	DestRedisStream = "redis_stream"
	DestN8N         = "n8n"
)

// GenerationChangedPayload is published to Redis Streams (IDs only).
type GenerationChangedPayload struct {
	EventID    string `json:"event_id"`
	Type       string `json:"type"`
	TenantID   string `json:"tenant_id"`
	Generation int64  `json:"generation"`
	SourceID   string `json:"source_id,omitempty"`
	Change     string `json:"change"`
	TS         int64  `json:"ts"`
}

// RecordGenerationChange bumps generation and inserts an outbox row in tx.
func RecordGenerationChange(tx *gorm.DB, cfg *config.Config, tenantID, sourceID, change string) (GenerationChangedPayload, error) {
	var empty GenerationChangedPayload
	generation, err := BumpGeneration(tx, tenantID)
	if err != nil {
		return empty, err
	}
	eventID := uuid.NewString()
	payload := GenerationChangedPayload{
		EventID:    eventID,
		Type:       EventGenerationChanged,
		TenantID:   tenantID,
		Generation: generation,
		SourceID:   sourceID,
		Change:     change,
		TS:         time.Now().UTC().Unix(),
	}
	body, _ := json.Marshal(payload)
	idem := fmt.Sprintf("kb-gen:%s:%d:%s:%s", tenantID, generation, sourceID, change)
	prefix := "kb:events:"
	if cfg != nil && cfg.KBEventStreamPrefix != "" {
		prefix = cfg.KBEventStreamPrefix
	}
	now := time.Now().UTC()
	row := store.EventOutbox{
		EventID:        eventID,
		Type:           EventGenerationChanged,
		TenantID:       tenantID,
		Source:         "knowledge",
		AggregateType:  "kb_source",
		AggregateID:    sourceID,
		Payload:        string(body),
		IdempotencyKey: idem,
		Status:         "pending",
		Destination:    DestRedisStream,
		Topic:          prefix + tenantID,
		MaxAttempts:    8,
		AvailableAt:    &now,
	}
	if err := tx.Create(&row).Error; err != nil {
		return empty, err
	}
	return payload, nil
}

// PublishGenerationStream writes directly to Redis after commit (best-effort);
// outbox retries recover missed publishes.
func PublishGenerationStream(ctx context.Context, cfg *config.Config, payload GenerationChangedPayload) error {
	rdb := Redis(cfg)
	if rdb == nil {
		return fmt.Errorf("redis unavailable")
	}
	prefix := cfg.KBEventStreamPrefix
	if prefix == "" {
		prefix = "kb:events:"
	}
	stream := prefix + payload.TenantID
	args := &redis.XAddArgs{
		Stream: stream,
		Values: map[string]interface{}{
			"event_id":   payload.EventID,
			"type":       payload.Type,
			"tenant_id":  payload.TenantID,
			"generation": payload.Generation,
			"source_id":  payload.SourceID,
			"change":     payload.Change,
			"ts":         payload.TS,
			"payload":    mustJSON(payload),
		},
	}
	if cfg.KBEventStreamMaxLen > 0 {
		args.MaxLen = cfg.KBEventStreamMaxLen
		args.Approx = true
	}
	if err := rdb.XAdd(ctx, args).Err(); err != nil {
		return err
	}
	MirrorGeneration(ctx, cfg, payload.TenantID, payload.Generation)
	return nil
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// CommitGenerationChange runs bump+outbox then best-effort stream publish.
func CommitGenerationChange(cfg *config.Config, tenantID, sourceID, change string) (int64, error) {
	if store.DB == nil {
		return 0, fmt.Errorf("database unavailable")
	}
	var payload GenerationChangedPayload
	err := store.DB.Transaction(func(tx *gorm.DB) error {
		p, err := RecordGenerationChange(tx, cfg, tenantID, sourceID, change)
		if err != nil {
			return err
		}
		payload = p
		return nil
	})
	if err != nil {
		return 0, err
	}
	_ = PublishGenerationStream(context.Background(), cfg, payload)
	return payload.Generation, nil
}
