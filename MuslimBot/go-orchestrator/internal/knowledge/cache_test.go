package knowledge

import "testing"

func TestCacheKeys(t *testing.T) {
	if GenerationKey("acme") != "kb:generation:acme" {
		t.Fatal(GenerationKey("acme"))
	}
	k := VoiceBriefKey("acme", "staff", 42)
	if k != "kb:voice-brief:acme:staff:42" {
		t.Fatal(k)
	}
	r1 := RetrieveCacheKey("acme", "staff", 1, "hello")
	r2 := RetrieveCacheKey("acme", "staff", 1, "hello")
	r3 := RetrieveCacheKey("acme", "staff", 2, "hello")
	if r1 != r2 {
		t.Fatal("same query should hash equal")
	}
	if r1 == r3 {
		t.Fatal("generation must change key")
	}
}
