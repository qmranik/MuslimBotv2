"""RAG chat test routes."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Depends
from pydantic import BaseModel, Field

from services import gemini_chat, rag_vertex
from services import voice_brief
from services.config import tenant_id
from routes.dependencies import verify_kb_api_key, get_tenant_id

router = APIRouter(tags=["chat"], dependencies=[Depends(verify_kb_api_key)])


class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    top_k: int = Field(default=8, ge=1, le=20)


@router.post("/chat")
async def chat(body: ChatRequest, tenant_id: str = Depends(get_tenant_id)) -> dict[str, Any]:
    session_id = body.session_id or uuid.uuid4().hex[:12]
    chunks = await rag_vertex.retrieve(tenant_id, body.message, top_k=body.top_k)
    logger.info("RAG returned %d chunks for chat", len(chunks))

    reply = await gemini_chat.generate_support_reply(tenant_id, body.message, chunks)
    return {
        "reply": reply,
        "session_id": session_id,
        "chunks": chunks,
        "chunks_used": len(chunks),
        "status": "ok",
    }


@router.post("/voice-brief/rebuild")
async def rebuild_voice_brief() -> dict[str, Any]:
    return await voice_brief.rebuild(tenant_id)


@router.get("/voice-brief")
async def get_voice_brief() -> dict[str, Any]:
    return await voice_brief.get_preview(tenant_id)
