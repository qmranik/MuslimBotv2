import json
import logging
import time
from typing import Any
from services.voice_brief import _get_redis

logger = logging.getLogger("muslimbot.memory")

async def get_conversation_memory(participant_identity: str) -> list[dict[str, Any]]:
    """Retrieve the last 5 conversation turns for a given participant."""
    if not participant_identity:
        return []
    try:
        client = _get_redis()
        key = f"voice_memory:{participant_identity}"
        data = await client.lrange(key, 0, 4)
        return [json.loads(item) for item in reversed(data)] if data else []
    except Exception as exc:
        logger.warning(f"Failed to get conversation memory: {exc}")
        return []

async def append_conversation_memory(participant_identity: str, role: str, text: str) -> None:
    """Append a turn to the conversation memory, retaining only the last 5 turns."""
    if not participant_identity or not text.strip():
        return
    try:
        client = _get_redis()
        key = f"voice_memory:{participant_identity}"
        entry = json.dumps({"role": role, "text": text})
        await client.lpush(key, entry)
        await client.ltrim(key, 0, 4)
    except Exception as exc:
        logger.warning(f"Failed to append conversation memory: {exc}")

async def log_tool_telemetry(participant_identity: str, tool_name: str, duration_ms: int, success: bool) -> None:
    """Log tool execution metrics to a Redis stream."""
    try:
        client = _get_redis()
        stream_key = "telemetry:voice_tools"
        entry = {
            "participant": participant_identity or "unknown",
            "tool": tool_name,
            "duration_ms": duration_ms,
            "success": 1 if success else 0,
            "timestamp": int(time.time() * 1000)
        }
        await client.xadd(stream_key, entry)
    except Exception as exc:
        logger.warning(f"Failed to log telemetry: {exc}")

import functools

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
            # Find the participant identity from self.tenant_id or context if possible
            # In LiveKit, tools don't have direct access to participant_identity easily,
            # so we'll use "voice_session" or self.tenant_id as fallback
            participant = getattr(self, "participant_identity", "unknown")
            import asyncio
            asyncio.create_task(log_tool_telemetry(participant, func.__name__, duration_ms, success))
    return wrapper
