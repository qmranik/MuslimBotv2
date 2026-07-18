package knowledge

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

// CurrentGeneration returns the tenant KB generation (0 if unknown).
func CurrentGeneration(tenantID string) int64 {
	if store.DB == nil || tenantID == "" {
		return 0
	}
	var state store.TenantKBState
	if err := store.DB.Where("tenant_id = ?", tenantID).First(&state).Error; err != nil {
		return 0
	}
	return state.Generation
}

// BumpGeneration atomically increments TenantKBState and returns the new value.
// Must be called inside a transaction when pairing with outbox inserts.
func BumpGeneration(tx *gorm.DB, tenantID string) (int64, error) {
	if tx == nil {
		return 0, fmt.Errorf("db unavailable")
	}
	now := time.Now().UTC()
	var state store.TenantKBState
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("tenant_id = ?", tenantID).
		First(&state).Error
	if err == gorm.ErrRecordNotFound {
		state = store.TenantKBState{TenantID: tenantID, Generation: 1, UpdatedAt: now}
		if err := tx.Create(&state).Error; err != nil {
			return 0, err
		}
		return 1, nil
	}
	if err != nil {
		return 0, err
	}
	state.Generation++
	state.UpdatedAt = now
	if err := tx.Save(&state).Error; err != nil {
		return 0, err
	}
	return state.Generation, nil
}

// MirrorGeneration writes kb:generation:<tenant> for worker reconciliation.
func MirrorGeneration(ctx context.Context, cfg *config.Config, tenantID string, generation int64) {
	rdb := Redis(cfg)
	if rdb == nil || tenantID == "" {
		return
	}
	_ = rdb.Set(ctx, GenerationKey(tenantID), generation, 0).Err()
}
