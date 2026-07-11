"""Vertex AI RAG client for voice agent calling the Go orchestrator."""

import aiohttp
import logging
from services.config import KB_BFF_API_KEY

logger = logging.getLogger("muslimbot.rag")

async def retrieve(tenant_id: str, query: str, top_k: int = 8) -> list[dict]:
    """Retrieve grounded chunks from the Go orchestrator."""
    url = "http://go-orchestrator:8080/v1/kb/retrieve"
    headers = {
        "X-KB-API-Key": KB_BFF_API_KEY,
        "X-Tenant-Id": tenant_id,
        "Content-Type": "application/json"
    }
    payload = {"query": query, "top_k": top_k}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("chunks", [])
                else:
                    text = await resp.text()
                    logger.warning("Retrieve failed with status %d: %s", resp.status, text)
    except Exception as exc:
        logger.error("Failed to query Go orchestrator RAG: %s", exc)
    return []

async def delete_rag_file(tenant_id: str, rag_file_id: str) -> None:
    """Forward delete request to Go Orchestrator."""
    url = f"http://go-orchestrator:8080/v1/kb/sources/{rag_file_id}"
    headers = {
        "X-KB-API-Key": KB_BFF_API_KEY,
        "X-Tenant-Id": tenant_id,
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.delete(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status not in (200, 204):
                    text = await resp.text()
                    logger.warning("Delete failed with status %d: %s", resp.status, text)
    except Exception as exc:
        logger.error("Failed to delete source from Go orchestrator RAG: %s", exc)

async def ensure_corpus(tenant_id: str) -> str:
    """Stub — handled by Go orchestrator."""
    return f"projects/liteerp/locations/us-central1/ragCorpora/liteerp-{tenant_id}"
