package ratelimit

import "testing"

func TestLimiter_BurstThenReject(t *testing.T) {
	// 60/min == 1/sec sustained, burst 3. First 3 pass, 4th (same instant) fails.
	l := New(60, 3)
	for i := 0; i < 3; i++ {
		if !l.Allow("tenant:a") {
			t.Fatalf("request %d within burst should pass", i+1)
		}
	}
	if l.Allow("tenant:a") {
		t.Fatal("4th request should be rejected (burst exhausted)")
	}
	// A different key has its own bucket.
	if !l.Allow("tenant:b") {
		t.Fatal("independent key should pass")
	}
}

func TestLimiter_DisabledWhenZero(t *testing.T) {
	l := New(0, 0)
	if l.Enabled() {
		t.Fatal("perMinute=0 must disable the limiter")
	}
	for i := 0; i < 1000; i++ {
		if !l.Allow("x") {
			t.Fatal("disabled limiter must always allow")
		}
	}
}
