package knowledge

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	aiplatform "cloud.google.com/go/aiplatform/apiv1"
	aiplatformpb "cloud.google.com/go/aiplatform/apiv1/aiplatformpb"
	"cloud.google.com/go/storage"
	"github.com/google/uuid"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/iterator"
	"gorm.io/gorm"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

var unsafeNameRe = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

// SafeObjectName sanitizes a filename for GCS.
func SafeObjectName(name string) string {
	base := filepath.Base(name)
	base = unsafeNameRe.ReplaceAllString(base, "_")
	if base == "" || base == "." || base == ".." {
		base = "document.bin"
	}
	if len(base) > 180 {
		base = base[:180]
	}
	return base
}

// GCSObjectPath builds the tenant-namespaced object key.
func GCSObjectPath(tenantID, sourceID string, revision int64, filename string) string {
	return fmt.Sprintf(
		"rag-imports/%s/%s/%d/%s",
		tenantID, sourceID, revision, SafeObjectName(filename),
	)
}

// ContentHash returns a hex sha256 of the payload.
func ContentHash(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// DisplayNameForSource builds a unique Vertex display name from source + revision.
func DisplayNameForSource(sourceID string, revision int64, filename string) string {
	return fmt.Sprintf("%s-r%d-%s", sourceID, revision, SafeObjectName(filename))
}

// UploadBytesToGCS uploads data to the namespaced object and returns gs:// URI.
func UploadBytesToGCS(ctx context.Context, cfg *config.Config, objectPath string, data []byte) (string, error) {
	if cfg.GCSBucketName == "" {
		return "", fmt.Errorf("GCS_BUCKET_NAME not set")
	}
	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create storage client: %w", err)
	}
	defer storageClient.Close()

	wc := storageClient.Bucket(cfg.GCSBucketName).Object(objectPath).NewWriter(ctx)
	if _, err := wc.Write(data); err != nil {
		_ = wc.Close()
		return "", err
	}
	if err := wc.Close(); err != nil {
		return "", err
	}
	return fmt.Sprintf("gs://%s/%s", cfg.GCSBucketName, objectPath), nil
}

// ImportAndAttachMetadata imports a GCS object into the active corpus, resolves
// the RagFile resource, attaches tenant metadata, and returns the RagFile name.
func ImportAndAttachMetadata(ctx context.Context, cfg *config.Config, gcsURI, displayName string, meta FileMetadata) (ragFileID string, opName string, err error) {
	if err := ValidateFileMetadata(meta); err != nil {
		return "", "", err
	}
	if !VertexConfigured(cfg) {
		return "", "", fmt.Errorf("Vertex AI configs not set")
	}

	client, err := aiplatform.NewVertexRagDataClient(ctx)
	if err != nil {
		return "", "", fmt.Errorf("failed to create Vertex RAG Data client: %w", err)
	}
	defer client.Close()

	parent := fmt.Sprintf(
		"projects/%s/locations/%s/ragCorpora/%s",
		cfg.GCPProjectID, cfg.GCPLocation, cfg.ActiveRagCorpusID(),
	)

	req := &aiplatformpb.ImportRagFilesRequest{
		Parent: parent,
		ImportRagFilesConfig: &aiplatformpb.ImportRagFilesConfig{
			ImportSource: &aiplatformpb.ImportRagFilesConfig_GcsSource{
				GcsSource: &aiplatformpb.GcsSource{
					Uris: []string{gcsURI},
				},
			},
		},
	}

	op, err := client.ImportRagFiles(ctx, req)
	if err != nil {
		return "", "", err
	}
	opName = op.Name()
	if _, err := op.Wait(ctx); err != nil {
		return "", opName, err
	}

	ragFileID, err = findRagFileByName(ctx, client, parent, displayName)
	if err != nil {
		ragFileID, err = findRagFileContaining(ctx, client, parent, meta.SourceID)
		if err != nil {
			return "", opName, fmt.Errorf("resolve rag file: %w", err)
		}
	}

	if err := AttachRagFileMetadata(ctx, cfg, ragFileID, meta); err != nil {
		return ragFileID, opName, fmt.Errorf("attach metadata: %w", err)
	}
	return ragFileID, opName, nil
}

