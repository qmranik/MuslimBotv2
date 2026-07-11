"""Health check routes."""

from __future__ import annotations

from fastapi import APIRouter

from services import erp_client, source_registry
from services.config import TENANT_ID, vertex_configured

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    indexed = await source_registry.count_indexed_sources(TENANT_ID)
    return {
        "status": "ok",
        "tenant_id": TENANT_ID,
        "vertex_configured": vertex_configured(),
        "indexed_sources": indexed,
    }


@router.get("/health/erp")
async def health_erp() -> dict:
    result = await erp_client.erp_health_check()
    return {"status": "ok" if result.get("ok") else "error", **result}
