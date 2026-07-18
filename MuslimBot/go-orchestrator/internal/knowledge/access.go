package knowledge

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
)

// KnowledgeAccess is the server-derived retrieval policy. Never accept tenant
// or visibility filters from request JSON (ADR-0002).
type KnowledgeAccess struct {
	TenantID             string   `json:"tenant_id"`
	AllowedVisibilities  []string `json:"allowed_visibilities"`
	SessionID            string   `json:"session_id,omitempty"`
	PrincipalType        string   `json:"principal_type"` // staff | public | workload
	KBGeneration         int64    `json:"kb_generation,omitempty"`
	PolicyKey            string   `json:"policy_key"`
}

// PolicyStaff allows public + private within the tenant.
func PolicyStaff(tenantID string) KnowledgeAccess {
	return KnowledgeAccess{
		TenantID:            strings.TrimSpace(tenantID),
		AllowedVisibilities: []string{VisibilityPublic, VisibilityPrivate},
		PrincipalType:       "staff",
		PolicyKey:           "staff",
	}
}

// PolicyPublic allows only public within the tenant.
func PolicyPublic(tenantID string) KnowledgeAccess {
	return KnowledgeAccess{
		TenantID:            strings.TrimSpace(tenantID),
		AllowedVisibilities: []string{VisibilityPublic},
		PrincipalType:       "public",
		PolicyKey:           "public",
	}
}

// PolicyFromCaller builds access from Authentik Gin context.
func PolicyFromCaller(c *gin.Context) (KnowledgeAccess, error) {
	tenant, _ := c.Get("tenant_id")
	tid, _ := tenant.(string)
	tid = strings.TrimSpace(tid)
	if tid == "" {
		return KnowledgeAccess{}, fmt.Errorf("tenant_id missing from auth context")
	}
	groupsAny, _ := c.Get("user_groups")
	groups, _ := groupsAny.([]string)
	if IsStaff(groups) {
		return PolicyStaff(tid), nil
	}
	return PolicyPublic(tid), nil
}

// PolicyFromWorkload builds access for LiveKit workers. Voice agents receive
// staff-equivalent KB visibility for the signed tenant (org assistant).
func PolicyFromWorkload(c *gin.Context) (KnowledgeAccess, error) {
	tenant, _ := c.Get("tenant_id")
	tid, _ := tenant.(string)
	tid = strings.TrimSpace(tid)
	if tid == "" {
		return KnowledgeAccess{}, fmt.Errorf("tenant_id missing from workload claims")
	}
	session, _ := c.Get("session_id")
	sid, _ := session.(string)
	access := PolicyStaff(tid)
	access.PrincipalType = "workload"
	access.SessionID = sid
	access.PolicyKey = "workload_staff"
	return access, nil
}

// Validate ensures the access policy is usable for fail-closed retrieval.
func (a KnowledgeAccess) Validate() error {
	if strings.TrimSpace(a.TenantID) == "" {
		return fmt.Errorf("tenant_id required")
	}
	if len(a.AllowedVisibilities) == 0 {
		return fmt.Errorf("allowed_visibilities required")
	}
	for _, v := range a.AllowedVisibilities {
		if v != VisibilityPublic && v != VisibilityPrivate {
			return fmt.Errorf("invalid visibility %q", v)
		}
	}
	return nil
}

// VisibilitiesJSON serializes allowed visibilities for VoiceSession persistence.
func (a KnowledgeAccess) VisibilitiesJSON() string {
	b, _ := json.Marshal(a.AllowedVisibilities)
	return string(b)
}
