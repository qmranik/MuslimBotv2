package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ToolKind classifies a MuslimBot tool as read (instant) or write (confirm).
type ToolKind string

const (
	ToolRead  ToolKind = "read"
	ToolWrite ToolKind = "write"
)

// ToolSpec is one entry in the canonical 21-tool catalog, aligned with
// Muslimbot-voice-agent/agent.py and erp-flutter tool_catalog.dart. `Route`
// selects how the executor fulfils it. This is the single server-side registry
// so voice, web and mobile share one audit trail (MUSLIMBOT_PRODUCTION_PLAN W2.2).
type ToolSpec struct {
	Name   string
	Kind   ToolKind
	Route  toolRoute
	Method string // Frappe method for routeFrappe
}

type toolRoute int

const (
	routeFrappe toolRoute = iota // call a small_erp.api.* method
	routeKB                      // knowledge base RAG (KB BFF /chat)
	routeN8N                     // n8n webhook (workflows, notifications, business AI)
	routeLocal                   // synthesized locally (system_status)
	routeUnsupported             // needs a surface not available here (calendar, desk submit)
)

// Catalog is the canonical registry keyed by tool name.
var Catalog = map[string]ToolSpec{
	// ── Reads ────────────────────────────────────────────────────────────
	"search_items":          {"search_items", ToolRead, routeFrappe, "small_erp.api.pos.search_pos_items"},
	"check_stock":           {"check_stock", ToolRead, routeFrappe, "small_erp.api.inventory.get_items"},
	"sales_summary":         {"sales_summary", ToolRead, routeFrappe, "small_erp.api.dashboard.get_dashboard_kpis"},
	"get_recent_orders":     {"get_recent_orders", ToolRead, routeFrappe, "small_erp.api.orders.get_orders"},
	"search_customer":       {"search_customer", ToolRead, routeFrappe, "small_erp.api.customers.search_customers"},
	"customer_history":      {"customer_history", ToolRead, routeFrappe, "small_erp.api.customers.get_customer_detail"},
	"get_receivables":       {"get_receivables", ToolRead, routeFrappe, "small_erp.api.accounting.get_receivables"},
	"low_stock_alerts":      {"low_stock_alerts", ToolRead, routeFrappe, "small_erp.api.inventory.get_low_stock_items"},
	"ask_business_ai":       {"ask_business_ai", ToolRead, routeN8N, ""},
	"list_events":           {"list_events", ToolRead, routeUnsupported, ""},
	"system_status":         {"system_status", ToolRead, routeLocal, ""},
	"search_knowledge_base": {"search_knowledge_base", ToolRead, routeKB, ""},

	// ── Writes (confirmed by the client before execution) ────────────────
	"create_order":      {"create_order", ToolWrite, routeFrappe, "small_erp.api.orders.create_sales_invoice"},
	"submit_order":      {"submit_order", ToolWrite, routeUnsupported, ""},
	"record_payment":    {"record_payment", ToolWrite, routeFrappe, "small_erp.api.orders.record_payment"},
	"create_customer":   {"create_customer", ToolWrite, routeFrappe, "small_erp.api.customers.create_customer"},
	"create_item":       {"create_item", ToolWrite, routeFrappe, "small_erp.api.inventory.create_item"},
	"add_stock":         {"add_stock", ToolWrite, routeFrappe, "small_erp.api.inventory.create_stock_entry"},
	"trigger_workflow":  {"trigger_workflow", ToolWrite, routeN8N, ""},
	"send_notification": {"send_notification", ToolWrite, routeN8N, ""},
	"create_event":      {"create_event", ToolWrite, routeUnsupported, ""},
}

