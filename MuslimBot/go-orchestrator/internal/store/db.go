package store

import (
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB is the global database handle. Nil if connection failed (graceful degradation).
var DB *gorm.DB

// TenantUserMapping maps an Authentik-managed user email to a platform tenant.
// Authentik owns the user identity; this table only tracks the tenant association.
type TenantUserMapping struct {
	gorm.Model
	Email    string `gorm:"uniqueIndex;not null" json:"email"`
	TenantID string `gorm:"not null;index"       json:"tenant_id"`
	Role     string `gorm:"default:'member'"      json:"role"`
}

// Tenant represents a provisioned tenant on the platform.
type Tenant struct {
	gorm.Model
	TenantID       string `gorm:"uniqueIndex;not null" json:"tenant_id"`
	FrappeSite     string `json:"frappe_site"`
	Status         string `gorm:"default:'provisioning'" json:"status"`
	AuthentikGroup string `json:"authentik_group"`
	N8NWebhookBase string `json:"n8n_webhook_base"`
	FeaturesJSON   string `gorm:"type:text" json:"features_json"`
}

// EventOutbox stores cross-service events for async dispatch (n8n and/or Redis Streams).
type EventOutbox struct {
	gorm.Model
	EventID        string     `gorm:"index" json:"event_id"`
	Type           string     `json:"type"`
	TenantID       string     `gorm:"index" json:"tenant_id"`
	Source         string     `json:"source"`
	AggregateType  string     `json:"aggregate_type"`
	AggregateID    string     `json:"aggregate_id"`
	Payload        string     `gorm:"type:text" json:"payload"`
	IdempotencyKey string     `gorm:"uniqueIndex" json:"idempotency_key"`
	Status         string     `gorm:"default:'pending';index" json:"status"`
	Destination    string     `gorm:"index" json:"destination"` // n8n | redis_stream
	Topic          string     `json:"topic"`
	Attempts       int        `gorm:"default:0" json:"attempts"`
	MaxAttempts    int        `gorm:"default:8" json:"max_attempts"`
	AvailableAt    *time.Time `gorm:"index" json:"available_at,omitempty"`
	LockedAt       *time.Time `json:"locked_at,omitempty"`
	LockedBy       string     `json:"locked_by"`
	LastError      string     `gorm:"type:text" json:"last_error"`
	SentAt         *time.Time `json:"sent_at,omitempty"`
}

// KBSource tracks knowledge base sources for RAG. The go-orchestrator owns this
// metadata + access governance; the vectors themselves live in Vertex AI
// (referenced by RagFileID). Visibility distinguishes org-public knowledge
// (readable by customers/portal) from private/internal knowledge (staff only).
type KBSource struct {
	ID             string     `gorm:"primaryKey;not null" json:"id"`
	TenantID       string     `gorm:"index;not null" json:"tenant_id"`
	Title          string     `json:"title"`
	SourceType     string     `json:"source_type"`
	URL            string     `json:"url"`
	RagFileID      string     `gorm:"index" json:"rag_file_id"`
	GCSObject      string     `json:"gcs_object"`
	ChunkCount     int        `json:"chunk_count"`
	Error          string     `gorm:"type:text" json:"error"`
	Visibility     string     `gorm:"default:'private';index" json:"visibility"`
	UploadedBy     string     `json:"uploaded_by"`
	Status         string     `gorm:"default:'queued';index" json:"status"`
	Revision       int64      `gorm:"default:1" json:"revision"`
	ContentHash    string     `json:"content_hash"`
	MetadataStatus string     `gorm:"default:'pending';index" json:"metadata_status"`
	VertexOperationID string  `json:"vertex_operation_id"`
	IndexedAt      *time.Time `json:"indexed_at,omitempty"`
	LastSyncedAt   *time.Time `json:"last_synced_at,omitempty"`
	DeletedAt      *time.Time `gorm:"index" json:"deleted_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// InitDB connects to the platform PostgreSQL instance and runs auto-migrations.
// If the connection fails, the orchestrator continues without a DB (graceful degradation).
func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=platform-postgres user=liteerp_admin password=postgres dbname=authentik_db port=5432 sslmode=disable"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Println("Database connection failed, running without DB:", err)
		return
	}

	err = db.AutoMigrate(
		&TenantUserMapping{},
		&Tenant{},
		&EventOutbox{},
		&KBSource{},
		&TenantKBState{},
		&KBIngestionJob{},
		&VoiceSession{},
		&ToolAction{},
		&ToolAuditEvent{},
	)
	if err != nil {
		log.Println("Failed to migrate database schema:", err)
	}

	DB = db
	log.Println("Database initialized and schema migrated.")
}
