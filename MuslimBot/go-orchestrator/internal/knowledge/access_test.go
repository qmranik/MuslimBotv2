package knowledge

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"muslimbot-orchestrator/internal/store"
)

func TestIsStaff_CustomerExcluded(t *testing.T) {
	if !IsStaff([]string{"admins"}) {
		t.Fatal("admins should be staff")
	}
	if IsStaff([]string{"customer"}) {
		t.Fatal("customer should not be staff")
	}
}

func TestPolicyFromCaller(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "acme")
	c.Set("user_groups", []string{"admins"})
	access, err := PolicyFromCaller(c)
	if err != nil {
		t.Fatal(err)
	}
	if access.PolicyKey != "staff" || len(access.AllowedVisibilities) != 2 {
		t.Fatalf("unexpected access: %#v", access)
	}

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Set("tenant_id", "acme")
	c2.Set("user_groups", []string{"portal"})
	access, err = PolicyFromCaller(c2)
	if err != nil {
		t.Fatal(err)
	}
	if access.PolicyKey != "public" {
		t.Fatalf("expected public, got %#v", access)
	}
}

func TestPolicyFromWorkload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "acme")
	c.Set("session_id", "VS-1")
	access, err := PolicyFromWorkload(c)
	if err != nil {
		t.Fatal(err)
	}
	if access.PrincipalType != "workload" || access.SessionID != "VS-1" {
		t.Fatalf("unexpected: %#v", access)
	}
}

func TestFilterVisible_CrossTenant(t *testing.T) {
	sources := []store.KBSource{
		{ID: "1", TenantID: "acme", Visibility: VisibilityPublic},
		{ID: "2", TenantID: "other", Visibility: VisibilityPublic},
		{ID: "3", TenantID: "acme", Visibility: VisibilityPrivate},
	}
	out := FilterVisible(sources, "acme", false)
	if len(out) != 1 || out[0].ID != "1" {
		t.Fatalf("public filter failed: %#v", out)
	}
	out = FilterVisible(sources, "acme", true)
	if len(out) != 2 {
		t.Fatalf("staff filter failed: %#v", out)
	}
}
