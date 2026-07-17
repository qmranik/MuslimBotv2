"""Voice brief cache — pre-compressed FAQ context for low-latency voice."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp

from services.config import GOOGLE_API_KEY, GEMINI_CHAT_MODEL, VOICE_BRIEF_MAX_CHARS, REDIS_URL, TENANT_ID
from services import rag_vertex

logger = logging.getLogger("muslimbot.voice_brief")

CANNED_QUERIES = [
    "What is your return policy?",
    "What are your business hours?",
    "Do you offer delivery?",
    "What payment methods do you accept?",
    "How can I contact customer support?",
    "What is your warranty policy?",
    "Do you have a loyalty program?",
    "What are your shipping times?",
    "Where are you located?",
    "What products do you sell?",
    "How do I place an order?",
    "What is your refund process?",
    "Do you offer bulk discounts?",
    "What areas do you deliver to?",
    "What is your privacy policy?",
]

_redis_client = None


def _redis_key(tenant_id: str) -> str:
    return f"voice_brief:{tenant_id}"


def _get_redis():
    global _redis_client
    if _redis_client is None:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


async def get_cached(tenant_id: str | None = None) -> str:
    """Read voice brief from Redis; return empty string if missing."""
    tenant_id = tenant_id or TENANT_ID
    try:
        client = _get_redis()
        value = await client.get(_redis_key(tenant_id))
        return value or ""
    except Exception as exc:
        logger.warning("Redis voice brief read failed: %s", exc)
        return ""


async def set_cached(tenant_id: str, context: str) -> None:
    try:
        client = _get_redis()
        await client.set(_redis_key(tenant_id), (context or "")[:VOICE_BRIEF_MAX_CHARS])
    except Exception as exc:
        logger.warning("Redis voice brief write failed: %s", exc)


async def _compress_with_gemini(snippets: list[str]) -> str:
    if not GOOGLE_API_KEY:
        joined = "\n\n".join(snippets)
        return joined[:VOICE_BRIEF_MAX_CHARS] if joined else "No indexed knowledge yet."

    prompt = (
        "Compress the following knowledge snippets into a spoken-friendly FAQ brief "
        f"for a voice assistant. Max {VOICE_BRIEF_MAX_CHARS} characters. "
        "Use plain sentences, no markdown, no bullet symbols.\n\n"
        + "\n\n---\n\n".join(snippets[:30])
    )
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_CHAT_MODEL}:generateContent?key={GOOGLE_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1200},
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=45)) as resp:
                data = await resp.json()
                text = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if text.strip():
                    return text.strip()[:VOICE_BRIEF_MAX_CHARS]
    except Exception as exc:
        logger.warning("Gemini voice brief compression failed: %s", exc)

    joined = "\n\n".join(snippets)
    return joined[:VOICE_BRIEF_MAX_CHARS] if joined else "No indexed knowledge yet."


async def rebuild(tenant_id: str | None = None) -> dict[str, Any]:
    """Rebuild voice brief from canned queries + RAG retrieval."""
    tenant_id = tenant_id or TENANT_ID
    snippets: list[str] = []
    seen: set[str] = set()

    for query in CANNED_QUERIES:
        chunks = await rag_vertex.retrieve(tenant_id, query, top_k=2)
        for chunk in chunks:
            text = (chunk.get("text") or "").strip()
            if text and text not in seen:
                seen.add(text)
                snippets.append(text[:500])
        if sum(len(s) for s in snippets) >= VOICE_BRIEF_MAX_CHARS:
            break

    brief = await _compress_with_gemini(snippets)
    if not brief.strip():
        brief = "No indexed knowledge yet."
    await set_cached(tenant_id, brief)
    return {"tenant_id": tenant_id, "context": brief, "snippet_count": len(snippets)}


async def get_preview(tenant_id: str | None = None) -> dict[str, Any]:
    tenant_id = tenant_id or TENANT_ID
    context = await get_cached(tenant_id)
    if not context:
        result = await rebuild(tenant_id)
        return result
    return {"tenant_id": tenant_id, "context": context}
