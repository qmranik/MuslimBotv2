"""Gemini text generation with RAG context for chat endpoint."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp

from services.config import GEMINI_CHAT_MODEL, GOOGLE_API_KEY

logger = logging.getLogger("muslimbot.gemini_chat")


from services import rag_vertex

async def generate_support_reply(tenant_id: str, message: str, contexts: list[dict[str, Any]]) -> str:
    context_block = "\n\n---\n\n".join(
        c.get("text", "") for c in contexts if c.get("text")
    )
    system_prompt = "You are a customer support agent for a pharmacy/retail business.\n"
    try:
        chunks = await rag_vertex.retrieve(tenant_id, "type=system_prompt", top_k=1)
        for chunk in chunks:
            text = chunk.get("text", "").strip()
            if text and len(text) > 50:
                system_prompt = text + "\n"
                break
    except Exception as exc:
        logger.warning(f"Failed to fetch dynamic system prompt: {exc}")

    prompt = (
        f"{system_prompt}"
        "Use the KNOWLEDGE CONTEXT below for policies and FAQs.\n"
        "For stock, price, or live orders, say you will check inventory if not in context.\n"
        "Be concise and helpful.\n\n"
        f"KNOWLEDGE CONTEXT:\n{context_block or 'No knowledge indexed yet.'}\n\n"
        f"CUSTOMER MESSAGE:\n{message}"
    )

    if not GOOGLE_API_KEY:
        if contexts:
            return (
                f"Based on our knowledge base ({len(contexts)} sources): "
                f"{contexts[0].get('text', '')[:400]}"
            )
        return "Knowledge base is empty. Please upload documents first."

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_CHAT_MODEL}:generateContent?key={GOOGLE_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600},
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                data = await resp.json()
                return (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "Sorry, I could not generate a response.")
                )
    except Exception as exc:
        logger.error("Gemini chat failed: %s", exc)
        return "I'm having trouble generating a response right now. Please try again."
