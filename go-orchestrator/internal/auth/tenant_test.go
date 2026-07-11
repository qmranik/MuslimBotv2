package auth

import "testing"

func TestTenantFromHost(t *testing.T) {
	base := "muslimbot.com"
	cases := []struct {
		host, want string
	}{
		{"acme.muslimbot.com", "acme"},
		{"acme.muslimbot.com:443", "acme"},
		{"ACME.muslimbot.com", "acme"},
		{"muslimbot.com", ""},              // apex
		{"www.muslimbot.com", ""},          // www
		{"api.muslimbot.com", ""},          // reserved api host
		{"acme.smb.muslimbot.com", "smb"},  // label left of base wins
		{"acme.localhost", "acme"},         // dev 3-label fallback (base mismatch)
		{"localhost", ""},                  // single label
		{"", ""},                           // empty
	}
	for _, c := range cases {
		if got := TenantFromHost(c.host, base); got != c.want {
			t.Errorf("TenantFromHost(%q) = %q, want %q", c.host, got, c.want)
		}
	}
}

func TestFirstNonEmpty(t *testing.T) {
	if got := firstNonEmpty("", "", "x", "y"); got != "x" {
		t.Fatalf("got %q", got)
	}
	if got := firstNonEmpty("", ""); got != "" {
		t.Fatalf("expected empty, got %q", got)
	}
}
