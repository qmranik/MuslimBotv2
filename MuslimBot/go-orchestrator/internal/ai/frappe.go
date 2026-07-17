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

// FrappeClient is a minimal server-side client for calling whitelisted
// small_erp API methods with the masked master token. It is used by the AI
// tool executor and the generate-ui snapshot fetch so credentials never leave
// the backend (MUSLIMBOT_PRODUCTION_PLAN W2.2).
type FrappeClient struct {
	base   string
	host   string
	token  string
	secret string
	http   *http.Client
}

func NewFrappeClient(cfg *config.Config) *FrappeClient {
	return &FrappeClient{
		base:   cfg.FrappeURL,
		host:   cfg.FrappeSiteHost,
		token:  cfg.FrappeToken,
		secret: cfg.FrappeSecret,
		http:   &http.Client{Timeout: 20 * time.Second},
	}
}

// CallMethod invokes POST /api/method/<method> and returns the unwrapped
// `message` payload (Frappe wraps whitelisted method results in {"message": …}).
// `tenant` and `actingUser` are forwarded so Frappe-side hooks can scope access.
func (f *FrappeClient) CallMethod(
	ctx context.Context,
	method string,
	args map[string]any,
	tenant string,
	actingUser string,
) (json.RawMessage, error) {
	body, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/api/method/%s", f.base, method)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Host = f.host
	req.Header.Set("Host", f.host)
	if f.token != "" {
		req.Header.Set("Authorization", "token "+f.token+":"+f.secret)
	}
	if tenant != "" {
		req.Header.Set("X-Tenant-Id", tenant)
	}
	if actingUser != "" {
		req.Header.Set("X-Frappe-User", actingUser)
	}

	res, err := f.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("frappe %s → %d: %s", method, res.StatusCode, truncate(raw, 300))
	}

	var envelope struct {
		Message json.RawMessage `json:"message"`
	}
	if err := json.Unmarshal(raw, &envelope); err == nil && len(envelope.Message) > 0 {
		return envelope.Message, nil
	}
	return raw, nil
}

func truncate(b []byte, n int) string {
	if len(b) <= n {
		return string(b)
	}
	return string(b[:n])
}
