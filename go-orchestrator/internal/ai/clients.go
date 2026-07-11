package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"muslimbot-orchestrator/internal/config"
)

// KBClient calls the Muslimbot KB BFF directly (server-side) for RAG answers
// used by the search_knowledge_base tool.
type KBClient struct {
	base   string
	apiKey string
	http   *http.Client
}

func NewKBClient(cfg *config.Config) *KBClient {
	return &KBClient{
		base:   cfg.KBBffURL,
		apiKey: cfg.KBBffAPIKey,
		http:   &http.Client{Timeout: 25 * time.Second},
	}
}

func (k *KBClient) Chat(ctx context.Context, message, tenant string) (json.RawMessage, error) {
	body, _ := json.Marshal(map[string]any{"message": message})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, k.base+"/chat", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if k.apiKey != "" {
		req.Header.Set("X-KB-API-Key", k.apiKey)
	}
	if tenant != "" {
		req.Header.Set("X-Tenant-Id", tenant)
	}
	res, err := k.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("kb chat → %d", res.StatusCode)
	}
	return raw, nil
}

// N8NClient triggers n8n webhooks for ask_business_ai / trigger_workflow /
// send_notification.
type N8NClient struct {
	webhookURL string
	http       *http.Client
}

func NewN8NClient(cfg *config.Config) *N8NClient {
	return &N8NClient{
		webhookURL: cfg.N8NWebhookURL,
		http:       &http.Client{Timeout: 30 * time.Second},
	}
}

func (n *N8NClient) Trigger(ctx context.Context, tool string, params map[string]any, tenant string) (json.RawMessage, error) {
	if n.webhookURL == "" {
		return nil, fmt.Errorf("n8n webhook not configured")
	}
	payload := map[string]any{"tool": tool, "params": params, "tenant": tenant}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.webhookURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
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