// mapArgs adapts the catalog's canonical parameter names to the exact argument
// names each small_erp endpoint expects (ground-truth: generative-ui erpClient.js).
func mapArgs(tool string, in map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range in {
		out[k] = v
	}
	switch tool {
	case "search_items":
		return pick(in, map[string]string{"query": "query", "limit": "limit"})
	case "check_stock":
		return map[string]any{"search": str(in["item_name"]), "page_size": 5}
	case "get_recent_orders":
		return map[string]any{"status": str(in["status"]), "customer": str(in["customer"]), "page_size": intOr(in["limit"], 5)}
	case "search_customer":
		return map[string]any{"query": str(in["query"])}
	case "customer_history":
		return map[string]any{"customer_name": str(in["customer_name"])}
	case "get_receivables":
		return map[string]any{"page": 1}
	case "low_stock_alerts":
		return map[string]any{"limit": intOr(in["limit"], 20)}
	case "create_order":
		return map[string]any{"customer": str(in["customer"]), "items_json": jsonStr(in["items"])}
	case "record_payment":
		return map[string]any{"invoice_name": str(in["invoice_name"]), "amount": in["amount"], "mode_of_payment": strOr(in["mode_of_payment"], "Cash")}
	case "create_customer":
		return map[string]any{"customer_name": str(in["customer_name"]), "mobile_no": str(in["mobile_no"]), "customer_group": strOr(in["customer_group"], "Individual")}
	case "create_item":
		return map[string]any{"item_name": str(in["item_name"]), "standard_rate": in["rate"], "item_group": strOr(in["item_group"], "Products"), "stock_uom": strOr(in["stock_uom"], "Nos")}
	case "add_stock":
		items := []map[string]any{{"item_code": str(in["item_code"]), "qty": in["qty"]}}
		return map[string]any{"entry_type": "Material Receipt", "items_json": jsonStr(items), "target_warehouse": strOr(in["warehouse"], "Stores - LDI")}
	}
	return out
}

// Executor runs catalog tools server-side against the appropriate backend.
type Executor struct {
	frappe *FrappeClient
	kb     *KBClient
	n8n    *N8NClient
}

func NewExecutor(f *FrappeClient, kb *KBClient, n8n *N8NClient) *Executor {
	return &Executor{frappe: f, kb: kb, n8n: n8n}
}

// ToolResult is the normalized envelope returned to any surface.
type ToolResult struct {
	Tool   string          `json:"tool"`
	OK     bool            `json:"ok"`
	Data   json.RawMessage `json:"data,omitempty"`
	Error  string          `json:"error,omitempty"`
	Tenant string          `json:"tenant"`
}

func (e *Executor) Execute(ctx context.Context, tool string, params map[string]any, tenant, actingUser string) ToolResult {
	spec, ok := Catalog[tool]
	if !ok {
		return ToolResult{Tool: tool, OK: false, Error: "unknown tool", Tenant: tenant}
	}
	res := ToolResult{Tool: tool, Tenant: tenant}

	switch spec.Route {
	case routeFrappe:
		data, err := e.frappe.CallMethod(ctx, spec.Method, mapArgs(tool, params), tenant, actingUser)
		if err != nil {
			res.Error = err.Error()
			return res
		}
		res.OK = true
		res.Data = data
	case routeKB:
		data, err := e.kb.Chat(ctx, str(params["query"]), tenant)
		if err != nil {
			res.Error = err.Error()
			return res
		}
		res.OK = true
		res.Data = data
	case routeN8N:
		data, err := e.n8n.Trigger(ctx, tool, params, tenant)
		if err != nil {
			res.Error = err.Error()
			return res
		}
		res.OK = true
		res.Data = data
	case routeLocal:
		payload, _ := json.Marshal(map[string]any{
			"time":     time.Now().Format(time.RFC3339),
			"tenant":   tenant,
			"orchestrator": "online",
		})
		res.OK = true
		res.Data = payload
	default:
		res.Error = fmt.Sprintf("tool %q is not available on this surface", tool)
	}
	return res
}

// ── small helpers ────────────────────────────────────────────────────────
func pick(in map[string]any, keys map[string]string) map[string]any {
	out := map[string]any{}
	for src, dst := range keys {
		if v, ok := in[src]; ok {
			out[dst] = v
		}
	}
	return out
}

func str(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func strOr(v any, fallback string) string {
	s := str(v)
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return s
}

func intOr(v any, fallback int) int {
	switch n := v.(type) {
	case int:
		return n
	case float64:
		return int(n)
	}
	return fallback
}

func jsonStr(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}
