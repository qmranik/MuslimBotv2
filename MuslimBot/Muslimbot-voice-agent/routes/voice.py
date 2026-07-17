"""LiveKit voice session routes for in-browser WebRTC calls."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from livekit import api
from routes.dependencies import verify_kb_api_key

from services.config import (
    LIVEKIT_AGENT_NAME,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    LIVEKIT_URL,
)

router = APIRouter(prefix="/voice", tags=["voice"], dependencies=[Depends(verify_kb_api_key)])


class VoiceSessionRequest(BaseModel):
    room_name: str = ""
    participant_name: str = "generative-ui-user"


class VoiceSessionResponse(BaseModel):
    token: str
    url: str
    room_name: str
    participant_identity: str


def _livekit_http_url() -> str:
    return LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://")


@router.post("/session", response_model=VoiceSessionResponse)
async def create_voice_session(body: VoiceSessionRequest) -> dict[str, Any]:
    if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.",
        )

    room_name = body.room_name.strip() or f"muslimbot-{uuid.uuid4().hex[:10]}"
    participant_identity = f"user-{uuid.uuid4().hex[:8]}"
    participant_name = body.participant_name.strip() or "Knowledge Hub User"

    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(participant_identity)
        .with_name(participant_name)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )

    lkapi = api.LiveKitAPI(_livekit_http_url(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    try:
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=LIVEKIT_AGENT_NAME,
                room=room_name,
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to dispatch voice agent: {exc}",
        ) from exc
    finally:
        await lkapi.aclose()

    return {
        "token": token,
        "url": LIVEKIT_URL,
        "room_name": room_name,
        "participant_identity": participant_identity,
    }
