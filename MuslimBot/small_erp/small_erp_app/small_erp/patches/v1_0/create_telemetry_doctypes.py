"""Create the telemetry & audit DocTypes (readiness N1).

Backs the omnichannel / voice / generative / security payloads described in the
system blueprint so the Go orchestrator, n8n and generative-ui have a durable
System-of-Record to write to and Frappe Dashboard Charts to read from.

Idempotent: safe to re-run. DocTypes are created as `custom` so they sync per
tenant site on `bench migrate` without requiring developer mode in production.
"""

from __future__ import annotations

import frappe

MODULE = "Small ERP"

# Roles granted access. System Manager always; SMB Manager for operational
# visibility. Security Audit is intentionally narrower (see PERMISSIONS below).
_OPS_PERMISSIONS = [
    {"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1},
    {"role": "SMB Manager", "read": 1, "write": 1, "create": 1, "report": 1},
]
_AUDIT_PERMISSIONS = [
    # Audit rows are written by the platform (orchestrator/n8n authenticate with
    # a System Manager-scoped API token) and read by managers. Regular managers
    # are read-only so they cannot fabricate or edit audit entries. No `write`
    # for anyone — audit rows are append-only.
    {"role": "System Manager", "read": 1, "create": 1, "delete": 1, "report": 1, "export": 1},
    {"role": "SMB Manager", "read": 1, "report": 1},
]

DOCTYPES = [
    {
        "name": "Omnichannel Interaction",
        "autoname": "hash",
        "title_field": "contact_name",
        "permissions": _OPS_PERMISSIONS,
        "fields": [
            {"fieldname": "source_platform", "label": "Source Platform", "fieldtype": "Select",
             "options": "chatwoot\nwhatsapp\nemail\nsms\nlivechat", "in_list_view": 1, "in_standard_filter": 1, "reqd": 1},
            {"fieldname": "external_id", "label": "External ID", "fieldtype": "Data",
             "unique": 1, "in_list_view": 1, "description": "Dedup key (e.g. Chatwoot conversation id)"},
            {"fieldname": "customer", "label": "Customer", "fieldtype": "Link", "options": "Customer", "in_list_view": 1},
            {"fieldname": "contact_name", "label": "Contact Name", "fieldtype": "Data"},
            {"fieldname": "phone", "label": "Phone", "fieldtype": "Data"},
            {"fieldname": "message_content", "label": "Message Content", "fieldtype": "Text"},
            {"fieldname": "extracted_intent", "label": "Extracted Intent", "fieldtype": "Data", "in_standard_filter": 1,
             "description": "Populated by the Go gateway (e.g. order_status)"},
            {"fieldname": "urgency_flag", "label": "Urgency Flag", "fieldtype": "Check"},
            {"fieldname": "status", "label": "Status", "fieldtype": "Select",
             "options": "Open\nPending\nResolved", "default": "Open", "in_list_view": 1, "in_standard_filter": 1},
            {"fieldname": "interaction_time", "label": "Timestamp", "fieldtype": "Datetime", "in_list_view": 1},
            {"fieldname": "tenant", "label": "Tenant", "fieldtype": "Data", "in_standard_filter": 1},
            {"fieldname": "raw_payload", "label": "Raw Payload", "fieldtype": "Code", "options": "JSON"},
        ],
    },
    {
        "name": "Voice Telemetry Log",
        "autoname": "field:call_sid",
        "permissions": _OPS_PERMISSIONS,
        "fields": [
            {"fieldname": "call_sid", "label": "Call SID", "fieldtype": "Data",
             "unique": 1, "reqd": 1, "in_list_view": 1, "description": "Twilio/LiveKit unique call id"},
            {"fieldname": "direction", "label": "Direction", "fieldtype": "Select",
             "options": "Inbound\nOutbound", "in_list_view": 1, "in_standard_filter": 1},
            {"fieldname": "customer", "label": "Customer", "fieldtype": "Link", "options": "Customer"},
            {"fieldname": "duration_seconds", "label": "Duration (s)", "fieldtype": "Int", "in_list_view": 1},
            {"fieldname": "transcript_summary", "label": "Transcript Summary", "fieldtype": "Text"},
            {"fieldname": "primary_intent", "label": "Primary Intent", "fieldtype": "Data", "in_standard_filter": 1},
            {"fieldname": "sentiment_score", "label": "Sentiment Score", "fieldtype": "Float",
             "precision": "2", "in_list_view": 1, "description": "-1.0 (angry) .. 1.0 (happy)"},
            {"fieldname": "requires_escalation", "label": "Requires Escalation", "fieldtype": "Check",
             "in_list_view": 1, "in_standard_filter": 1},
            {"fieldname": "recording_url", "label": "Recording URL", "fieldtype": "Data"},
            {"fieldname": "tenant", "label": "Tenant", "fieldtype": "Data", "in_standard_filter": 1},
        ],
    },
    {
        "name": "Generative Action State",
        "autoname": "hash",
        "title_field": "requested_action",
        "permissions": _OPS_PERMISSIONS,
        "fields": [
            {"fieldname": "requested_action", "label": "Requested Action", "fieldtype": "Data",
             "reqd": 1, "in_list_view": 1, "description": "e.g. reassign_logistics_driver"},
            {"fieldname": "status", "label": "Status", "fieldtype": "Select",
             "options": "Pending\nExecuting\nCompleted\nFailed", "default": "Pending",
             "in_list_view": 1, "in_standard_filter": 1},
            {"fieldname": "originating_prompt", "label": "Originating Prompt", "fieldtype": "Text"},
            {"fieldname": "action_payload", "label": "Action Payload", "fieldtype": "Code", "options": "JSON"},
            {"fieldname": "result", "label": "Result", "fieldtype": "Text"},
            {"fieldname": "requested_by", "label": "Requested By", "fieldtype": "Data"},
            {"fieldname": "tenant", "label": "Tenant", "fieldtype": "Data", "in_standard_filter": 1},
        ],
    },
    {
        "name": "Security Audit",
        "autoname": "hash",
        "permissions": _AUDIT_PERMISSIONS,
        "fields": [
            {"fieldname": "event_type", "label": "Event Type", "fieldtype": "Select",
             "options": "UNAUTHORIZED_ACCESS\nRATE_LIMITED\nFORGED_HEADER\nTENANT_MISMATCH\nOTHER",
             "in_list_view": 1, "in_standard_filter": 1, "reqd": 1},
            {"fieldname": "path", "label": "Path", "fieldtype": "Data", "in_list_view": 1},
            {"fieldname": "ip_address", "label": "IP Address", "fieldtype": "Data", "in_list_view": 1, "in_standard_filter": 1},
            {"fieldname": "user_id", "label": "User", "fieldtype": "Data", "in_standard_filter": 1},
            {"fieldname": "user_agent", "label": "User Agent", "fieldtype": "Small Text"},
            {"fieldname": "event_time", "label": "Event Time", "fieldtype": "Datetime", "in_list_view": 1},
            {"fieldname": "attempt_count", "label": "Attempts", "fieldtype": "Int"},
            {"fieldname": "tenant", "label": "Tenant", "fieldtype": "Data", "in_standard_filter": 1},
        ],
    },
]


def _build_field_order(fields: list[dict]) -> list[str]:
    return [f["fieldname"] for f in fields]


def execute() -> None:
    for spec in DOCTYPES:
        name = spec["name"]
        if frappe.db.exists("DocType", name):
            continue

        doc = frappe.get_doc(
            {
                "doctype": "DocType",
                "name": name,
                "module": MODULE,
                "custom": 1,
                "naming_rule": "Random" if spec.get("autoname") == "hash" else "By fieldname",
                "autoname": spec.get("autoname", "hash"),
                "title_field": spec.get("title_field"),
                "track_changes": 1,
                "sort_field": "modified",
                "sort_order": "DESC",
                "field_order": _build_field_order(spec["fields"]),
                "fields": spec["fields"],
                "permissions": spec["permissions"],
            }
        )
        doc.insert(ignore_permissions=True)

    frappe.db.commit()
