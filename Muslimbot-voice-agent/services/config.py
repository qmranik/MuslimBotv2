"""Shared configuration for Muslimbot voice worker and KB BFF."""

from __future__ import annotations

import os

# ERP
ERPNEXT_URL: str = os.getenv("ERPNEXT_URL", "http://frappe-web:8000")
ERPNEXT_API_KEY: str = os.getenv("FRAPPE_API_KEY", "")
ERPNEXT_API_SECRET: str = os.getenv("FRAPPE_API_SECRET", "")
ERP_TIMEOUT_SEC: float = float(os.getenv("ERP_TIMEOUT_SEC", "15"))

# n8n
N8N_URL: str = os.getenv("N8N_URL", "http://n8n:5678")

# Voice agent / LiveKit
AGENT_TIMEZONE: str = os.getenv("AGENT_TIMEZONE", "Asia/Dhaka")
AGENT_LANGUAGE: str = os.getenv("AGENT_LANGUAGE", "en")
GOOGLE_CALENDAR_ENABLED: bool = os.getenv("GOOGLE_CALENDAR_ENABLED", "false").lower() == "true"
LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_AGENT_NAME: str = os.getenv("LIVEKIT_AGENT_NAME", "muslimbot")

# KB / RAG
TENANT_ID: str = os.getenv("TENANT_ID", "default")
KB_BFF_API_KEY: str = os.getenv("KB_BFF_API_KEY", "")
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "")
VERTEX_LOCATION: str = os.getenv("VERTEX_LOCATION", "asia-southeast1")
GCS_KB_BUCKET: str = os.getenv("GCS_KB_BUCKET", "")
REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis-cache:6379/2")
VOICE_BRIEF_MAX_CHARS: int = int(os.getenv("VOICE_BRIEF_MAX_CHARS", "4000"))
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

# Data paths
DATA_DIR: str = os.getenv("KB_DATA_DIR", "/app/data")
DB_PATH: str = os.path.join(DATA_DIR, "kb_registry.db")

RAG_CHUNK_SIZE: int = int(os.getenv("RAG_CHUNK_SIZE", "512"))
RAG_CHUNK_OVERLAP: int = int(os.getenv("RAG_CHUNK_OVERLAP", "100"))
RAG_TOP_K_DEFAULT: int = int(os.getenv("RAG_TOP_K_DEFAULT", "8"))

GEMINI_CHAT_MODEL: str = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.0-flash")
GEMINI_VOICE_MODEL: str = os.getenv("GEMINI_VOICE_MODEL", "gemini-2.0-flash")


def vertex_configured() -> bool:
    return bool(GOOGLE_CLOUD_PROJECT and GCS_KB_BUCKET)


def is_production() -> bool:
    return ENVIRONMENT.lower() == "production"
