package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"

	"muslimbot-orchestrator/internal/config"
)

// ServerConfig declares one MCP server the orchestrator ingests.
type ServerConfig struct {
	Name      string
	Transport string // "http" | "stdio"
	// http
	Endpoint  string
	AuthToken string
	// stdio
	Command []string
	Cwd     string
	Env     []string
}

// ServerStatus is a connection snapshot for the /v1/mcp/servers endpoint.
type ServerStatus struct {
	Name      string `json:"name"`
	Transport string `json:"transport"`
	Connected bool   `json:"connected"`
	ToolCount int    `json:"tool_count"`
	Error     string `json:"error,omitempty"`
}

type serverConn struct {
	cfg    ServerConfig
	mu     sync.Mutex
	tr     transport
	inited bool
	nextID int
	tools  []Tool
}

// Manager is the MCP host. Connections are lazy: a server that is down or
// misconfigured never blocks orchestrator startup — it just yields no tools.
type Manager struct {
	mu      sync.Mutex
	servers map[string]*serverConn
	order   []string
}

// NewManager builds the host from application config. Only enabled, sufficiently
// configured servers are registered.
func NewManager(cfg *config.Config) *Manager {
	m := &Manager{servers: map[string]*serverConn{}}
	for _, sc := range serversFromConfig(cfg) {
		m.order = append(m.order, sc.Name)
		m.servers[sc.Name] = &serverConn{cfg: sc}
	}
	return m
}

func serversFromConfig(cfg *config.Config) []ServerConfig {
	var out []ServerConfig

	// TryPost — HTTP MCP (self-hosted endpoint is <trypost>/mcp/trypost, bearer auth).
	if cfg.TryPostMCPEnabled && cfg.TryPostMCPURL != "" {
		out = append(out, ServerConfig{
			Name:      "trypost",
			Transport: "http",
			Endpoint:  cfg.TryPostMCPURL,
			AuthToken: cfg.TryPostAPIToken,
		})
	}

	// Chatwoot — fazer-ai/mcp-chatwoot over stdio. Reuses Chatwoot creds. The
	// launcher maps CHATWOOT_URL -> CHATWOOT_BASE_URL and runs bun.
	if cfg.ChatwootMCPEnabled && cfg.ChatwootURL != "" && cfg.ChatwootAPIToken != "" {
		out = append(out, ServerConfig{
			Name:      "chatwoot",
			Transport: "stdio",
			Command:   splitCommand(envOr("MCP_CHATWOOT_COMMAND", "bash scripts/mcp/run-chatwoot-mcp.sh")),
			Cwd:       envOr("MCP_CHATWOOT_CWD", "."),
			Env: append(os.Environ(),
				"CHATWOOT_URL="+cfg.ChatwootURL,
				"CHATWOOT_BASE_URL="+cfg.ChatwootURL,
				"CHATWOOT_API_TOKEN="+cfg.ChatwootAPIToken,
			),
		})
	}
	return out
}

// ensure lazily connects and performs the MCP initialize handshake.
func (sc *serverConn) ensure(ctx context.Context) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	if sc.inited {
		return nil
	}

	var (
		tr  transport
		err error
	)
	switch sc.cfg.Transport {
	case "http":
		tr = newHTTPTransport(sc.cfg.Endpoint, sc.cfg.AuthToken)
	case "stdio":
		tr, err = newStdioTransport(ctx, sc.cfg.Command, sc.cfg.Cwd, sc.cfg.Env)
	default:
		return fmt.Errorf("mcp: unknown transport %q", sc.cfg.Transport)
	}
	if err != nil {
		return err
	}

	initParams := map[string]interface{}{
		"protocolVersion": protocolVersion,
		"capabilities":    map[string]interface{}{},
		"clientInfo":      map[string]string{"name": clientName, "version": clientVersion},
	}
	sc.nextID++
	initID := sc.nextID
	if _, err := tr.send(ctx, jsonRPCRequest{JSONRPC: "2.0", ID: &initID, Method: "initialize", Params: initParams}); err != nil {
		_ = tr.close()
		return err
	}
	// notifications/initialized (no id)
	_, _ = tr.send(ctx, jsonRPCRequest{JSONRPC: "2.0", Method: "notifications/initialized"})

	sc.tr = tr
	sc.inited = true
	return nil
}

func (sc *serverConn) call(ctx context.Context, method string, params interface{}) ([]byte, error) {
	sc.mu.Lock()
	sc.nextID++
	id := sc.nextID
	tr := sc.tr
	sc.mu.Unlock()
	res, err := tr.send(ctx, jsonRPCRequest{JSONRPC: "2.0", ID: &id, Method: method, Params: params})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// ListTools aggregates tools across all servers, namespacing each with its server.
func (m *Manager) ListTools(ctx context.Context) []Tool {
	var all []Tool
	for _, name := range m.order {
		sc := m.servers[name]
		if err := sc.ensure(ctx); err != nil {
			continue
		}
		raw, err := sc.call(ctx, "tools/list", map[string]interface{}{})
		if err != nil {
			continue
		}
		var res toolsListResult
		if err := json.Unmarshal(raw, &res); err != nil {
			continue
		}
		sc.mu.Lock()
		sc.tools = res.Tools
		sc.mu.Unlock()
		for _, t := range res.Tools {
			t.Server = name
			all = append(all, t)
		}
	}
	sort.Slice(all, func(i, j int) bool {
		if all[i].Server != all[j].Server {
			return all[i].Server < all[j].Server
		}
		return all[i].Name < all[j].Name
	})
	return all
}

// CallTool invokes tool on server with the given arguments.
func (m *Manager) CallTool(ctx context.Context, server, tool string, args map[string]interface{}) (*ToolResult, error) {
	sc, ok := m.servers[server]
	if !ok {
		return nil, fmt.Errorf("mcp: unknown server %q", server)
	}
	if err := sc.ensure(ctx); err != nil {
		return nil, fmt.Errorf("mcp: connect %q: %w", server, err)
	}
	raw, err := sc.call(ctx, "tools/call", map[string]interface{}{"name": tool, "arguments": args})
	if err != nil {
		return nil, err
	}
	var res ToolResult
	if err := json.Unmarshal(raw, &res); err != nil {
		return nil, fmt.Errorf("mcp: decode tool result: %w", err)
	}
	return &res, nil
}

// Enabled reports whether any MCP server is configured.
func (m *Manager) Enabled() bool { return len(m.order) > 0 }

// Status probes each server (lazy connect) for the /v1/mcp/servers endpoint.
func (m *Manager) Status(ctx context.Context) []ServerStatus {
	out := make([]ServerStatus, 0, len(m.order))
	for _, name := range m.order {
		sc := m.servers[name]
		st := ServerStatus{Name: name, Transport: sc.cfg.Transport}
		if err := sc.ensure(ctx); err != nil {
			st.Error = err.Error()
			out = append(out, st)
			continue
		}
		st.Connected = true
		sc.mu.Lock()
		st.ToolCount = len(sc.tools)
		sc.mu.Unlock()
		out = append(out, st)
	}
	return out
}

func splitCommand(s string) []string { return strings.Fields(s) }

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
