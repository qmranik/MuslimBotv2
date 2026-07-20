"""Shared configuration for the LiveKit-only Muslimbot voice worker."""

from __future__ import annotations

import os

# LiveKit
LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_AGENT_NAME: str = os.getenv("LIVEKIT_AGENT_NAME", "muslimbot")

# Go orchestrator (sole ERP + KB control plane)
GO_ORCHESTRATOR_URL: str = os.getenv("GO_ORCHESTRATOR_URL", "http://go-orchestrator:8080").rstrip("/")
ORCHESTRATOR_TIMEOUT_SEC: float = float(os.getenv("ORCHESTRATOR_TIMEOUT_SEC", "20"))

# Voice / Gemini
AGENT_TIMEZONE: str = os.getenv("AGENT_TIMEZONE", "Asia/Dhaka")
GEMINI_VOICE_MODEL: str = os.getenv("GEMINI_VOICE_MODEL", "gemini-2.0-flash-live-001")
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

# Redis (conversation memory + KB event streams)
REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis-cache:6379/2")
VOICE_MEMORY_TTL_SEC: int = int(os.getenv("VOICE_MEMORY_TTL_SEC", "86400"))
KB_EVENT_STREAM_PREFIX: str = os.getenv("KB_EVENT_STREAM_PREFIX", "kb:events:")
KB_POLL_INTERVAL_SEC: float = float(os.getenv("KB_POLL_INTERVAL_SEC", "20"))
KB_REFRESH_DEBOUNCE_MS: int = int(os.getenv("KB_REFRESH_DEBOUNCE_MS", "400"))

# Fallback tenant only used when dispatch metadata is missing (dev).
TENANT_ID: str = os.getenv("TENANT_ID", "default")
