"""POS voice / natural-language item extraction — Gemini + live item search."""

from __future__ import annotations

import json
import re
from typing import Any

import frappe

from small_erp.services import gemini_service

_EXTRACT_PROMPT = """You extract pharmacy/retail product lines from spoken or typed orders.
Return ONLY a JSON array (no markdown). Each element:
{"query": "<short product search term>", "qty": <positive integer>}

Examples:
- "10 pata napa" -> [{"query": "napa", "qty": 10}]
- "2 savlon and 5 paracetamol" -> [{"query": "savlon", "qty": 2}, {"query": "paracetamol", "qty": 5}]
If nothing is orderable, return [].
"""


def _parse_extracted_json(raw: str) -> list[dict[str, Any]]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    out: list[dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        query = str(row.get("query") or "").strip()
        if not query:
            continue
        qty = int(row.get("qty") or 1)
        out.append({"query": query, "qty": max(qty, 1)})
    return out


def _keyword_fallback(voice_query: str) -> list[dict[str, Any]]:
    """Simple token fallback when Gemini is unavailable."""
    query_lower = voice_query.lower()
    tokens = re.findall(r"[a-z0-9]+", query_lower)
    qty_match = re.search(r"(\d+)", query_lower)
    default_qty = int(qty_match.group(1)) if qty_match else 1
    skip = {"pata", "piece", "pcs", "box", "boxes", "strip", "strips", "and", "the", "a"}
    items: list[dict[str, Any]] = []
    for token in tokens:
        if token.isdigit() or token in skip or len(token) < 3:
            continue
        items.append({"query": token, "qty": default_qty})
    return items[:5]


def _extract_line_items(voice_query: str) -> list[dict[str, Any]]:
    voice_query = (voice_query or "").strip()
    if not voice_query:
        return []

    if gemini_service.is_configured():
        try:
            raw = gemini_service.generate_text(
                user_prompt=voice_query,
                system_instruction=_EXTRACT_PROMPT,
                temperature=0.1,
                max_output_tokens=256,
            )
            parsed = _parse_extracted_json(raw)
            if parsed:
                return parsed
        except gemini_service.GeminiAPIError:
            pass

    return _keyword_fallback(voice_query)


def _resolve_item(query: str) -> dict[str, Any] | None:
    from small_erp.api.pos import search_pos_items

    matches = search_pos_items(query=query, limit=3) or []
    if not matches:
        return None
    item = matches[0]
    return {
        "item_code": item.get("item_code"),
        "item_name": item.get("item_name"),
        "rate": float(item.get("standard_rate") or 0),
        "available_qty": float(item.get("available_qty") or 0),
        "stock_uom": item.get("stock_uom") or "Nos",
    }


def process_voice_query(voice_query: str) -> dict[str, Any]:
    """Extract items from voice/text and enrich with live ERP stock + pricing."""
    line_items = _extract_line_items(voice_query)
    enriched: list[dict[str, Any]] = []

    for line in line_items:
        resolved = _resolve_item(line["query"])
        if not resolved:
            continue
        enriched.append(
            {
                **resolved,
                "qty": line["qty"],
                "location": resolved.get("stock_uom") or "Warehouse",
            }
        )

    html = frappe.render_template(
        "small_erp/templates/includes/voice_cart_proposal.html",
        {"items": enriched},
    )
    return {
        "html": html,
        "items": enriched,
        "source": "gemini" if gemini_service.is_configured() else "keyword",
    }
