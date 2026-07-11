package tenants

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

type Handler struct {
	config *config.Config
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{config: cfg}
}

type CreateTenantRequest struct {
	TenantID   string `json:"tenant_id"`
	FrappeSite string `json:"frappe_site"`
}

func (h *Handler) CreateTenant(c *gin.Context) {
	var req CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.TenantID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	tenant := store.Tenant{
		TenantID:       req.TenantID,
		FrappeSite:     req.FrappeSite,
		Status:         "provisioning",
		AuthentikGroup: "tenant-" + req.TenantID,
		N8NWebhookBase: strings.TrimRight(h.config.N8NBaseURL, "/") + "/webhook",
		FeaturesJSON:   "{}",
	}

	if store.DB != nil {
		if err := store.DB.Create(&tenant).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tenant"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "provisioning", "tenant_id": tenant.TenantID})
}

func (h *Handler) GetTenantStatus(c *gin.Context) {
	tenantID := c.Param("id")

	var tenant store.Tenant
	if store.DB != nil {
		if err := store.DB.Where("tenant_id = ?", tenantID).First(&tenant).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tenant not found"})
			return
		}
	} else {
		tenant = store.Tenant{TenantID: tenantID, Status: "active"}
	}

	c.JSON(http.StatusOK, gin.H{
		"tenant_id":       tenant.TenantID,
		"status":          tenant.Status,
		"frappe_site":     tenant.FrappeSite,
		"authentik_group": tenant.AuthentikGroup,
		"n8n_webhook_base": tenant.N8NWebhookBase,
		"features":        parseFeatures(tenant.FeaturesJSON),
	})
}

func (h *Handler) Onboard(c *gin.Context) {
	tenantID := c.Param("id")
	if strings.TrimSpace(tenantID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant id required"})
		return
	}

	var body struct {
		FrappeSite string `json:"frappe_site"`
	}
	_ = c.ShouldBindJSON(&body)

	if store.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":          "active",
			"tenant_id":       tenantID,
			"authentik_group": "tenant-" + tenantID,
			"mode":            "shared_schema_v1",
		})
		return
	}

	var tenant store.Tenant
	err := store.DB.Where("tenant_id = ?", tenantID).First(&tenant).Error
	if err != nil {
		tenant = store.Tenant{
			TenantID:       tenantID,
			FrappeSite:     body.FrappeSite,
			Status:         "active",
			AuthentikGroup: "tenant-" + tenantID,
			N8NWebhookBase: strings.TrimRight(h.config.N8NBaseURL, "/") + "/webhook",
			FeaturesJSON:   "{}",
		}
		if err := store.DB.Create(&tenant).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create tenant during onboard"})
			return
		}
	} else {
		updates := map[string]any{
			"status":          "active",
			"authentik_group": firstNonEmpty(tenant.AuthentikGroup, "tenant-"+tenantID),
			"n8n_webhook_base": firstNonEmpty(tenant.N8NWebhookBase, strings.TrimRight(h.config.N8NBaseURL, "/")+"/webhook"),
		}
		if body.FrappeSite != "" {
			updates["frappe_site"] = body.FrappeSite
		}
		if err := store.DB.Model(&tenant).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to onboard tenant"})
			return
		}
		_ = store.DB.Where("tenant_id = ?", tenantID).First(&tenant).Error
	}

	c.JSON(http.StatusOK, gin.H{
		"status":           tenant.Status,
		"tenant_id":        tenant.TenantID,
		"frappe_site":      tenant.FrappeSite,
		"authentik_group":  tenant.AuthentikGroup,
		"n8n_webhook_base": tenant.N8NWebhookBase,
		"mode":             "shared_schema_v1",
	})
}

func (h *Handler) UpdateFeatures(c *gin.Context) {
	tenantID := c.Param("id")
	var features map[string]any
	if err := c.ShouldBindJSON(&features); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid features payload"})
		return
	}
	raw, _ := json.Marshal(features)

	if store.DB == nil {
		c.JSON(http.StatusOK, gin.H{"status": "features updated", "tenant_id": tenantID, "features": features})
		return
	}

	res := store.DB.Model(&store.Tenant{}).Where("tenant_id = ?", tenantID).Update("features_json", string(raw))
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update features"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "features updated", "tenant_id": tenantID, "features": features})
}

func parseFeatures(raw string) map[string]any {
	out := map[string]any{}
	if strings.TrimSpace(raw) == "" {
		return out
	}
	_ = json.Unmarshal([]byte(raw), &out)
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
