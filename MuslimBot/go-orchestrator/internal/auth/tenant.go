package auth

import "strings"

// firstNonEmpty returns the first non-empty string from the arguments.
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// TenantFromHost extracts the tenant slug from a request Host using the
// subdomain-routed model (acme.muslimbot.com → "acme"). It is the multi-tenant
// "traffic cop" from the architecture plan: the Host is the authoritative tenant
// signal, overriding the email→tenant mapping when present.
//
// Rules:
//   - port is stripped
//   - the apex (baseDomain) and www.<baseDomain> → "" (no tenant)
//   - <slug>.<baseDomain> → "slug"
//   - if baseDomain doesn't match but the host has 3+ labels and the first
//     isn't "www"/"api", the first label is used (dev convenience)
//   - anything else → ""
func TenantFromHost(host, baseDomain string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	if i := strings.IndexByte(host, ':'); i >= 0 {
		host = host[:i]
	}
	if host == "" {
		return ""
	}
	baseDomain = strings.ToLower(strings.TrimSpace(baseDomain))

	if baseDomain != "" && strings.HasSuffix(host, "."+baseDomain) {
		prefix := strings.TrimSuffix(host, "."+baseDomain)
		labels := strings.Split(prefix, ".")
		slug := labels[len(labels)-1] // label immediately left of the base domain
		if slug == "www" || slug == "api" || slug == "" {
			return ""
		}
		return slug
	}
	if host == baseDomain {
		return ""
	}

	labels := strings.Split(host, ".")
	first := labels[0]
	if first == "www" || first == "api" {
		return ""
	}
	// Dev convenience: <slug>.localhost (Frappe-style, e.g. acme.localhost).
	if len(labels) == 2 && labels[1] == "localhost" {
		return first
	}
	// Fallback: generic 3+ label host (dev/staging without the exact base).
	if len(labels) >= 3 {
		return first
	}
	return ""
}
