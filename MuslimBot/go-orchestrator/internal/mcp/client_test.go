package mcp

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeMCPServer implements just enough of the MCP HTTP transport for the client:
// initialize, notifications/initialized, tools/list, tools/call.
func fakeMCPServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
			t.Errorf("missing/incorrect bearer auth: %q", got)
		}
		body, _ := io.ReadAll(r.Body)
		var req jsonRPCRequest
		_ = json.Unmarshal(body, &req)

		w.Header().Set("Content-Type", "application/json")
		if req.ID == nil { // notification
			w.WriteHeader(http.StatusAccepted)
			return
		}
		reply := func(result interface{}) {
			raw, _ := json.Marshal(result)
			_ = json.NewEncoder(w).Encode(jsonRPCResponse{JSONRPC: "2.0", ID: req.ID, Result: raw})
		}
		switch req.Method {
		case "initialize":
			reply(map[string]interface{}{"protocolVersion": protocolVersion, "capabilities": map[string]interface{}{}})
		case "tools/list":
			reply(toolsListResult{Tools: []Tool{{Name: "ping", Description: "returns pong"}}})
		case "tools/call":
			p, _ := req.Params.(map[string]interface{})
			args, _ := p["arguments"].(map[string]interface{})
			reply(ToolResult{Content: []ContentBlock{{Type: "text", Text: "pong:" + argString(args, "msg")}}})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func argString(m map[string]interface{}, k string) string {
	if v, ok := m[k].(string); ok {
		return v
	}
	return ""
}

func testManager(endpoint string) *Manager {
	return &Manager{
		servers: map[string]*serverConn{
			"test": {cfg: ServerConfig{Name: "test", Transport: "http", Endpoint: endpoint, AuthToken: "test-token"}},
		},
		order: []string{"test"},
	}
}

func TestHTTPListTools(t *testing.T) {
	srv := fakeMCPServer(t)
	defer srv.Close()
	m := testManager(srv.URL)

	tools := m.ListTools(context.Background())
	if len(tools) != 1 || tools[0].Name != "ping" || tools[0].Server != "test" {
		t.Fatalf("unexpected tools: %+v", tools)
	}
}

func TestHTTPCallTool(t *testing.T) {
	srv := fakeMCPServer(t)
	defer srv.Close()
	m := testManager(srv.URL)

	res, err := m.CallTool(context.Background(), "test", "ping", map[string]interface{}{"msg": "hi"})
	if err != nil {
		t.Fatalf("CallTool error: %v", err)
	}
	if len(res.Content) != 1 || res.Content[0].Text != "pong:hi" {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestUnknownServer(t *testing.T) {
	m := testManager("http://unused")
	if _, err := m.CallTool(context.Background(), "nope", "ping", nil); err == nil {
		t.Fatal("expected error for unknown server")
	}
}
