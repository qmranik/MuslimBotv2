package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
	"muslimbot-orchestrator/internal/config"
)

// Brain is the single server-side MuslimBot intelligence: it produces the
// structured UiDescriptor consumed by web + mobile (one brain, one schema —
// MUSLIMBOT_PRODUCTION_PLAN W2.1) and executes catalog tools via the Executor.
type Brain struct {
	cfg      *config.Config
	frappe   *FrappeClient
	executor *Executor
}

func NewBrain(cfg *config.Config) *Brain {
	frappe := NewFrappeClient(cfg)
	kb := NewKBClient(cfg)
	n8n := NewN8NClient(cfg)
	return &Brain{
		cfg:      cfg,
		frappe:   frappe,
		executor: NewExecutor(frappe, kb, n8n),
	}
}

type generateUIRequest struct {
	Prompt      string              `json:"prompt"`
	History     []map[string]string `json:"history"`
	Surface     string              `json:"surface"`      // web | mobile | voice
	PersonaMode string              `json:"persona_mode"` // full | support_and_ordering
}

// GenerateUIHandler: POST /v1/ai/generate-ui → UiDescriptor JSON.
func (b *Brain) GenerateUIHandler(c *gin.Context) {
	var req generateUIRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prompt required"})
		return
	}

	tenant, _ := c.Get("tenant_id")
	tenantID, _ := tenant.(string)
	user, _ := c.Get("user_email")
	userEmail, _ := user.(string)

	// No key configured → degrade gracefully to a text descriptor.
	if b.cfg.GeminiAPIKey == "" || b.cfg.GeminiAPIKey == "mock-key" {
		c.JSON(http.StatusOK, textDescriptor(
			"MuslimBot AI is not configured on this server (set GEMINI_API_KEY). "+
				"Try the ERP desk or a specific tool."))
		return
	}

	// Fetch the live ERP snapshot for grounding (best-effort).
	snapshot := "{}"
	if raw, err := b.frappe.CallMethod(c, "small_erp.api.genui.get_erp_snapshot",
		map[string]any{"page_size": 100}, tenantID, userEmail); err == nil {
		snapshot = string(raw)
	}

	descriptor, err := b.generate(c, req, snapshot)
	if err != nil {
		c.JSON(http.StatusOK, textDescriptor("MuslimBot could not process that right now."))
		return
	}
	c.Data(http.StatusOK, "application/json", descriptor)
}

func (b *Brain) generate(ctx context.Context, req generateUIRequest, snapshot string) ([]byte, error) {
	client, err := genai.NewClient(ctx, option.WithAPIKey(b.cfg.GeminiAPIKey))
	if err != nil {
		return nil, err
	}
	defer client.Close()

	model := client.GenerativeModel(b.cfg.GeminiRouterModel)

	// This pinned genai version has no ResponseMIMEType/SystemInstruction, so
	// the system prompt is folded into the content and JSON is enforced via the
	// instructions + defensive fence-stripping (same approach as router.go).
	var sb strings.Builder
	sb.WriteString(systemPrompt(req.PersonaMode, snapshot))
	sb.WriteString("\n\nConversation so far:\n")
	for _, h := range req.History {
		if sb.Len() > 14000 {
			break
		}
		sb.WriteString(fmt.Sprintf("%s: %s\n", h["sender"], h["text"]))
	}
	sb.WriteString("\nUser request: " + req.Prompt)

	resp, err := model.GenerateContent(ctx, genai.Text(sb.String()))
	if err != nil {
		return nil, err
	}
	var out strings.Builder
	for _, cand := range resp.Candidates {
		if cand.Content == nil {
			continue
		}
		for _, part := range cand.Content.Parts {
			if t, ok := part.(genai.Text); ok {
				out.WriteString(string(t))
			}
		}
	}
	text := stripFences(strings.TrimSpace(out.String()))
	if text == "" {
		return nil, fmt.Errorf("empty response")
	}
	// Validate it is JSON; fall back to wrapping as text otherwise.
	if !json.Valid([]byte(text)) {
		return textDescriptor(text), nil
	}
	return []byte(text), nil
}

