package knowledge

import (
	"testing"

	"muslimbot-orchestrator/internal/store"
)

func TestIsStaff(t *testing.T) {
	if !IsStaff([]string{"admins"}) {
		t.Fatal("admins should be staff")
	}
	if !IsStaff([]string{"smb_manager"}) {
		t.Fatal("smb_manager should be staff")
	}
	if IsStaff([]string{"customers", "guests"}) {
		t.Fatal("customers should not be staff")
	}
}

func TestFilterVisible(t *testing.T) {
	sources := []store.KBSource{
		{ID: "1", TenantID: "acme", Visibility: VisibilityPublic},
		{ID: "2", TenantID: "acme", Visibility: VisibilityPrivate},
		{ID: "3", TenantID: "other", Visibility: VisibilityPublic},
	}
	staff := FilterVisible(sources, "acme", true)
	if len(staff) != 2 {
		t.Fatalf("staff expected 2, got %d", len(staff))
	}
	guest := FilterVisible(sources, "acme", false)
	if len(guest) != 1 || guest[0].ID != "1" {
		t.Fatalf("guest expected only public, got %+v", guest)
	}
}
