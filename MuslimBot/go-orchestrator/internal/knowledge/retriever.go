package knowledge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"golang.org/x/oauth2/google"
	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/store"
)

// RagChunk is a filtered retrieval hit.
type RagChunk struct {
	Text       string  `json:"text"`
	Score      float64 `json:"score"`
	SourceID   string  `json:"source_id,omitempty"`
	RagFileID  string  `json:"rag_file_id,omitempty"`
	Visibility string  `json:"visibility,omitempty"`
}

// RetrieveResult is the authoritative filtered retrieve response.
type RetrieveResult struct {
	Query         string          `json:"query"`
	Chunks        []RagChunk      `json:"chunks"`
	ChunksUsed    int             `json:"chunks_used"`
	KBGeneration  int64           `json:"kb_generation"`
	AccessPolicy  KnowledgeAccess `json:"access_policy"`
	MetadataFilter string         `json:"metadata_filter"`
}

// VertexConfigured reports whether an active corpus is available.
func VertexConfigured(cfg *config.Config) bool {
	if cfg == nil {
		return false
	}
	return cfg.GCPProjectID != "" && cfg.GCPLocation != "" && cfg.ActiveRagCorpusID() != ""
}

// RetrieveFiltered runs Vertex retrieveContexts with a mandatory CEL filter.
func RetrieveFiltered(ctx context.Context, cfg *config.Config, access KnowledgeAccess, query string, topK int) (*RetrieveResult, error) {
	if err := access.Validate(); err != nil {
		return nil, fmt.Errorf("access policy: %w", err)
	}
	if !VertexConfigured(cfg) {
		return nil, fmt.Errorf("Vertex AI RAG configurations not set")
	}
	if cfg.RagAllowUnfiltered {
		return nil, fmt.Errorf("RAG_ALLOW_UNFILTERED is not permitted for shared-corpus retrieval")
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, fmt.Errorf("query required")
	}
	if topK <= 0 {
		topK = 8
	}
	if topK > 20 {
		topK = 20
	}

	filter, err := BuildCELFilter(access)
	if err != nil {
		return nil, fmt.Errorf("metadata filter: %w", err)
	}

	generation := CurrentGeneration(access.TenantID)
	access.KBGeneration = generation

	if cached := GetCachedRetrieve(ctx, cfg, access, generation, query); cached != "" {
		var cachedResult RetrieveResult
		if json.Unmarshal([]byte(cached), &cachedResult) == nil && len(cachedResult.Chunks) > 0 {
			return &cachedResult, nil
		}
	}

	chunks, err := retrieveContextsVertex(ctx, cfg, query, topK, filter)
	if err != nil {
		return nil, err
	}
	chunks = dropForeignChunks(chunks, access.TenantID)

	result := &RetrieveResult{
		Query:          query,
		Chunks:         chunks,
		ChunksUsed:     len(chunks),
		KBGeneration:   generation,
		AccessPolicy:   access,
		MetadataFilter: filter,
	}
	if payload, err := json.Marshal(result); err == nil {
		SetCachedRetrieve(ctx, cfg, access, generation, query, string(payload))
	}
	return result, nil
}

func retrieveContextsVertex(ctx context.Context, cfg *config.Config, query string, topK int, metadataFilter string) ([]RagChunk, error) {
	if strings.TrimSpace(metadataFilter) == "" {
		return nil, fmt.Errorf("metadata_filter required (fail closed)")
	}
	corpus := cfg.ActiveRagCorpusID()
	urlStr := fmt.Sprintf(
		"https://%s-aiplatform.googleapis.com/v1beta1/projects/%s/locations/%s:retrieveContexts",
		cfg.GCPLocation, cfg.GCPProjectID, cfg.GCPLocation,
	)

	requestBody := map[string]interface{}{
		"vertex_rag_store": map[string]interface{}{
			"rag_resources": []map[string]interface{}{
				{
					"rag_corpus": fmt.Sprintf(
						"projects/%s/locations/%s/ragCorpora/%s",
						cfg.GCPProjectID, cfg.GCPLocation, corpus,
					),
				},
			},
			"vector_distance_threshold": 0.3,
		},
		"query": map[string]interface{}{
			"text": query,
			"rag_retrieval_config": map[string]interface{}{
				"top_k": topK,
				"filter": map[string]interface{}{
					"metadata_filter": metadataFilter,
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, fmt.Errorf("failed to create Google client: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", urlStr, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Vertex retrieveContexts returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var responseData struct {
		Contexts struct {
			Contexts []struct {
				Text       string            `json:"text"`
				Score      float64           `json:"score"`
				SourceURI  string            `json:"sourceUri"`
				SourceName string            `json:"sourceDisplayName"`
				Metadata   map[string]string `json:"metadata"`
			} `json:"contexts"`
		} `json:"contexts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
		return nil, err
	}

	var chunks []RagChunk
	for _, c := range responseData.Contexts.Contexts {
		if strings.TrimSpace(c.Text) == "" {
			continue
		}
		chunk := RagChunk{Text: c.Text, Score: c.Score}
		if c.Metadata != nil {
			chunk.SourceID = c.Metadata["source_id"]
			chunk.Visibility = c.Metadata["visibility"]
		}
		chunks = append(chunks, chunk)
	}
	return chunks, nil
}

// dropForeignChunks drops hits whose source_id is present but not owned by the
// tenant. Chunks without source_id are kept only because Vertex already applied
// the mandatory CEL filter; Postgres attribution enriches when available.
func dropForeignChunks(chunks []RagChunk, tenantID string) []RagChunk {
	if len(chunks) == 0 || tenantID == "" {
		return chunks
	}
	out := make([]RagChunk, 0, len(chunks))
	for _, ch := range chunks {
		if ch.SourceID == "" || store.DB == nil {
			out = append(out, ch)
			continue
		}
		var src store.KBSource
		err := store.DB.Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", ch.SourceID, tenantID).
			First(&src).Error
		if err != nil {
			continue
		}
		ch.Visibility = src.Visibility
		ch.RagFileID = src.RagFileID
		out = append(out, ch)
	}
	return out
}
