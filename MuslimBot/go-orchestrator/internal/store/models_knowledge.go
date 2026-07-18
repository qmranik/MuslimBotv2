package store

import "time"

// TenantKBState tracks the monotonic KB generation for cache invalidation
// and voice-session refresh (ADR-0002).
type TenantKBState struct {
	TenantID   string    `gorm:"primaryKey;not null" json:"tenant_id"`
	Generation int64     `gorm:"not null;default:0" json:"generation"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// KBIngestionJob is a durable async import/retry record for a source revision.
type KBIngestionJob struct {
	ID               string     `gorm:"primaryKey;not null" json:"id"`
	TenantID         string     `gorm:"index;not null" json:"tenant_id"`
	SourceID         string     `gorm:"index;not null" json:"source_id"`
	Revision         int64      `gorm:"not null" json:"revision"`
	Status           string     `gorm:"default:'pending';index" json:"status"`
	Attempts         int        `gorm:"default:0" json:"attempts"`
	MaxAttempts      int        `gorm:"default:5" json:"max_attempts"`
	AvailableAt      time.Time  `gorm:"index" json:"available_at"`
	LockedAt         *time.Time `json:"locked_at,omitempty"`
	LockedBy         string     `json:"locked_by"`
	VertexOperationID string    `json:"vertex_operation_id"`
	ResultSink       string     `json:"result_sink"`
	LastError        string     `gorm:"type:text" json:"last_error"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// KB ingestion / metadata status constants.
const (
	KBMetaPending  = "pending"
	KBMetaAttached = "attached"
	KBMetaFailed   = "failed"

	KBJobPending   = "pending"
	KBJobRunning   = "running"
	KBJobSucceeded = "succeeded"
	KBJobFailed    = "failed"
	KBJobDead      = "dead"
)
