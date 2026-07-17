package ai

import (
	"context"
	"encoding/json"
	"testing"
)

func TestCatalogParity(t *testing.T) {
	if len(Catalog) != 21 {
		t.Fatalf("expected 21 tools, got %d", len(Catalog))
	}
	var reads, writes int
	for _, s := range Catalog {
		switch s.Kind {
		case ToolRead:
			reads++
		case ToolWrite:
			writes++
		}
	}
	if reads != 12 || writes != 9 {
		t.Fatalf("expected 12 read / 9 write, got %d/%d", reads, writes)
	}
}

func TestMapArgsAddStock(t *testing.T) {
	out := mapArgs("add_stock", map[string]any{"item_code": "ITM001", "qty": 10})
	if out["entry_type"] != "Material Receipt" {
		t.Fatalf("entry_type = %v", out["entry_type"])
	}
	if out["target_warehouse"] != "Stores - LDI" {
		t.Fatalf("default warehouse not applied: %v", out["target_warehouse"])
	}
	var items []map[string]any
	if err := json.Unmarshal([]byte(out["items_json"].(string)), &items); err != nil {
		t.Fatalf("items_json not valid JSON: %v", err)
	}
	if items[0]["item_code"] != "ITM001" {
		t.Fatalf("item_code not mapped: %v", items[0])
	}
}

func TestMapArgsRecordPaymentDefaults(t *testing.T) {
	out := mapArgs("record_payment", map[string]any{"invoice_name": "INV-1", "amount": 500})
	if out["mode_of_payment"] != "Cash" {
		t.Fatalf("expected default mode Cash, got %v", out["mode_of_payment"])
	}
}

func TestExecuteUnknownTool(t *testing.T) {
	e := NewExecutor(nil, nil, nil)
	res := e.Execute(context.Background(), "does_not_exist", nil, "default", "u@x")
	if res.OK || res.Error == "" {
		t.Fatalf("expected failure for unknown tool, got %+v", res)
	}
}

func TestExecuteSystemStatusLocal(t *testing.T) {
	e := NewExecutor(nil, nil, nil)
	res := e.Execute(context.Background(), "system_status", nil, "acme", "u@x")
	if !res.OK {
		t.Fatalf("system_status should succeed locally: %+v", res)
	}
	if res.Tenant != "acme" {
		t.Fatalf("tenant not propagated: %v", res.Tenant)
	}
}
