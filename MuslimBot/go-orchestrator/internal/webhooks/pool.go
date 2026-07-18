package webhooks

import (
	"context"
	"runtime"
	"sync"
)

// job is a single webhook forward queued for asynchronous delivery.
type job struct {
	target string
	tenant string
	source string
	body   []byte
}

// Pool is a fixed-size worker pool fronted by a bounded channel. It absorbs
// webhook bursts without spawning an unbounded number of goroutines (the
// anti-pattern the ingestion blueprint warns against): the HTTP handler enqueues
// and returns 202 immediately; when the buffer is full Submit fails so the
// handler can reply 503 and let the caller (Twilio/Chatwoot) use its own retry
// backoff. On shutdown the buffer is drained so no accepted job is dropped.
type Pool struct {
	jobs    chan job
	wg      sync.WaitGroup
	forward func(target, tenant, source string, body []byte)
	closed  chan struct{}
	once    sync.Once
}

// NewPool starts `workers` goroutines draining a buffer of `size`. size<=0
// defaults to 10000; workers<=0 defaults to NumCPU*4.
func NewPool(size, workers int, forward func(target, tenant, source string, body []byte)) *Pool {
	if size <= 0 {
		size = 10000
	}
	if workers <= 0 {
		workers = runtime.NumCPU() * 4
	}
	p := &Pool{
		jobs:    make(chan job, size),
		forward: forward,
		closed:  make(chan struct{}),
	}
	for i := 0; i < workers; i++ {
		p.wg.Add(1)
		go p.worker()
	}
	return p
}

func (p *Pool) worker() {
	defer p.wg.Done()
	for j := range p.jobs {
		p.forward(j.target, j.tenant, j.source, j.body)
	}
}

// Submit enqueues a job without blocking. It returns false when the buffer is
// full (backpressure) or the pool is shutting down.
func (p *Pool) Submit(j job) bool {
	select {
	case <-p.closed:
		return false
	default:
	}
	select {
	case p.jobs <- j:
		return true
	default:
		return false
	}
}

// Shutdown stops accepting new jobs and waits for the buffer to drain or ctx to
// expire. Safe to call more than once.
func (p *Pool) Shutdown(ctx context.Context) error {
	p.once.Do(func() {
		close(p.closed)
		close(p.jobs)
	})
	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
