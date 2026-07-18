"""Shared Redis client for voice-session memory and telemetry."""

from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as redis

from services.config import REDIS_URL

logger = logging.getLogger("muslimbot.redis")

_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global _client
    if not REDIS_URL:
        return None
    if _client is None:
        try:
            _client = redis.from_url(REDIS_URL, decode_responses=True)
        except Exception as exc:
            logger.warning("Failed to create Redis client: %s", exc)
            return None
    return _client
