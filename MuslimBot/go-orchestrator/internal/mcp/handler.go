package mcp

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler exposes the MCP host over HTTP so GenUI (and debugging clients) can
// enumerate and invoke tools. The AI agent normally reaches these tools through
// Gemini function-calling in internal/ai; these routes are the direct surface.
type Handler struct {
	mgr *Manager
}

func NewHandler(mgr *Manager) *Handler { return &Handler{mgr: mgr} }

// GetServers → GET /v1/mcp/servers
func (h *Handler) GetServers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	c.JSON(http.StatusOK, gin.H{"servers": h.mgr.Status(ctx)})
}

// GetTools → GET /v1/mcp/tools
func (h *Handler) GetTools(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	tools := h.mgr.ListTools(ctx)
	c.JSON(http.StatusOK, gin.H{"tools": tools, "count": len(tools)})
}

// CallTool → POST /v1/mcp/call  {server, tool, arguments, confirm}
// Confirm-first (GAP-2): a write-classified tool with confirm=false returns 428
// with a needs_confirmation payload; the UI shows a confirmation card and re-calls
// with confirm=true. Reads pass through untouched.
func (h *Handler) CallTool(c *gin.Context) {
	var req struct {
		Server    string                 `json:"server"`
		Tool      string                 `json:"tool"`
		Arguments map[string]interface{} `json:"arguments"`
		Confirm   bool                   `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Server == "" || req.Tool == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "server and tool are required"})
		return
	}
	if h.mgr.IsWrite(req.Server, req.Tool) && !req.Confirm {
		c.JSON(http.StatusPreconditionRequired, gin.H{
			"needs_confirmation": true,
			"server":             req.Server,
			"tool":               req.Tool,
			"arguments":          req.Arguments,
			"summary":            req.Server + " · " + req.Tool,
			"details":            "This MCP tool changes state. Re-call with confirm=true after user approval.",
		})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	defer cancel()

	res, err := h.mgr.CallTool(ctx, req.Server, req.Tool, req.Arguments)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
