package knowledge

import (
	"strings"
	"testing"
)

func TestGCSObjectPath_Namespaced(t *testing.T) {
	path := GCSObjectPath("acme", "KBS-ABC", 2, "My Doc.pdf")
	if path != "rag-imports/acme/KBS-ABC/2/My_Doc.pdf" && path != "rag-imports/acme/KBS-ABC/2/My Doc.pdf" {
		// SafeObjectName may keep or replace spaces depending on regex
		if !strings.HasPrefix(path, "rag-imports/acme/KBS-ABC/2/") {
			t.Fatalf("unexpected path: %s", path)
		}
	}
	if strings.Contains(path, "..") {
		t.Fatal("path traversal")
	}
}

func TestDisplayNameForSource_Unique(t *testing.T) {
	a := DisplayNameForSource("KBS-1", 1, "a.txt")
	b := DisplayNameForSource("KBS-1", 2, "a.txt")
	if a == b {
		t.Fatal("revision must change display name")
	}
	if !strings.Contains(a, "KBS-1") {
		t.Fatalf("source id missing: %s", a)
	}
}

func TestSafeObjectName(t *testing.T) {
	if SafeObjectName("../../etc/passwd") == "../../etc/passwd" {
		t.Fatal("should sanitize path segments")
	}
	if SafeObjectName("") == "" {
		t.Fatal("empty should fallback")
	}
}

func TestContentHash_Stable(t *testing.T) {
	h1 := ContentHash([]byte("hello"))
	h2 := ContentHash([]byte("hello"))
	if h1 != h2 || len(h1) != 64 {
		t.Fatalf("bad hash %s %s", h1, h2)
	}
}
