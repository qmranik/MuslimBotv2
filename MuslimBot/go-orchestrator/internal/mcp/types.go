// Package mcp is a minimal Model Context Protocol (MCP) host: the orchestrator
// connects to one or more MCP servers (HTTP or stdio), discovers their tools, and
// republishes them so the GenUI AI can invoke them agentically. See
// docs/architecture/ADR-0001.
package mcp

import "encoding/json"

const (
	protocolVersion = "2025-06-18"
	clientName      = "muslimbot-orchestrator"
	clientVersion   = "0.1.0"
)

// jsonRPCRequest is a JSON-RPC 2.0 request/notification. ID is nil for notifications.
type jsonRPCRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      *int        `json:"id,omitempty"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

// jsonRPCResponse is a JSON-RPC 2.0 response.
type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      *int            `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// Tool is an MCP tool as advertised by tools/list.
type Tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema,omitempty"`
	// Server is the namespace (registry name) the tool belongs to. Set by the manager.
	Server string `json:"server"`
}

type toolsListResult struct {
	Tools []Tool `json:"tools"`
}

// ToolResult is the normalized result of a tools/call.
type ToolResult struct {
	Content []ContentBlock `json:"content"`
	IsError bool           `json:"isError"`
}

type ContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type initializeResult struct {
	ProtocolVersion string          `json:"protocolVersion"`
	Capabilities    json.RawMessage `json:"capabilities"`
	ServerInfo      struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"serverInfo"`
}
