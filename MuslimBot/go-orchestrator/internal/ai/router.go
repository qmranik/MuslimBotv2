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
	"muslimbot-orchestrator/internal/mcp"
)

const routerSystemPrompt = "You are the core intelligence of 'MuslimBot', a centralized AI-agentic SaaS orchestrator and administrative brain for business owners, spoken to via a Generative UI chat interface.\n\n" +
	"Capabilities:\n" +
	"* You sit on a Go orchestration layer with tools for ERPNext, Chatwoot, n8n, and TryPost.\n" +
	"* Chatwoot (fazer-ai/mcp-chatwoot, 129 tools) and TryPost (native MCP) are exposed as MCP tools. Use `mcp_list_tools` to discover exact tool names/arguments, then `mcp_call` to execute — for managing conversations, contacts, inboxes, teams, reports, and for drafting/scheduling/reporting on social posts.\n" +
	"* When a user asks for data, return structured JSON the frontend can render as React charts or tables.\n\n" +
	"Rules:\n1. Never expose raw API keys or internal database structures.\n2. Always confirm intent before high-stakes or destructive actions (deleting, publishing, mass updates).\n3. Only act within the current tenant's scope.\n4. Be professional, efficient, and concise."

const maxToolTurns = 6

type Router struct {
	config *config.Config
	mcp    *mcp.Manager
}

func NewRouter(cfg *config.Config, mgr *mcp.Manager) *Router {
	return &Router{config: cfg, mcp: mgr}
}

func (r *Router) ChatHandler(c *gin.Context) {
	var req struct {
		Prompt string `json:"prompt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	apiKey := r.config.GeminiAPIKey
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "GEMINI_API_KEY not configured"})
		return
	}
	if apiKey == "mock-key" {
		c.JSON(http.StatusOK, gin.H{"response": "- Manage inventory\n- Automate billing\n- Generate reports"})
		return
	}

	ctx := c.Request.Context()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize Gemini client"})
		return
	}
	defer client.Close()

	model := client.GenerativeModel(r.config.GeminiRouterModel)

	toolsEnabled := r.mcp != nil && r.mcp.Enabled()
	if toolsEnabled {
		model.Tools = []*genai.Tool{{FunctionDeclarations: mcpFunctionDeclarations()}}
	}

	cs := model.StartChat()
	resp, err := cs.SendMessage(ctx, genai.Text(routerSystemPrompt+"\n\nUser Prompt: "+req.Prompt))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate AI response"})
		return
	}

	// Function-calling loop: execute MCP tools the model requests, feed results back.
	for turn := 0; toolsEnabled && turn < maxToolTurns; turn++ {
		calls := functionCalls(resp)
		if len(calls) == 0 {
			break
		}
		var responses []genai.Part
		for _, fc := range calls {
			responses = append(responses, genai.FunctionResponse{
				Name:     fc.Name,
				Response: r.executeTool(ctx, fc),
			})
		}
		resp, err = cs.SendMessage(ctx, responses...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed during tool execution"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"response": collectText(resp)})
}

// executeTool runs one function call against the MCP manager and returns a
// Gemini-compatible response map.
func (r *Router) executeTool(ctx context.Context, fc genai.FunctionCall) map[string]any {
	switch fc.Name {
	case "mcp_list_tools":
		tools := r.mcp.ListTools(ctx)
		summary := make([]map[string]string, 0, len(tools))
		for _, t := range tools {
			summary = append(summary, map[string]string{"server": t.Server, "tool": t.Name, "description": t.Description})
		}
		return map[string]any{"tools": summary}

	case "mcp_call":
		server, _ := fc.Args["server"].(string)
		tool, _ := fc.Args["tool"].(string)
		if server == "" || tool == "" {
			return map[string]any{"error": "server and tool are required"}
		}
		args := map[string]interface{}{}
		if raw, ok := fc.Args["arguments_json"].(string); ok && strings.TrimSpace(raw) != "" {
			if err := json.Unmarshal([]byte(raw), &args); err != nil {
				return map[string]any{"error": fmt.Sprintf("arguments_json is not valid JSON: %v", err)}
			}
		}
		res, err := r.mcp.CallTool(ctx, server, tool, args)
		if err != nil {
			return map[string]any{"error": err.Error()}
		}
		var sb strings.Builder
		for _, b := range res.Content {
			sb.WriteString(b.Text)
		}
		return map[string]any{"is_error": res.IsError, "result": sb.String()}

	default:
		return map[string]any{"error": "unknown tool: " + fc.Name}
	}
}

func mcpFunctionDeclarations() []*genai.FunctionDeclaration {
	return []*genai.FunctionDeclaration{
		{
			Name:        "mcp_list_tools",
			Description: "List the available MCP tools across connected servers (chatwoot, trypost) with their exact names and descriptions. Call this before mcp_call when unsure of a tool name.",
			Parameters:  &genai.Schema{Type: genai.TypeObject, Properties: map[string]*genai.Schema{}},
		},
		{
			Name:        "mcp_call",
			Description: "Invoke a specific MCP tool on a connected server (e.g. server='chatwoot', tool='list_conversations'). Use for managing Chatwoot state and TryPost social scheduling/analytics.",
			Parameters: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"server":         {Type: genai.TypeString, Description: "MCP server name: 'chatwoot' or 'trypost'."},
					"tool":           {Type: genai.TypeString, Description: "Exact tool name as returned by mcp_list_tools."},
					"arguments_json": {Type: genai.TypeString, Description: "JSON object string of the tool's arguments, e.g. '{\"account_id\":1}'. Empty object if none."},
				},
				Required: []string{"server", "tool"},
			},
		},
	}
}

func functionCalls(resp *genai.GenerateContentResponse) []genai.FunctionCall {
	var calls []genai.FunctionCall
	if resp == nil {
		return calls
	}
	for _, cand := range resp.Candidates {
		if cand.Content == nil {
			continue
		}
		for _, part := range cand.Content.Parts {
			if fc, ok := part.(genai.FunctionCall); ok {
				calls = append(calls, fc)
			}
		}
	}
	return calls
}

func collectText(resp *genai.GenerateContentResponse) string {
	var sb strings.Builder
	if resp == nil {
		return ""
	}
	for _, cand := range resp.Candidates {
		if cand.Content == nil {
			continue
		}
		for _, part := range cand.Content.Parts {
			if txt, ok := part.(genai.Text); ok {
				sb.WriteString(string(txt))
			}
		}
	}
	return sb.String()
}
