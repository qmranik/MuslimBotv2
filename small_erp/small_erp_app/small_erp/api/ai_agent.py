"""
AI Agent API — bridges the HTMX frontend to Gemini and n8n AI workflows.
Handles natural language queries about business data, AI-powered search,
and customer support chat routing.
"""
import frappe
import requests
import json

from small_erp.services import ai_assistant_service, ai_voice_service


def _get_n8n_url():
    """Get n8n base URL from site config or env."""
    return frappe.conf.get("n8n_url", "http://n8n:5678")


def _get_n8n_headers():
    """Auth headers for n8n webhook calls."""
    return {
        "Content-Type": "application/json",
        "X-Frappe-Site": frappe.local.site,
    }


@frappe.whitelist()
def query_assistant(question, context="general"):
    """
    Send a natural language question to Gemini (primary) or n8n (fallback).
    context: general | inventory | accounting | orders
    Returns structured + natural language response.
    """
    frappe.has_permission("Sales Invoice", throw=True)
    return ai_assistant_service.query_assistant(question=question, context=context)


@frappe.whitelist()
def get_assistant_status():
    """Return Gemini / n8n connectivity for the /ops/ai status panel."""
    frappe.has_permission("Sales Invoice", throw=True)
    return ai_assistant_service.get_status()


@frappe.whitelist()
def get_assistant_surfaces():
    """Map of AI surfaces in liteERP (Quick Chat, generative-ui, POS voice)."""
    frappe.has_permission("Sales Invoice", throw=True)
    return ai_assistant_service.get_surfaces()


@frappe.whitelist()
def test_webui_url(url):
    """Server-side Open WebUI reachability check (avoids browser CORS)."""
    frappe.has_permission("Sales Invoice", throw=True)
    return ai_assistant_service.test_webui_url(url)


@frappe.whitelist()
def chat_message(message, session_id=""):
    """
    Customer support chat — routes to n8n chatbot workflow.
    Maintains session context via session_id.
    """
    frappe.has_permission("Sales Invoice", throw=True)

    payload = {
        "message": message,
        "session_id": session_id or frappe.generate_hash(length=12),
        "user": frappe.session.user,
        "timestamp": frappe.utils.now(),
        "site": frappe.local.site,
        "company": frappe.defaults.get_user_default("Company"),
    }

    try:
        n8n_url = _get_n8n_url()
        resp = requests.post(
            f"{n8n_url}/webhook/chat-support",
            json=payload,
            headers=_get_n8n_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        result["session_id"] = payload["session_id"]
        return result
    except Exception as e:
        frappe.log_error(f"Chat Error: {str(e)}", "Small ERP Chat")
        return {
            "reply": "I'm having trouble connecting right now. Please try again.",
            "session_id": payload["session_id"],
            "status": "error",
        }


@frappe.whitelist()
def smart_search(query, doctype=""):
    """
    AI-enhanced search across ERPNext data.
    Falls back to standard Frappe search if n8n is unavailable.
    """
    frappe.has_permission("Sales Invoice", throw=True)

    # First try n8n AI search
    try:
        n8n_url = _get_n8n_url()
        resp = requests.post(
            f"{n8n_url}/webhook/smart-search",
            json={"query": query, "doctype": doctype, "user": frappe.session.user},
            headers=_get_n8n_headers(),
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass

    # Fallback: standard Frappe search across common doctypes
    results = []
    search_doctypes = ["Item", "Customer", "Sales Invoice", "Sales Order", "Supplier"]

    if doctype and doctype in search_doctypes:
        search_doctypes = [doctype]

    for dt in search_doctypes:
        try:
            found = frappe.get_all(dt,
                or_filters={"name": ["like", f"%{query}%"]},
                fields=["name"],
                limit_page_length=5,
            )
            for r in found:
                results.append({
                    "doctype": dt,
                    "name": r.name,
                    "label": r.name,
                })
        except Exception:
            continue

    return {"results": results, "source": "local_search"}


@frappe.whitelist()
def process_voice_query(voice_query):
    """POS voice/text → Gemini item extraction + live stock/pricing."""
    frappe.has_permission("Sales Invoice", throw=True)
    return ai_voice_service.process_voice_query(voice_query=voice_query)
