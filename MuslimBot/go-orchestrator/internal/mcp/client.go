package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// transport is the wire between the orchestrator and one MCP server.
type transport interface {
	// send issues a request and returns its result payload. For notifications
	// (id == nil) it returns immediately with a nil result.
	send(ctx context.Context, req jsonRPCRequest) (json.RawMessage, error)
	close() error
}

// ── HTTP (Streamable HTTP) transport ────────────────────────────────────────

type httpTransport struct {
	endpoint  string
	authToken string
	http      *http.Client
	sessionID string
	mu        sync.Mutex
}

func newHTTPTransport(endpoint, authToken string) *httpTransport {
	return &httpTransport{
		endpoint:  endpoint,
		authToken: authToken,
		http:      &http.Client{Timeout: 30 * time.Second},
	}
}

func (t *httpTransport) send(ctx context.Context, req jsonRPCRequest) (json.RawMessage, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, t.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json, text/event-stream")
	if t.authToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+t.authToken)
	}
	t.mu.Lock()
	sid := t.sessionID
	t.mu.Unlock()
	if sid != "" {
		httpReq.Header.Set("Mcp-Session-Id", sid)
	}

	resp, err := t.http.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if sid := resp.Header.Get("Mcp-Session-Id"); sid != "" {
		t.mu.Lock()
		t.sessionID = sid
		t.mu.Unlock()
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<12))
		return nil, fmt.Errorf("mcp http %d: %s", resp.StatusCode, string(snippet))
	}
	if req.ID == nil { // notification — no response expected
		return nil, nil
	}

	raw, err := readRPCPayload(resp)
	if err != nil {
		return nil, err
	}
	return decodeRPC(raw)
}

func (t *httpTransport) close() error { return nil }

// readRPCPayload returns the JSON-RPC message bytes from either a plain JSON body
// or the first data event of an SSE stream.
func readRPCPayload(resp *http.Response) ([]byte, error) {
	if strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") {
		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data:") {
				return []byte(strings.TrimSpace(strings.TrimPrefix(line, "data:"))), nil
			}
		}
		if err := scanner.Err(); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("mcp sse stream ended with no data event")
	}
	return io.ReadAll(io.LimitReader(resp.Body, 8<<20))
}

// ── stdio transport (subprocess) ────────────────────────────────────────────

type stdioTransport struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	pending map[int]chan jsonRPCResponse
	mu      sync.Mutex
	writeMu sync.Mutex
}

func newStdioTransport(ctx context.Context, command []string, cwd string, env []string) (*stdioTransport, error) {
	if len(command) == 0 {
		return nil, fmt.Errorf("stdio transport: empty command")
	}
	cmd := exec.CommandContext(ctx, command[0], command[1:]...)
	cmd.Dir = cwd
	cmd.Env = env
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	t := &stdioTransport{cmd: cmd, stdin: stdin, pending: make(map[int]chan jsonRPCResponse)}
	go t.readLoop(stdout)
	return t, nil
}

func (t *stdioTransport) readLoop(stdout io.Reader) {
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		var resp jsonRPCResponse
		if err := json.Unmarshal(line, &resp); err != nil || resp.ID == nil {
			continue // notification or noise
		}
		t.mu.Lock()
		ch, ok := t.pending[*resp.ID]
		delete(t.pending, *resp.ID)
		t.mu.Unlock()
		if ok {
			ch <- resp
		}
	}
}

func (t *stdioTransport) send(ctx context.Context, req jsonRPCRequest) (json.RawMessage, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	if req.ID == nil { // notification
		t.writeMu.Lock()
		defer t.writeMu.Unlock()
		_, err := t.stdin.Write(append(body, '\n'))
		return nil, err
	}

	ch := make(chan jsonRPCResponse, 1)
	t.mu.Lock()
	t.pending[*req.ID] = ch
	t.mu.Unlock()

	t.writeMu.Lock()
	_, err = t.stdin.Write(append(body, '\n'))
	t.writeMu.Unlock()
	if err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case resp := <-ch:
		if resp.Error != nil {
			return nil, fmt.Errorf("mcp rpc error %d: %s", resp.Error.Code, resp.Error.Message)
		}
		return resp.Result, nil
	}
}

func (t *stdioTransport) close() error {
	_ = t.stdin.Close()
	if t.cmd.Process != nil {
		_ = t.cmd.Process.Kill()
	}
	return nil
}

// decodeRPC unwraps a JSON-RPC response envelope into its result payload.
func decodeRPC(raw []byte) (json.RawMessage, error) {
	var resp jsonRPCResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("mcp: decode response: %w", err)
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("mcp rpc error %d: %s", resp.Error.Code, resp.Error.Message)
	}
	return resp.Result, nil
}