// stripFences removes ```json … ``` markdown wrappers the model may add.
func stripFences(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		if i := strings.IndexByte(s, '\n'); i >= 0 {
			s = s[i+1:]
		}
		s = strings.TrimSuffix(strings.TrimSpace(s), "```")
	}
	return strings.TrimSpace(s)
}

type toolExecuteRequest struct {
	Tool    string         `json:"tool"`
	Params  map[string]any `json:"params"`
	Confirm bool           `json:"confirm"`
}

// ToolExecuteHandler: POST /v1/ai/tool/execute → runs a catalog tool.
// Write tools require confirm=true (the client presents a confirmation card).
func (b *Brain) ToolExecuteHandler(c *gin.Context) {
	var req toolExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Tool == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tool required"})
		return
	}
	spec, ok := Catalog[req.Tool]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown tool"})
		return
	}
	if spec.Kind == ToolWrite && !req.Confirm {
		c.JSON(http.StatusPreconditionRequired, gin.H{
			"error": "write tool requires confirm=true",
			"tool":  req.Tool,
			"kind":  "write",
		})
		return
	}

	tenant, _ := c.Get("tenant_id")
	tenantID, _ := tenant.(string)
	user, _ := c.Get("user_email")
	userEmail, _ := user.(string)

	result := b.executor.Execute(c, req.Tool, req.Params, tenantID, userEmail)
	status := http.StatusOK
	if !result.OK {
		status = http.StatusBadGateway
	}
	c.JSON(status, result)
}

func textDescriptor(msg string) []byte {
	b, _ := json.Marshal(map[string]any{
		"component":   "text",
		"explanation": msg,
		"_dataSource": "live",
	})
	return b
}

func systemPrompt(personaMode, snapshot string) string {
	scope := "Scope: full operator access. Offer any read tool; confirm before any write."
	if personaMode == "support_and_ordering" {
		scope = "Scope: CUSTOMER support & self-service only — knowledge answers, product " +
			"availability, the customer's own orders, and support tickets. No back-office data."
	}
	return fmt.Sprintf(`You are MuslimBot, a highly efficient enterprise assistant for a Frappe/ERPNext business system.
Analyze the user's request and the ERP data below, then return EXACTLY ONE JSON object (no markdown) describing the UI to render.

%s

Use the local currency symbol ₹ for amounts. Always confirm write operations.

LIVE ERP DATA (JSON):
%s

Return one JSON object with this schema:
{
  "component": "metrics|chart|table|card|action|flow|navigate|open_doc|rag|text",
  "title": "string",
  "chartType": "bar|line|area|pie",
  "columns": [{"key":"string","label":"string"}],
  "data": [ ... ],
  "metrics": [{"label":"string","value":"string","change":"string","trend":"up|down|neutral"}],
  "cardDetails": {"title":"string","subtitle":"string","details":[{"label":"string","value":"string"}]},
  "actionType": "create_order|submit_order|record_payment|create_customer|create_item|add_stock|trigger_workflow|send_notification|create_event",
  "actionParams": { ... },
  "missingFields": ["string"],
  "target": "erp-ops route for navigate",
  "url": "full url for navigate",
  "docType": "Frappe DocType for open_doc",
  "explanation": "concise summary"
}

Rules:
- Data/analytics → metrics|chart|table|card computed from the ERP JSON.
- Write intent → component "action" with actionType + actionParams; list any missing required params in missingFields.
- "Open/go to X" → component "navigate" (target/url) to drive the embedded ERP desk.
- "Create/edit a <DocType>" that is not a first-class tool → component "open_doc" with docType + prefill in actionParams.
- Knowledge/policy/FAQ → component "rag".
- Greetings/other → component "text".
Never invent component types. Never return markdown.`, scope, truncateStr(snapshot, 12000))
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
