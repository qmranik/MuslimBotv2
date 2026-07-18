package mcp

import (
	"context"
	"testing"
	"time"
)

func mgrWith(cfg ServerConfig) *Manager {
	return &Manager{
		servers: map[string]*serverConn{cfg.Name: {cfg: cfg}},
		order:   []string{cfg.Name},
	}
}

// A stdio server whose process exits immediately must fail the call fast, not
// hang until the context deadline (regression: the old code blocked ~deadline).
func TestStdioProcessExitFailsFast(t *testing.T) {
	m := mgrWith(ServerConfig{Name: "s", Transport: "stdio", Command: []string{"sh", "-c", "exit 0"}})
	start := time.Now()
	_, err := m.CallTool(context.Background(), "s", "x", nil)
	if err == nil {
		t.Fatal("expected error from an immediately-exiting stdio server")
	}
	if d := time.Since(start); d > 3*time.Second {
		t.Fatalf("expected fast failure, took %v", d)
	}
}

// A stdio server that never responds must be bounded by the caller's context,
// and must not leave a dangling connection or subprocess behind.
func TestStdioNoResponseBounded(t *testing.T) {
	m := mgrWith(ServerConfig{Name: "s", Transport: "stdio", Command: []string{"sh", "-c", "sleep 30"}})
	ctx, cancel := context.WithTimeout(context.Background(), 400*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := m.CallTool(ctx, "s", "x", nil)
	if err == nil {
		t.Fatal("expected timeout error from a non-responsive stdio server")
	}
	if d := time.Since(start); d > 3*time.Second {
		t.Fatalf("expected bounded (~400ms) failure, took %v", d)
	}
	// ensure() closed the failed transport, so no connection is cached.
	sc := m.servers["s"]
	sc.mu.Lock()
	inited, tr := sc.inited, sc.tr
	sc.mu.Unlock()
	if inited || tr != nil {
		t.Fatal("failed connect should not be cached")
	}
}

// Status must fan out concurrently: a dead HTTP server and a dead stdio server
// together return within one probe window, not the sum of two.
func TestStatusConcurrentBounded(t *testing.T) {
	m := &Manager{
		servers: map[string]*serverConn{
			"http":  {cfg: ServerConfig{Name: "http", Transport: "http", Endpoint: "http://127.0.0.1:1/mcp"}},
			"stdio": {cfg: ServerConfig{Name: "stdio", Transport: "stdio", Command: []string{"sh", "-c", "sleep 30"}}},
		},
		order: []string{"http", "stdio"},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	start := time.Now()
	st := m.Status(ctx)
	if len(st) != 2 {
		t.Fatalf("expected 2 statuses, got %d", len(st))
	}
	for _, s := range st {
		if s.Connected || s.Error == "" {
			t.Fatalf("expected %s to report an error, got %+v", s.Name, s)
		}
	}
	if d := time.Since(start); d > 3*time.Second {
		t.Fatalf("expected concurrent bounded probe, took %v", d)
	}
}
