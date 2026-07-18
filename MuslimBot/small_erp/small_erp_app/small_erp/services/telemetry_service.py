"""Telemetry & audit service (readiness N1).

Business logic for persisting the omnichannel / voice / generative / security
records described in the system blueprint. Callers (whitelisted API routes, doc
event hooks, the Go orchestrator, n8n) delegate here — routes stay thin.

All upserts are idempotent on the record's natural key where one exists
(external_id, call_sid) so duplicate webhooks/retries do not create duplicates.
"""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe.utils import now_datetime


def _coerce_payload(payload: Any) -> str | None:
    """Serialise a dict/list payload to a JSON string for a Code(JSON) field."""
    if payload is None:
        return None
    if isinstance(payload, str):
        return payload
    try:
        return json.dumps(payload, default=str)
    except (TypeError, ValueError):
        return str(payload)


def record_omnichannel_interaction(data: dict) -> str:
    """Upsert an Omnichannel Interaction keyed by external_id (when provided)."""
    external_id = (data.get("external_id") or "").strip()
    values = {
        "source_platform": data.get("source_platform"),
        "external_id": external_id or None,
        "customer": data.get("customer"),
        "contact_name": data.get("contact_name") or (data.get("customer_identity") or {}).get("name"),
        "phone": data.get("phone") or (data.get("customer_identity") or {}).get("phone"),
        "message_content": data.get("message_content"),
        "extracted_intent": data.get("extracted_intent"),
        "urgency_flag": 1 if data.get("urgency_flag") else 0,
        "status": data.get("status") or "Open",
        "interaction_time": data.get("timestamp") or now_datetime(),
        "tenant": data.get("tenant"),
        "raw_payload": _coerce_payload(data.get("raw_payload") or data),
    }

    if external_id:
        existing = frappe.db.get_value("Omnichannel Interaction", {"external_id": external_id}, "name")
        if existing:
            doc = frappe.get_doc("Omnichannel Interaction", existing)
            doc.update(values)
            doc.save(ignore_permissions=True)
            frappe.db.commit()
            return doc.name

    doc = frappe.get_doc({"doctype": "Omnichannel Interaction", **values})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


def record_voice_telemetry(data: dict) -> str:
    """Upsert a Voice Telemetry Log keyed by call_sid (required)."""
    call_sid = (data.get("call_sid") or "").strip()
    if not call_sid:
        frappe.throw("call_sid is required for voice telemetry")

    analysis = data.get("ai_analysis") or {}
    values = {
        "direction": (data.get("direction") or "Inbound").title(),
        "customer": data.get("customer"),
        "duration_seconds": data.get("duration_seconds"),
        "transcript_summary": data.get("transcript_summary") or analysis.get("transcript_summary"),
        "primary_intent": data.get("primary_intent") or analysis.get("primary_intent"),
        "sentiment_score": data.get("sentiment_score", analysis.get("sentiment_score")),
        "requires_escalation": 1 if (data.get("requires_human_escalation") or analysis.get("requires_human_escalation")) else 0,
        "recording_url": data.get("recording_link") or data.get("recording_url"),
        "tenant": data.get("tenant"),
    }

    if frappe.db.exists("Voice Telemetry Log", call_sid):
        doc = frappe.get_doc("Voice Telemetry Log", call_sid)
        doc.update(values)
        doc.save(ignore_permissions=True)
    else:
        doc = frappe.get_doc({"doctype": "Voice Telemetry Log", "call_sid": call_sid, **values})
        doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


def create_generative_action(data: dict) -> str:
    """Create a Generative Action State row (Pending by default)."""
    doc = frappe.get_doc(
        {
            "doctype": "Generative Action State",
            "requested_action": data.get("requested_action"),
            "status": data.get("status") or "Pending",
            "originating_prompt": data.get("originating_prompt"),
            "action_payload": _coerce_payload(data.get("action_payload")),
            "requested_by": data.get("requested_by") or frappe.session.user,
            "tenant": data.get("tenant"),
        }
    )
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


def update_generative_action(name: str, status: str, result: str | None = None) -> None:
    """Advance a Generative Action State (Pending→Executing→Completed/Failed)."""
    doc = frappe.get_doc("Generative Action State", name)
    doc.status = status
    if result is not None:
        doc.result = result
    doc.save(ignore_permissions=True)
    frappe.db.commit()


def record_security_event(data: dict) -> str:
    """Persist a Security Audit row (fed by the orchestrator/n8n watchdog)."""
    doc = frappe.get_doc(
        {
            "doctype": "Security Audit",
            "event_type": data.get("event_type") or "OTHER",
            "path": data.get("path"),
            "ip_address": data.get("ip") or data.get("ip_address"),
            "user_id": data.get("user_id") or data.get("userId"),
            "user_agent": data.get("user_agent") or data.get("userAgent"),
            "event_time": data.get("timestamp") or now_datetime(),
            "attempt_count": data.get("count") or data.get("attempt_count") or 1,
            "tenant": data.get("tenant"),
        }
    )
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name
