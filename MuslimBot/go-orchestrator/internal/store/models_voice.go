package store

import (
	"time"

	"gorm.io/gorm"
)

// VoiceSession tracks a LiveKit room dispatched for a tenant user.
type VoiceSession struct {
	ID                      string     `gorm:"primaryKey;not null" json:"id"`
	TenantID                string     `gorm:"index;not null" json:"tenant_id"`
	RoomName                string     `gorm:"uniqueIndex;not null" json:"room_name"`
	UserEmail               string     `gorm:"index" json:"user_email"`
	UserName                string     `json:"user_name"`
	ParticipantID           string     `json:"participant_id"`
	ScopesJSON              string     `gorm:"type:text" json:"scopes_json"`
	AllowedVisibilitiesJSON string     `gorm:"type:text" json:"allowed_visibilities_json"`
	KBGeneration            int64      `json:"kb_generation"`
	LastKBRefreshAt         *time.Time `json:"last_kb_refresh_at,omitempty"`
	LastHeartbeatAt         *time.Time `json:"last_heartbeat_at,omitempty"`
	WorkloadJTI             string     `gorm:"index" json:"workload_jti"`
	Status                  string     `gorm:"default:'active';index" json:"status"`
	EndReason               string     `json:"end_reason"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
	EndedAt                 *time.Time `json:"ended_at,omitempty"`
}

// ToolAction is a durable prepare/confirm/execute record for agent writes.
type ToolAction struct {
	ID               string     `gorm:"primaryKey;not null" json:"id"`
	TenantID         string     `gorm:"index;not null" json:"tenant_id"`
	SessionID        string     `gorm:"index" json:"session_id"`
	RoomName         string     `gorm:"index" json:"room_name"`
	Tool             string     `gorm:"index;not null" json:"tool"`
	Kind             string     `gorm:"not null" json:"kind"` // read | write
	ArgsJSON         string     `gorm:"type:text;not null" json:"args_json"`
	ArgsDigest       string     `gorm:"not null" json:"args_digest"`
	Summary          string     `gorm:"type:text" json:"summary"`
	Status           string     `gorm:"default:'pending_confirmation';index" json:"status"`
	IdempotencyKey   string     `gorm:"uniqueIndex" json:"idempotency_key"`
	ActingUser       string     `json:"acting_user"`
	ResultJSON       string     `gorm:"type:text" json:"result_json"`
	Error            string     `gorm:"type:text" json:"error"`
	ConfirmEvidence  string     `gorm:"type:text" json:"confirm_evidence"`
	ExpiresAt        time.Time  `gorm:"index" json:"expires_at"`
	ConfirmedAt      *time.Time `json:"confirmed_at,omitempty"`
	ExecutedAt       *time.Time `json:"executed_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// ToolAuditEvent is an append-only audit trail for tool lifecycle events.
type ToolAuditEvent struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	ActionID  string         `gorm:"index;not null" json:"action_id"`
	TenantID  string         `gorm:"index;not null" json:"tenant_id"`
	EventType string         `gorm:"index;not null" json:"event_type"`
	Detail    string         `gorm:"type:text" json:"detail"`
	Actor     string         `json:"actor"`
}

// ToolAction status constants.
const (
	ToolActionPending   = "pending_confirmation"
	ToolActionApproved  = "approved"
	ToolActionRejected  = "rejected"
	ToolActionExecuted  = "executed"
	ToolActionFailed    = "failed"
	ToolActionExpired   = "expired"
)
