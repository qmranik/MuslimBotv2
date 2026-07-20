package knowledge

import (
	"strings"
	"testing"
)

func TestBuildCELFilter_Public(t *testing.T) {
	filter, err := BuildCELFilter(PolicyPublic("acme"))
	if err != nil {
		t.Fatal(err)
	}
	if filter != `tenant_id == "acme" && visibility == "public"` {
		t.Fatalf("unexpected filter: %s", filter)
	}
}

func TestBuildCELFilter_Staff(t *testing.T) {
	filter, err := BuildCELFilter(PolicyStaff("acme"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(filter, `tenant_id == "acme"`) {
		t.Fatalf("missing tenant: %s", filter)
	}
	if !strings.Contains(filter, `visibility == "public"`) || !strings.Contains(filter, `visibility == "private"`) {
		t.Fatalf("missing visibility clause: %s", filter)
	}
}

func TestBuildCELFilter_FailClosed(t *testing.T) {
	_, err := BuildCELFilter(KnowledgeAccess{})
	if err == nil {
		t.Fatal("expected error for empty access")
	}
	_, err = BuildCELFilter(KnowledgeAccess{
		TenantID:            "bad tenant!",
		AllowedVisibilities: []string{VisibilityPublic},
		PolicyKey:           "public",
	})
	if err == nil {
		t.Fatal("expected error for unsafe tenant")
	}
}

func TestValidateFileMetadata(t *testing.T) {
	err := ValidateFileMetadata(FileMetadata{
		TenantID: "acme", SourceID: "KBS-1", Visibility: "public",
		SchemaVersion: "2", SourceRevision: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	err = ValidateFileMetadata(FileMetadata{
		TenantID: "acme", SourceID: "KBS-1", Visibility: "secret",
		SchemaVersion: "2", SourceRevision: 1,
	})
	if err == nil {
		t.Fatal("expected invalid visibility")
	}
}

func TestMetadataMap(t *testing.T) {
	m, err := MetadataMap(FileMetadata{
		TenantID: "acme", SourceID: "KBS-1", Visibility: "private",
		SchemaVersion: "2", SourceRevision: 3, ContentHash: "abc",
	})
	if err != nil {
		t.Fatal(err)
	}
	if m["tenant_id"] != "acme" || m["source_revision"] != "3" || m["content_hash"] != "abc" {
		t.Fatalf("unexpected map: %#v", m)
	}
}
