package webhooks

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestPool_ProcessesJobs(t *testing.T) {
	var n int32
	done := make(chan struct{}, 3)
	p := NewPool(10, 2, func(target, tenant, source string, body []byte) {
		atomic.AddInt32(&n, 1)
		done <- struct{}{}
	})
	for i := 0; i < 3; i++ {
		if !p.Submit(job{source: "t"}) {
			t.Fatalf("submit %d should succeed", i)
		}
	}
	for i := 0; i < 3; i++ {
		select {
		case <-done:
		case <-time.After(time.Second):
			t.Fatal("job not processed in time")
		}
	}
	if got := atomic.LoadInt32(&n); got != 3 {
		t.Fatalf("processed = %d, want 3", got)
	}
}

func TestPool_BackpressureWhenFull(t *testing.T) {
	// One worker blocked on a barrier; buffer size 1 → 3rd submit must fail.
	release := make(chan struct{})
	p := NewPool(1, 1, func(target, tenant, source string, body []byte) {
		<-release
	})
	// First job is picked up by the worker (which then blocks).
	if !p.Submit(job{source: "a"}) {
		t.Fatal("first submit should succeed")
	}
	time.Sleep(20 * time.Millisecond) // let the worker grab job a and block
	// Buffer (size 1) can hold exactly one more.
	if !p.Submit(job{source: "b"}) {
		t.Fatal("second submit should fill the buffer")
	}
	if p.Submit(job{source: "c"}) {
		t.Fatal("third submit should be rejected (backpressure)")
	}
	close(release)
}

func TestPool_ShutdownDrains(t *testing.T) {
	var processed int32
	p := NewPool(100, 4, func(target, tenant, source string, body []byte) {
		time.Sleep(5 * time.Millisecond)
		atomic.AddInt32(&processed, 1)
	})
	const total = 20
	for i := 0; i < total; i++ {
		p.Submit(job{source: "x"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := p.Shutdown(ctx); err != nil {
		t.Fatalf("shutdown drain failed: %v", err)
	}
	if got := atomic.LoadInt32(&processed); got != total {
		t.Fatalf("drained %d, want %d", got, total)
	}
	// Submitting after shutdown must fail, not panic.
	if p.Submit(job{source: "y"}) {
		t.Fatal("submit after shutdown should return false")
	}
}
