"""Unit tests for KB update stream helpers."""

from __future__ import annotations

import asyncio
from typing import Any, List

from services.kb_update_service import (
    HARD_REFRESH_CHANGES,
    KBUpdateWatcher,
    compose_instructions,
    parse_stream_payload,
)


def test_compose_instructions_includes_brief() -> None:
    out = compose_instructions("BASE", "Hours are 9-5")
    assert "BASE" in out
    assert "ORGANIZATION KNOWLEDGE" in out
    assert "Hours are 9-5" in out


def test_parse_stream_payload_json() -> None:
    data = parse_stream_payload('{"generation": 3, "change": "indexed"}')
    assert data["generation"] == 3


def test_hard_refresh_changes() -> None:
    assert "deleted" in HARD_REFRESH_CHANGES
    assert "visibility_changed" in HARD_REFRESH_CHANGES
    assert "indexed" not in HARD_REFRESH_CHANGES


class _FakeClient:
    def __init__(self) -> None:
        self.contexts = 0

    async def session_heartbeat(self) -> dict[str, Any]:
        return {"ok": True, "kb_generation": 0}

    async def kb_context(self) -> dict[str, Any]:
        self.contexts += 1
        return {
            "ok": True,
            "context": "fresh brief",
            "kb_generation": 5,
            "digest": "abc",
        }


def test_watcher_dedupe_and_refresh() -> None:
    updates: List[str] = []
    notifications: List[dict[str, Any]] = []

    async def update_instructions(text: str) -> None:
        updates.append(text)

    async def notify(payload: dict[str, Any]) -> None:
        notifications.append(payload)

    async def run() -> None:
        client = _FakeClient()
        watcher = KBUpdateWatcher(
            tenant_id="acme",
            session_id="VS-1",
            client=client,  # type: ignore[arg-type]
            update_instructions=update_instructions,
            notify=notify,
            session_started_ts=0,
        )
        watcher.base_instructions = "BASE"
        watcher._last_generation = 1

        await watcher._handle_fields(
            {"event_id": "e1", "generation": "5", "change": "indexed", "ts": "999999"}
        )
        await watcher._handle_fields(
            {"event_id": "e1", "generation": "5", "change": "indexed", "ts": "999999"}
        )
        await asyncio.sleep(0.6)
        assert client.contexts == 1
        assert any("fresh brief" in u for u in updates)
        assert any(n.get("status") == "refreshed" for n in notifications)
        assert watcher._last_generation == 5

    asyncio.run(run())
