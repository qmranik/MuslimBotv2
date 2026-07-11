package store

import (
	"log"
	"os"

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

// EventOutbox stores cross-service events for async dispatch to n8n.
type EventOutbox struct {
	gorm.Model
	Type           string `json:"type"`
	TenantID       string `json:"tenant_id"`
	Source         string `json:"source"`
	Payload        string `json:"payload"`
	IdempotencyKey string `gorm:"uniqueIndex" json:"idempotency_key"`
	Status         string `gorm:"default:'pending'" json:"status"`
}

// KBSource tracks knowledge base sources for RAG. The go-orchestrator owns this
// metadata + access governance; the vectors themselves live in Vertex AI
// (referenced by RagFileID). Visibility distinguishes org-public knowledge
// (readable by customers/portal) from private/internal knowledge (staff only).
type KBSource struct {
	ID         string `gorm:"primaryKey;not null" json:"id"`
	TenantID   string `gorm:"index" json:"tenant_id"`
	Title      string `json:"title"`
	SourceType string `json:"source_type"`
	URL        string `json:"url"`
	RagFileID  string `json:"rag_file_id"` // Vertex AI RAG file/corpus reference
	Visibility string `gorm:"default:'private';index" json:"visibility"` // public | private
	UploadedBy string `json:"uploaded_by"`
	Status     string `gorm:"default:'queued'" json:"status"`
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

	err = db.AutoMigrate(&TenantUserMapping{}, &Tenant{}, &EventOutbox{}, &KBSource{})
	if err != nil {
		log.Println("Failed to migrate database schema:", err)
	}

	DB = db
	log.Println("Database initialized and schema migrated.")
}
