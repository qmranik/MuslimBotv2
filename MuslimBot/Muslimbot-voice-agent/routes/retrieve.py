"""RAG retrieval routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Depends
from pydantic import BaseModel, Field

from services import rag_vertex
from services.config import tenant_id
from routes.dependencies import verify_kb_api_key, get_tenant_id

router = APIRouter(tags=["retrieve"], dependencies=[Depends(verify_kb_api_key)])


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = Field(default=8, ge=1, le=20)


@router.post("/retrieve")
async def retrieve(body: RetrieveRequest, tenant_id: str = Depends(get_tenant_id)) -> dict[str, Any]:
    chunks = await rag_vertex.retrieve(tenant_id, body.query, top_k=body.top_k)
    return {"query": body.query, "chunks": chunks, "chunks_used": len(chunks)}
