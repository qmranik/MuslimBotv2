"""AI assistant orchestration — Gemini + ERP context, with optional n8n fallback."""

from __future__ import annotations

import json
from typing import Any

import frappe
import requests

from small_erp.services import gemini_service
from small_erp.utils.company import get_default_company

SYSTEM_PROMPT = """You are the AI Assistant inside Small ERP (liteERP) — a pharmacy and retail operations app.

Your job: answer the store manager's questions using ONLY the live ERP data injected below.

Scope:
- Sales, orders, invoices, customers, inventory/stock, receivables, and monthly finances.
- Pharmacy items (tablets, syrups, OTC) when listed in the data.

Rules:
- Use ONLY numbers and facts from the business data block. Never invent figures.
- Be concise and actionable (2–6 sentences unless they ask for a list).
- Use markdown lists when listing items or customers.
- If data is missing, say what is missing and suggest where in /ops to look (POS, Inventory, Orders, Accounting).
- Do NOT mention Open WebUI, n8n internals, or API keys.
- For store policy / returns / SOP questions: say that information is not in the ERP data and suggest checking company documentation or asking a manager.
- Format money with the currency from the data block.
"""

SUGGESTED_QUESTIONS: dict[str, list[str]] = {
    "general": [
        "How many orders this month?",
        "Summarize today's business performance.",
    ],
    "inventory": [
        "What items are low on stock?",
        "Which cough syrups do we have in stock?",
    ],
    "accounting": [
        "Show me this month's profit and loss.",
        "Who owes us the most money?",
    ],
    "orders": [
        "What are the latest unpaid invoices?",
        "Who are our top customers this month?",
    ],
}


def _generative_ui_url() -> str:
    return (frappe.conf.get("generative_ui_url") or "http://localhost:5173").rstrip("/")


def get_surfaces() -> dict[str, Any]:
    """Where each AI capability lives in the liteERP stack (for /ops/ai UI)."""
    genui = _generative_ui_url()
    return {
        "quick_chat": {"label": "Quick Chat", "path": "/ops/ai", "description": "ERP questions with live Gemini + ERP data"},
        "command_center": {
            "label": "Command Center",
            "url": genui,
            "description": "Natural language dashboards and ERP writes (generative-ui)",
        },
        "pos_voice": {
            "label": "POS Voice Search",
            "path": "/ops/pos",
            "description": "Type or dictate items at the register (e.g. '10 napa')",
        },
    }


def _get_n8n_url() -> str:
    return frappe.conf.get("n8n_url", "http://n8n:5678")


def _n8n_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Frappe-Site": frappe.local.site,
    }


def _n8n_is_reachable() -> bool:
    try:
        response = requests.get(f"{_get_n8n_url()}/healthz", timeout=3)
        return response.status_code == 200
    except Exception:
        return False


def _gather_erp_context(context: str) -> str:
    """Collect read-only ERP snapshots for the LLM prompt."""
    blocks: list[str] = []
    company = get_default_company()
    currency = frappe.defaults.get_global_default("currency") or "USD"
    blocks.append(f"Company: {company}")
    blocks.append(f"Currency: {currency}")
    blocks.append(f"User: {frappe.session.user}")
    blocks.append(f"Context focus: {context}")

    try:
        from small_erp.api.dashboard import get_dashboard_kpis

        blocks.append("Dashboard KPIs:\n" + json.dumps(get_dashboard_kpis(), default=str))
    except Exception:
        pass

    if context in ("inventory", "general"):
        try:
            from small_erp.api.inventory import get_low_stock_items

            blocks.append(
                "Low stock items:\n"
                + json.dumps(get_low_stock_items(limit=15), default=str)
            )
        except Exception:
            pass

    if context in ("accounting", "general"):
        try:
            from small_erp.api.accounting import get_profit_and_loss, get_receivables

            blocks.append(
                "Profit & loss (this month):\n"
                + json.dumps(get_profit_and_loss(period="this_month"), default=str)
            )
            blocks.append(
                "Receivables:\n"
                + json.dumps(get_receivables(page=1, page_size=10), default=str)
            )
        except Exception:
            pass

    if context in ("orders", "general"):
        try:
            from small_erp.api.orders import get_orders

            blocks.append(
                "Recent orders:\n"
                + json.dumps(
                    get_orders(status="", search="", page=1, page_size=10),
                    default=str,
                )
            )
        except Exception:
            pass

    if context in ("general", "orders"):
        try:
            from small_erp.api.customers import get_customers

            blocks.append(
                "Customers (sample):\n"
                + json.dumps(get_customers(search="", page=1, page_size=8), default=str)
            )
        except Exception:
            pass

    return "\n\n".join(blocks)


