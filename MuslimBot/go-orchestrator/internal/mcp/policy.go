package mcp

import "strings"

// Write classification for MCP tools (GAP-2). MCP servers (Chatwoot, TryPost)
// expose many tools with no machine-readable read/write flag, so a state-changing
// call could otherwise fire with no confirmation. A tool is classified WRITE when:
//   1. its "server:tool" or bare "tool" name matches a configured MCP_WRITE_TOOLS
//      glob (explicit override), OR
//   2. its name starts with a conservative state-changing verb.
// Unknown verbs default to READ so legitimate reads are never gated.

var defaultWriteVerbs = []string{
	"create", "update", "delete", "remove", "publish", "schedule",
	"send", "assign", "post", "add", "set", "toggle", "resolve",
	"close", "reopen", "merge", "import", "edit", "cancel", "archive",
	"unassign", "label", "mute",
}

// IsWrite reports whether server:tool should be treated as a state-changing write.
func (m *Manager) IsWrite(server, tool string) bool {
	key := strings.ToLower(server + ":" + tool)
	name := strings.ToLower(strings.TrimSpace(tool))
	for _, g := range m.writeGlobs {
		if matchGlob(g, key) || matchGlob(g, name) {
			return true
		}
	}
	for _, v := range defaultWriteVerbs {
		if name == v || strings.HasPrefix(name, v+"_") {
			return true
		}
	}
	return false
}

// matchGlob supports leading/trailing '*' wildcards (e.g. "trypost:*",
// "*publish*", "assign_*"). Case-insensitive; pattern is pre-lowered by callers
// for the glob list but we lower defensively here too.
func matchGlob(pattern, s string) bool {
	pattern = strings.ToLower(strings.TrimSpace(pattern))
	s = strings.ToLower(s)
	if pattern == "" {
		return false
	}
	if pattern == "*" {
		return true
	}
	hasPre := strings.HasPrefix(pattern, "*")
	hasSuf := strings.HasSuffix(pattern, "*")
	core := strings.Trim(pattern, "*")
	switch {
	case hasPre && hasSuf:
		return strings.Contains(s, core)
	case hasPre:
		return strings.HasSuffix(s, core)
	case hasSuf:
		return strings.HasPrefix(s, core)
	default:
		return s == core
	}
}
