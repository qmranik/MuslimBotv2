// Package knowledge is the go-orchestrator Backend-for-Frontend for the
// organization Knowledge Base. It owns source METADATA and ACCESS GOVERNANCE
// (public vs private, per-tenant, per-role); the vectors/embeddings themselves
// live in Vertex AI (referenced by RagFileID) and are intentionally out of
// scope here. This is the "public and private data for the organization" layer.
package knowledge

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

type Handler struct {
	cfg *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg}
}

// Visibility values.
const (
	VisibilityPublic  = "public"
	VisibilityPrivate = "private"
)

// staffGroups mark a caller as internal staff (may see private knowledge).
var staffGroups = map[string]bool{
	"admins": true, "authentik Admins": true, "owner": true,
	"employee": true, "staff": true, "smb_manager": true, "smb_operator": true,
}

// IsStaff reports whether any of the caller's groups is an internal/staff group.
func IsStaff(groups []string) bool {
	for _, g := range groups {
		if staffGroups[strings.ToLower(strings.TrimSpace(g))] || staffGroups[strings.TrimSpace(g)] {
			return true
		}
	}
	return false
}

// FilterVisible returns the sources a caller may read: everything in their own
// tenant if staff; only public sources of their tenant otherwise. Cross-tenant
// access is never granted. Pure + unit-tested.
func FilterVisible(sources []store.KBSource, tenant string, staff bool) []store.KBSource {
	out := make([]store.KBSource, 0, len(sources))
	for _, s := range sources {
		if s.TenantID != tenant {
			continue
		}
		if staff || s.Visibility == VisibilityPublic {
			out = append(out, s)
		}
	}
	return out
}

func (h *Handler) caller(c *gin.Context) (tenant string, email string, staff bool) {
	tenant, _ = c.MustGet("tenant_id").(string)
	emailAny, _ := c.Get("user_email")
	email, _ = emailAny.(string)
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	return tenant, email, IsStaff(groups)
}

type registerRequest struct {
	Title      string `json:"title"`
	SourceType string `json:"source_type"`
	URL        string `json:"url"`
	Visibility string `json:"visibility"`
}

// RegisterSource: POST /v1/kb/org — record a knowledge source's metadata.
// Only staff may register sources. The actual ingestion to Vertex is performed
// out-of-band (KB worker); this endpoint governs ownership + visibility.
func (h *Handler) RegisterSource(c *gin.Context) {
	tenant, email, staff := h.caller(c)
	if !staff {
		c.JSON(http.StatusForbidden, gin.H{"error": "only staff may register knowledge sources"})
		return
	}
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title required"})
		return
	}
	visibility := strings.ToLower(strings.TrimSpace(req.Visibility))
	if visibility != VisibilityPublic {
		visibility = VisibilityPrivate
	}

	src := store.KBSource{
		ID:         uuid.NewString(),
		TenantID:   tenant,
		Title:      req.Title,
		SourceType: firstNonEmpty(req.SourceType, "document"),
		URL:        req.URL,
		Visibility: visibility,
		UploadedBy: email,
		Status:     "registered",
	}
	if store.DB != nil {
		if err := store.DB.Create(&src).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register source"})
			return
		}
	}
	c.JSON(http.StatusCreated, src)
}

// ListSources: GET /v1/kb/org?visibility= — sources the caller may read.
func (h *Handler) ListSources(c *gin.Context) {
	tenant, _, staff := h.caller(c)
	var rows []store.KBSource
	if store.DB != nil {
		q := store.DB.Where("tenant_id = ?", tenant)
		if v := strings.ToLower(c.Query("visibility")); v == VisibilityPublic || v == VisibilityPrivate {
			q = q.Where("visibility = ?", v)
		}
		q.Order("created_at DESC").Find(&rows)
	}
	visible := FilterVisible(rows, tenant, staff)
	c.JSON(http.StatusOK, gin.H{
		"sources":    visible,
		"count":      len(visible),
		"tenant":     tenant,
		"as_staff":   staff,
	})
}

// DeleteSource: DELETE /v1/kb/org/:id — staff-only, tenant-scoped.
func (h *Handler) DeleteSource(c *gin.Context) {
	tenant, _, staff := h.caller(c)
	if !staff {
		c.JSON(http.StatusForbidden, gin.H{"error": "only staff may delete knowledge sources"})
		return
	}
	id := c.Param("id")
	if store.DB != nil {
		res := store.DB.Where("id = ? AND tenant_id = ?", id, tenant).Delete(&store.KBSource{})
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "source not found in tenant"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