def _query_gemini(question: str, context: str) -> dict[str, Any]:
    erp_context = _gather_erp_context(context)
    user_prompt = (
        f"Business data:\n{erp_context}\n\n"
        f"User question ({context}):\n{question}"
    )
    answer = gemini_service.generate_text(
        user_prompt=user_prompt,
        system_instruction=SYSTEM_PROMPT,
    )
    return {
        "answer": answer,
        "status": "ok",
        "source": "gemini",
        "model": gemini_service.DEFAULT_MODEL,
    }


def _query_n8n(question: str, context: str) -> dict[str, Any]:
    payload = {
        "question": question,
        "context": context,
        "user": frappe.session.user,
        "roles": frappe.get_roles(frappe.session.user),
        "site": frappe.local.site,
    }
    response = requests.post(
        f"{_get_n8n_url()}/webhook/ai-assistant",
        json=payload,
        headers=_n8n_headers(),
        timeout=30,
    )
    response.raise_for_status()
    result = response.json()
    result["source"] = "n8n"
    return result


def query_assistant(question: str, context: str = "general") -> dict[str, Any]:
    """Answer a natural-language ERP question using Gemini (primary) or n8n (fallback)."""
    question = (question or "").strip()
    if not question:
        return {
            "answer": "Please enter a question.",
            "status": "error",
            "error": "empty_question",
        }

    context = (context or "general").strip().lower()
    if context not in ("general", "inventory", "accounting", "orders"):
        context = "general"

    if gemini_service.is_configured():
        try:
            return _query_gemini(question, context)
        except gemini_service.GeminiNotConfiguredError:
            pass
        except gemini_service.GeminiAPIError as exc:
            frappe.log_error(title="Small ERP AI", message=f"Gemini assistant error: {exc}")
            if not _n8n_is_reachable():
                return {
                    "answer": (
                        "Gemini could not answer right now. "
                        f"Details: {str(exc)[:120]}"
                    ),
                    "status": "error",
                    "error": "gemini_failed",
                    "source": "gemini",
                }
        except Exception as exc:
            frappe.log_error(title="Small ERP AI", message=f"Gemini assistant error: {exc}")

    try:
        return _query_n8n(question, context)
    except requests.exceptions.ConnectionError:
        if gemini_service.is_configured():
            return {
                "answer": "AI workflows are offline and Gemini failed. Please try again shortly.",
                "status": "error",
                "error": "all_providers_unavailable",
            }
        return {
            "answer": (
                "The AI assistant is not configured. Set GEMINI_API_KEY in your environment "
                "or start the n8n AI workflow."
            ),
            "status": "error",
            "error": "not_configured",
        }
    except requests.exceptions.Timeout:
        return {
            "answer": "The request timed out. Try a simpler question.",
            "status": "error",
            "error": "timeout",
        }
    except Exception as exc:
        frappe.log_error(title="Small ERP AI", message=f"AI Assistant Error: {exc}")
        return {
            "answer": "Something went wrong. The error has been logged.",
            "status": "error",
        }


def get_status() -> dict[str, Any]:
    """Connection panel payload for /ops/ai."""
    gemini_configured = gemini_service.is_configured()
    gemini_health = (
        gemini_service.test_connection()
        if gemini_configured
        else {"ok": False, "configured": False}
    )
    n8n_ok = _n8n_is_reachable()

    if gemini_health.get("ok"):
        provider = "gemini"
    elif n8n_ok:
        provider = "n8n"
    else:
        provider = "none"

    return {
        "erp_connected": True,
        "gemini_configured": gemini_configured,
        "gemini_reachable": bool(gemini_health.get("ok")),
        "gemini_model": gemini_health.get("model", gemini_service.DEFAULT_MODEL),
        "gemini_error": gemini_health.get("error"),
        "n8n_reachable": n8n_ok,
        "provider": provider,
        "surfaces": get_surfaces(),
        "suggested_questions": SUGGESTED_QUESTIONS,
    }


def test_webui_url(url: str) -> dict[str, Any]:
    """Server-side ping for Open WebUI (avoids browser CORS)."""
    url = (url or "").strip().rstrip("/")
    if not url:
        return {"ok": False, "error": "URL is required"}
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    try:
        response = requests.get(url, timeout=8, allow_redirects=True)
        return {
            "ok": response.status_code < 500,
            "status_code": response.status_code,
            "url": url,
        }
    except requests.exceptions.RequestException as exc:
        return {"ok": False, "error": str(exc)[:200], "url": url}