func findRagFileByName(ctx context.Context, client *aiplatform.VertexRagDataClient, parentCorpus, displayName string) (string, error) {
	req := &aiplatformpb.ListRagFilesRequest{Parent: parentCorpus}
	it := client.ListRagFiles(ctx, req)
	for {
		resp, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return "", err
		}
		if resp.DisplayName == displayName {
			return resp.Name, nil
		}
	}
	return "", fmt.Errorf("rag file not found for display name %q", displayName)
}

func findRagFileContaining(ctx context.Context, client *aiplatform.VertexRagDataClient, parentCorpus, needle string) (string, error) {
	req := &aiplatformpb.ListRagFilesRequest{Parent: parentCorpus}
	it := client.ListRagFiles(ctx, req)
	for {
		resp, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return "", err
		}
		if strings.Contains(resp.DisplayName, needle) || strings.Contains(resp.Name, needle) {
			return resp.Name, nil
		}
	}
	return "", fmt.Errorf("rag file not found containing %q", needle)
}

// AttachRagFileMetadata PATCHes RagFile metadata via the v1beta1 REST API.
func AttachRagFileMetadata(ctx context.Context, cfg *config.Config, ragFileName string, meta FileMetadata) error {
	metaMap, err := MetadataMap(meta)
	if err != nil {
		return err
	}
	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return err
	}
	urlStr := fmt.Sprintf(
		"https://%s-aiplatform.googleapis.com/v1beta1/%s?updateMask=ragFileMetadata",
		cfg.GCPLocation, ragFileName,
	)
	body := map[string]interface{}{
		"ragFileMetadata": map[string]interface{}{
			"keyValueMetadata": metaMapToKV(metaMap),
		},
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, urlStr, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
		return fmt.Errorf("update RagFile metadata status %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func metaMapToKV(m map[string]string) []map[string]string {
	out := make([]map[string]string, 0, len(m))
	for k, v := range m {
		out = append(out, map[string]string{"key": k, "value": v})
	}
	return out
}

// CreateIngestionJob persists a durable job row for a source revision.
func CreateIngestionJob(tenantID, sourceID string, revision int64) (*store.KBIngestionJob, error) {
	if store.DB == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	now := time.Now().UTC()
	job := &store.KBIngestionJob{
		ID:          "KBI-" + uuid.NewString(),
		TenantID:    tenantID,
		SourceID:    sourceID,
		Revision:    revision,
		Status:      store.KBJobPending,
		MaxAttempts: 5,
		AvailableAt: now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := store.DB.Create(job).Error; err != nil {
		return nil, err
	}
	return job, nil
}

// MarkSourceFailed records a failed ingestion with error text.
func MarkSourceFailed(sourceID, errMsg string) {
	if store.DB == nil {
		return
	}
	_ = store.DB.Model(&store.KBSource{}).Where("id = ?", sourceID).Updates(map[string]interface{}{
		"status":          "failed",
		"error":           errMsg,
		"metadata_status": store.KBMetaFailed,
		"updated_at":      time.Now().UTC(),
	}).Error
}

// FinalizeIndexed updates the source as indexed + metadata attached and emits a generation event.
func FinalizeIndexed(cfg *config.Config, sourceID, tenantID, ragFileID, gcsObject, opName, contentHash string, revision int64) error {
	if store.DB == nil {
		return fmt.Errorf("database unavailable")
	}
	now := time.Now().UTC()
	var payload GenerationChangedPayload
	err := store.DB.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"status":              "indexed",
			"rag_file_id":         ragFileID,
			"gcs_object":          gcsObject,
			"vertex_operation_id": opName,
			"content_hash":        contentHash,
			"revision":            revision,
			"metadata_status":     store.KBMetaAttached,
			"indexed_at":          now,
			"last_synced_at":      now,
			"error":               "",
			"updated_at":          now,
		}
		if err := tx.Model(&store.KBSource{}).Where("id = ? AND tenant_id = ?", sourceID, tenantID).Updates(updates).Error; err != nil {
			return err
		}
		p, err := RecordGenerationChange(tx, cfg, tenantID, sourceID, "indexed")
		if err != nil {
			return err
		}
		payload = p
		return nil
	})
	if err != nil {
		return err
	}
	_ = PublishGenerationStream(context.Background(), cfg, payload)
	log.Printf("[kb/ingest] indexed source=%s tenant=%s generation=%d", sourceID, tenantID, payload.Generation)
	return nil
}

