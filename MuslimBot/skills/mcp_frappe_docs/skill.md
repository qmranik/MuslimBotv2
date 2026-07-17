# Skill: mcp_frappe_docs

## Description
This skill provides guidelines for fetching Frappe framework documentation and context dynamically via the `frappe-docs-mcp` server. 

## Context
When an agent is building new tools in the `small_erp` module or bridging a new Frappe App (like Helpdesk or HRMS) into the Master Controller, it may lack the exact ORM syntax or Python API signature. The MCP server bridges this knowledge gap.

## Available MCP Resources

### 1. `read_frappe_orm_docs`
- **Purpose:** Returns context on how to query the Frappe Database safely.
- **Usage:** Call this when writing new `.py` services that need to fetch, filter, or aggregate DocTypes using `frappe.get_all()` or `frappe.db.sql()`.

### 2. `read_doctype_schema`
- **Purpose:** Inspects the JSON schema of a specific DocType in the current system.
- **Arguments:** `doctype_name` (e.g., "Sales Invoice", "Leave Application").
- **Usage:** Call this *before* writing an AI Tool wrapper. You must know exactly what fields a DocType expects (and which are mandatory) before allowing the AI to call it.

## Best Practices
- **Do not guess:** Frappe has strict controller logic. If unsure how to escalate a ticket, use this MCP server to read the `Helpdesk Ticket` schema first.
- **Scope Limit:** This MCP server only reads metadata; it does not read business data (use the standard API for that).