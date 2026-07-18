"""Voice-session conversation memory and tool telemetry."""

from __future__ import annotations

import functools
import json
import logging
import time
from typing import Any

from services.config import VOICE_MEMORY_TTL_SEC
from services.redis_client import get_redis

logger = logging.getLogger("muslimbot.memory")


def _memory_key(tenant_id: str, session_id: str) -> str:
    return f"voice_memory:{tenant_id}:{session_id}"


async def get_conversation_memory(tenant_id: str, session_id: str) -> list[dict[str, Any]]:
    if not tenant_id or not session_id:
        return []
    try:
        client = get_redis()
        if client is None:
            return []
        data = await client.lrange(_memory_key(tenant_id, session_id), 0, 4)
        return [json.loads(item) for item in reversed(data)] if data else []
    except Exception as exc:
        logger.warning("Failed to get conversation memory: %s", exc)
        return []


async def append_conversation_memory(
    tenant_id: str, session_id: str, role: str, text: str
) -> None:
    if not tenant_id or not session_id or not text.strip():
        return
    try:
        client = get_redis()
        if client is None:
            return
        key = _memory_key(tenant_id, session_id)
        entry = json.dumps({"role": role, "text": text})
        await client.lpush(key, entry)
        await client.ltrim(key, 0, 4)
        await client.expire(key, VOICE_MEMORY_TTL_SEC)
    except Exception as exc:
        logger.warning("Failed to append conversation memory: %s", exc)


async def log_tool_telemetry(
    tenant_id: str, session_id: str, tool_name: str, duration_ms: int, success: bool
) -> None:
    try:
        client = get_redis()
        if client is None:
            return
        stream_key = "telemetry:voice_tools"
        entry = {
            "tenant": tenant_id or "unknown",
            "session": session_id or "unknown",
            "tool": tool_name,
            "duration_ms": duration_ms,
            "success": 1 if success else 0,
            "timestamp": int(time.time() * 1000),
        }
        await client.xadd(stream_key, entry)
    except Exception as exc:
        logger.warning("Failed to log telemetry: %s", exc)


def with_telemetry(func):
    @functools.wraps(func)
    async def wrapper(self, *args, **kwargs):
        start = time.time()
        success = True
        try:
            return await func(self, *args, **kwargs)
        except Exception:
            success = False
            raise
        finally:
            duration_ms = int((time.time() - start) * 1000)
            import asyncio

            asyncio.create_task(
                log_tool_telemetry(
                    getattr(self, "tenant_id", "unknown"),
                    getattr(self, "session_id", "unknown"),
                    func.__name__,
                    duration_ms,
                    success,
                )
            )

    return wrapper