// SoftDeleteSource marks deleted_at and bumps generation; Vertex delete is async.
func SoftDeleteSource(cfg *config.Config, source *store.KBSource) error {
	if store.DB == nil || source == nil {
		return fmt.Errorf("database unavailable")
	}
	now := time.Now().UTC()
	var payload GenerationChangedPayload
	err := store.DB.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"status":     "deleted",
			"deleted_at": now,
			"updated_at": now,
		}
		if err := tx.Model(&store.KBSource{}).Where("id = ? AND tenant_id = ?", source.ID, source.TenantID).Updates(updates).Error; err != nil {
			return err
		}
		p, err := RecordGenerationChange(tx, cfg, source.TenantID, source.ID, "deleted")
		if err != nil {
			return err
		}
		payload = p
		return nil
	})
	if err != nil {
		return err
	}
	_ = PublishGenerationStream(context.Background(), cfg, payload)
	return nil
}

// UpdateSourceVisibility changes visibility, updates Vertex metadata when possible, bumps generation.
func UpdateSourceVisibility(cfg *config.Config, source *store.KBSource, visibility, title string) error {
	if store.DB == nil || source == nil {
		return fmt.Errorf("database unavailable")
	}
	if visibility != VisibilityPublic && visibility != VisibilityPrivate {
		return fmt.Errorf("invalid visibility")
	}
	now := time.Now().UTC()
	source.Visibility = visibility
	if strings.TrimSpace(title) != "" {
		source.Title = strings.TrimSpace(title)
	}
	source.UpdatedAt = now
	source.Revision++

	if source.RagFileID != "" && VertexConfigured(cfg) {
		meta := FileMetadata{
			TenantID:       source.TenantID,
			SourceID:       source.ID,
			Visibility:     visibility,
			SchemaVersion:  cfg.RagMetadataSchemaVersion,
			SourceRevision: source.Revision,
			ContentHash:    source.ContentHash,
		}
		if err := AttachRagFileMetadata(context.Background(), cfg, source.RagFileID, meta); err != nil {
			return fmt.Errorf("vertex metadata update: %w", err)
		}
	}

	var payload GenerationChangedPayload
	err := store.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(source).Error; err != nil {
			return err
		}
		p, err := RecordGenerationChange(tx, cfg, source.TenantID, source.ID, "visibility_changed")
		if err != nil {
			return err
		}
		payload = p
		return nil
	})
	if err != nil {
		return err
	}
	_ = PublishGenerationStream(context.Background(), cfg, payload)
	return nil
}

// IngestBytes is the shared upload pipeline used by file and URL handlers.
func IngestBytes(ctx context.Context, cfg *config.Config, source store.KBSource, filename string, data []byte) error {
	revision := source.Revision
	if revision < 1 {
		revision = 1
	}
	objectPath := GCSObjectPath(source.TenantID, source.ID, revision, filename)
	displayName := DisplayNameForSource(source.ID, revision, filename)
	hash := ContentHash(data)

	gcsURI, err := UploadBytesToGCS(ctx, cfg, objectPath, data)
	if err != nil {
		MarkSourceFailed(source.ID, err.Error())
		return err
	}
	_ = store.DB.Model(&store.KBSource{}).Where("id = ?", source.ID).Updates(map[string]interface{}{
		"gcs_object": objectPath,
		"status":     "indexing",
		"updated_at": time.Now().UTC(),
	}).Error

	meta := FileMetadata{
		TenantID:       source.TenantID,
		SourceID:       source.ID,
		Visibility:     source.Visibility,
		SchemaVersion:  cfg.RagMetadataSchemaVersion,
		SourceRevision: revision,
		ContentHash:    hash,
		IngestID:       uuid.NewString(),
	}
	ragFileID, opName, err := ImportAndAttachMetadata(ctx, cfg, gcsURI, displayName, meta)
	if err != nil {
		MarkSourceFailed(source.ID, err.Error())
		return err
	}
	return FinalizeIndexed(cfg, source.ID, source.TenantID, ragFileID, objectPath, opName, hash, revision)
}
