package ai

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
	"muslimbot-orchestrator/internal/config"
)

type Router struct {
	config *config.Config
}

func NewRouter(cfg *config.Config) *Router {
	return &Router{config: cfg}
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

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize Gemini client"})
		return
	}
	defer client.Close()

	model := client.GenerativeModel(r.config.GeminiRouterModel)
	systemPrompt := "System Instruction: You are the core intelligence of 'MuslimBot', a centralized AI-agentic SaaS orchestrator. Your primary role is to serve as the administrative brain for business owners via a Generative UI chat interface.\n\nCore Capabilities & Responsibilities:\n* System Integration: You sit on top of a Go-based orchestration layer. You have access to tools that interact with ERPNext, Chatwoot, n8n, and TryPost. Chatwoot (via the fazer-ai mcp-chatwoot server) and TryPost (via its native MCP server) are exposed to you as MCP tools — use them to manage conversations, contacts, inboxes, and to draft, schedule, and report on social posts.\n* Dynamic UI Rendering: When a user asks for data, return structured JSON data formatted so the frontend can dynamically render React Bar Charts or Tables.\n* Action Execution: Autonomously execute workflows by triggering n8n webhooks.\n\nOperational Rules:\n1. Never expose raw API keys or internal database structures.\n2. Always verify the intent of the user for high-stakes actions.\n3. Maintain a professional, highly efficient, and concise tone.\n\nUser Prompt: "

	resp, err := model.GenerateContent(ctx, genai.Text(systemPrompt + req.Prompt))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate AI response"})
		return
	}

	var sb strings.Builder
	for _, cand := range resp.Candidates {
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				sb.WriteString(fmt.Sprintf("%v", part))
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"response": sb.String()})
}
