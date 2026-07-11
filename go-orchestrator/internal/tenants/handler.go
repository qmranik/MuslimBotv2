package tenants

import (
	"net/http"

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
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	tenant := store.Tenant{
		TenantID:   req.TenantID,
		FrappeSite: req.FrappeSite,
		Status:     "provisioning",
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
		// Mock response
		tenant = store.Tenant{TenantID: tenantID, Status: "active"}
	}

	c.JSON(http.StatusOK, gin.H{"tenant_id": tenant.TenantID, "status": tenant.Status})
}
