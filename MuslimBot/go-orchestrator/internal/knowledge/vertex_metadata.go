package knowledge

import (
	"fmt"
	"regexp"
	"strings"
)

var safeTenantRe = regexp.MustCompile(`^[a-zA-Z0-9_.:@-]{1,128}$`)

// FileMetadata is attached to every imported RagFile before indexed.
type FileMetadata struct {
	TenantID       string
	SourceID       string
	Visibility     string
	SchemaVersion  string
	SourceRevision int64
	ContentHash    string
	IngestID       string
}

// ValidateFileMetadata fail-closes incomplete metadata.
func ValidateFileMetadata(m FileMetadata) error {
	if !safeTenantRe.MatchString(strings.TrimSpace(m.TenantID)) {
		return fmt.Errorf("invalid tenant_id for metadata")
	}
	if strings.TrimSpace(m.SourceID) == "" {
		return fmt.Errorf("source_id required")
	}
	if m.Visibility != VisibilityPublic && m.Visibility != VisibilityPrivate {
		return fmt.Errorf("visibility must be public or private")
	}
	if strings.TrimSpace(m.SchemaVersion) == "" {
		return fmt.Errorf("schema_version required")
	}
	if m.SourceRevision < 1 {
		return fmt.Errorf("source_revision must be >= 1")
	}
	return nil
}

// BuildCELFilter constructs the Vertex metadata_filter expression.
// Tenant and visibility values are validated; never concatenate untrusted input.
func BuildCELFilter(access KnowledgeAccess) (string, error) {
	if err := access.Validate(); err != nil {
		return "", err
	}
	if !safeTenantRe.MatchString(access.TenantID) {
		return "", fmt.Errorf("tenant_id failed safety check")
	}
	tenant := access.TenantID
	hasPublic := false
	hasPrivate := false
	for _, v := range access.AllowedVisibilities {
		switch v {
		case VisibilityPublic:
			hasPublic = true
		case VisibilityPrivate:
			hasPrivate = true
		default:
			return "", fmt.Errorf("invalid visibility in policy")
		}
	}
	switch {
	case hasPublic && hasPrivate:
		return fmt.Sprintf(
			`tenant_id == "%s" && (visibility == "public" || visibility == "private")`,
			tenant,
		), nil
	case hasPublic:
		return fmt.Sprintf(`tenant_id == "%s" && visibility == "public"`, tenant), nil
	case hasPrivate:
		return fmt.Sprintf(`tenant_id == "%s" && visibility == "private"`, tenant), nil
	default:
		return "", fmt.Errorf("no allowed visibilities")
	}
}

// MetadataMap returns the key/value map Vertex expects on RagFile metadata.
func MetadataMap(m FileMetadata) (map[string]string, error) {
	if err := ValidateFileMetadata(m); err != nil {
		return nil, err
	}
	out := map[string]string{
		"tenant_id":       m.TenantID,
		"source_id":       m.SourceID,
		"visibility":      m.Visibility,
		"schema_version":  m.SchemaVersion,
		"source_revision": fmt.Sprintf("%d", m.SourceRevision),
	}
	if m.ContentHash != "" {
		out["content_hash"] = m.ContentHash
	}
	if m.IngestID != "" {
		out["ingest_id"] = m.IngestID
	}
	return out, nil
}
