"""ERPNext HTTP client — shared by voice worker and KB BFF."""

from __future__ import annotations

import json
import logging
from typing import Any

import aiohttp

from services.config import ERPNEXT_API_KEY, ERPNEXT_API_SECRET, ERPNEXT_URL, ERP_TIMEOUT_SEC, N8N_URL

logger = logging.getLogger("muslimbot.erp")

_http_session: aiohttp.ClientSession | None = None


def _auth_headers() -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if ERPNEXT_API_KEY and ERPNEXT_API_SECRET:
        headers["Authorization"] = f"token {ERPNEXT_API_KEY}:{ERPNEXT_API_SECRET}"
    return headers


def _timeout() -> aiohttp.ClientTimeout:
    return aiohttp.ClientTimeout(total=ERP_TIMEOUT_SEC)


async def get_http_session() -> aiohttp.ClientSession:
    global _http_session
    if _http_session is None or _http_session.closed:
        _http_session = aiohttp.ClientSession(timeout=_timeout())
    return _http_session


async def close_http_session() -> None:
    global _http_session
    if _http_session and not _http_session.closed:
        await _http_session.close()
    _http_session = None


def _error_result(code: str, message: str) -> dict[str, Any]:
    return {"ok": False, "error": message, "code": code}


async def erp_call(method: str, args: dict | None = None, http_method: str = "GET") -> dict | list | Any:
    """Call a Frappe/ERPNext API method."""
    url = f"{ERPNEXT_URL}/api/method/{method}"
    headers = _auth_headers()

    try:
        session = await get_http_session()
        if http_method == "GET":
            async with session.get(url, params=args or {}, headers=headers) as resp:
                data = await resp.json()
                if resp.status >= 400:
                    return _error_result("erp_http_error", str(data)[:500])
                return data.get("message", data)
        async with session.post(url, json=args or {}, headers=headers) as resp:
            data = await resp.json()
            if resp.status >= 400:
                return _error_result("erp_http_error", str(data)[:500])
            return data.get("message", data)
    except Exception as exc:
        logger.error("ERPNext API error (%s): %s", method, exc)
        return _error_result("erp_unreachable", str(exc))


async def erp_get_list(
    doctype: str,
    filters: dict | None = None,
    fields: list | None = None,
    limit: int = 10,
) -> list:
    """Get a list of documents from ERPNext."""
    url = f"{ERPNEXT_URL}/api/resource/{doctype}"
    params: dict[str, Any] = {"limit_page_length": limit, "order_by": "modified desc"}
    if filters:
        params["filters"] = json.dumps(filters)
    if fields:
        params["fields"] = json.dumps(fields)

    headers: dict[str, str] = {}
    if ERPNEXT_API_KEY and ERPNEXT_API_SECRET:
        headers["Authorization"] = f"token {ERPNEXT_API_KEY}:{ERPNEXT_API_SECRET}"

    try:
        session = await get_http_session()
        async with session.get(url, params=params, headers=headers) as resp:
            data = await resp.json()
            if resp.status >= 400:
                return []
            return data.get("data", [])
    except Exception as exc:
        logger.error("ERPNext list error (%s): %s", doctype, exc)
        return []


async def erp_create_doc(doctype: str, doc: dict) -> dict:
    """Create a document in ERPNext via REST API."""
    url = f"{ERPNEXT_URL}/api/resource/{doctype}"
    headers = _auth_headers()

    try:
        session = await get_http_session()
        async with session.post(url, json=doc, headers=headers) as resp:
            data = await resp.json()
            if resp.status in (200, 201):
                return data.get("data", data)
            return _error_result("erp_create_failed", str(data.get("exc_type", data))[:500])
    except Exception as exc:
        logger.error("ERPNext create error (%s): %s", doctype, exc)
        return _error_result("erp_unreachable", str(exc))


async def erp_submit_doc(doctype: str, name: str) -> dict:
    """Submit (finalize) a draft document in ERPNext."""
    url = f"{ERPNEXT_URL}/api/resource/{doctype}/{name}"
    headers = _auth_headers()

    try:
        session = await get_http_session()
        async with session.put(url, json={"docstatus": 1}, headers=headers) as resp:
            data = await resp.json()
            if resp.status == 200:
                return data.get("data", data)
            return _error_result("erp_submit_failed", str(data.get("exc_type", data))[:500])
    except Exception as exc:
        logger.error("ERPNext submit error (%s/%s): %s", doctype, name, exc)
        return _error_result("erp_unreachable", str(exc))


async def erp_health_check() -> dict[str, Any]:
    """Lightweight ERP connectivity probe."""
    result = await erp_call("small_erp.api.dashboard.get_dashboard_kpis")
    if isinstance(result, dict) and result.get("ok") is False:
        return {"ok": False, "error": result.get("error"), "code": result.get("code")}
    if isinstance(result, dict) and "error" in result and len(result) <= 3:
        return {"ok": False, "error": result.get("error"), "code": "erp_error"}
    return {"ok": True, "erp_url": ERPNEXT_URL}


async def n8n_webhook(webhook_path: str, payload: dict) -> dict:
    """Call an n8n webhook endpoint."""
    url = f"{N8N_URL}/webhook/{webhook_path}"
    try:
        session = await get_http_session()
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status == 200:
                return await resp.json()
            return _error_result("n8n_http_error", f"n8n returned {resp.status}")
    except Exception as exc:
        return _error_result("n8n_unreachable", str(exc))
