"""Telemetry & audit API (readiness N1).

Thin whitelisted endpoints for the omnichannel / voice / generative / security
System-of-Record. All business logic lives in
`small_erp.services.telemetry_service`. These are called by n8n and the Go
orchestrator (via Frappe API token) and by generative-ui.
"""

from __future__ import annotations

import frappe

from small_erp.services import telemetry_service


def _payload() -> dict:
    """Return the JSON request body as a dict (Frappe passes form_dict)."""
    data = frappe.local.form_dict
    if data.get("data") and isinstance(data.get("data"), dict):
        return data["data"]
    # Strip Frappe's control keys.
    return {k: v for k, v in data.items() if k not in ("cmd",)}


@frappe.whitelist()
def ingest_omnichannel():
    """POST small_erp.api.telemetry.ingest_omnichannel — upsert an interaction."""
    frappe.has_permission("Omnichannel Interaction", "create", throw=True)
    name = telemetry_service.record_omnichannel_interaction(_payload())
    return {"ok": True, "name": name}


@frappe.whitelist()
def ingest_voice():
    """POST small_erp.api.telemetry.ingest_voice — upsert a voice telemetry log."""
    frappe.has_permission("Voice Telemetry Log", "create", throw=True)
    name = telemetry_service.record_voice_telemetry(_payload())
    return {"ok": True, "name": name}


@frappe.whitelist()
def create_generative_action():
    """POST — create a Generative Action State row from a GenUI button click."""
    frappe.has_permission("Generative Action State", "create", throw=True)
    name = telemetry_service.create_generative_action(_payload())
    return {"ok": True, "name": name}


@frappe.whitelist()
def update_generative_action(name: str, status: str, result: str | None = None):
    """POST — advance a Generative Action State's status."""
    frappe.has_permission("Generative Action State", "write", throw=True)
    telemetry_service.update_generative_action(name, status, result)
    return {"ok": True, "name": name}


@frappe.whitelist()
def record_security_event():
    """POST — persist a Security Audit row (orchestrator/n8n watchdog sink)."""
    frappe.has_permission("Security Audit", "create", throw=True)
    name = telemetry_service.record_security_event(_payload())
    return {"ok": True, "name": name}
