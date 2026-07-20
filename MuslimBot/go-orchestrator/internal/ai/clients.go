package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"muslimbot-orchestrator/internal/config"
	"muslimbot-orchestrator/internal/knowledge"
)

type KBClient struct {
	cfg *config.Config
}

func NewKBClient(cfg *config.Config) *KBClient {
	return &KBClient{cfg: cfg}
}

func VertexConfigured(cfg *config.Config) bool {
	return knowledge.VertexConfigured(cfg)
}

func (k *KBClient) Chat(ctx context.Context, message, tenant string) (json.RawMessage, error) {
	if !VertexConfigured(k.cfg) {
		return nil, fmt.Errorf("Vertex AI RAG configurations not set (GCP_PROJECT_ID, GCP_LOCATION, GCP_RAG_CORPUS_ID_V2)")
	}
	query := strings.TrimSpace(message)
	if query == "" {
		return nil, fmt.Errorf("query required")
	}
	tenant = strings.TrimSpace(tenant)
	if tenant == "" {
		return nil, fmt.Errorf("tenant required for filtered retrieve")
	}
	// Tool executor runs as staff-equivalent within the request tenant.
	access := knowledge.PolicyStaff(tenant)
	result, err := knowledge.RetrieveFiltered(ctx, k.cfg, access, query, 8)
	if err != nil {
		return nil, err
	}
	var texts []string
	for _, ch := range result.Chunks {
		if t := strings.TrimSpace(ch.Text); t != "" {
			texts = append(texts, t)
		}
	}
	reply := strings.Join(texts, "\n\n---\n\n")
	if reply == "" {
		reply = "No knowledge contexts found for that query."
	}
	return json.Marshal(map[string]any{
		"reply":         reply,
		"chunks":        result.Chunks,
		"chunks_used":   result.ChunksUsed,
		"tenant":        tenant,
		"kb_generation": result.KBGeneration,
		"engine":        "vertex_rag",
	})
}

type N8NClient struct {
	webhookURL string
	baseURL    string
	http       *http.Client
}

func NewN8NClient(cfg *config.Config) *N8NClient {
	return &N8NClient{
		webhookURL: cfg.N8NWebhookURL,
		baseURL:    cfg.N8NBaseURL,
		http:       &http.Client{Timeout: 30 * time.Second},
	}
}

func (n *N8NClient) Trigger(ctx context.Context, tool string, params map[string]any, tenant string) (json.RawMessage, error) {
	target := n.webhookURL
	if target == "" && n.baseURL != "" {
		target = strings.TrimRight(n.baseURL, "/") + "/webhook/" + tool
	}
	if target == "" {
		return nil, fmt.Errorf("n8n webhook not configured")
	}
	payload := map[string]any{"tool": tool, "params": params, "tenant": tenant}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if tenant != "" {
		req.Header.Set("X-Tenant-Id", tenant)
	}
	res, err := n.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("n8n webhook → %d", res.StatusCode)
	}
	if len(raw) == 0 {
		return json.RawMessage(`{"status":"triggered"}`), nil
	}
	return raw, nil
}
