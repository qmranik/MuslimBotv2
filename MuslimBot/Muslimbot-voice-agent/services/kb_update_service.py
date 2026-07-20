"""Consume tenant KB generation events and refresh live agent instructions."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Awaitable, Callable, Optional

from services.config import (
    KB_EVENT_STREAM_PREFIX,
    KB_POLL_INTERVAL_SEC,
    KB_REFRESH_DEBOUNCE_MS,
)
from services.orchestrator_client import OrchestratorClient
from services.redis_client import get_redis

logger = logging.getLogger("muslimbot.kb_updates")

HARD_REFRESH_CHANGES = frozenset({"deleted", "visibility_changed"})

UpdateInstructionsFn = Callable[[str], Awaitable[None]]
NotifyFn = Callable[[dict[str, Any]], Awaitable[None]]


class KBUpdateWatcher:
    """Per-session Redis Stream consumer (XREAD, no shared consumer group)."""

    def __init__(
        self,
        *,
        tenant_id: str,
        session_id: str,
        client: OrchestratorClient,
        update_instructions: UpdateInstructionsFn,
        notify: Optional[NotifyFn] = None,
        session_started_ts: Optional[float] = None,
    ) -> None:
        self.tenant_id = tenant_id
        self.session_id = session_id
        self.client = client
        self.update_instructions = update_instructions
        self.notify = notify
        self.base_instructions = ""
        self.session_started_ts = session_started_ts or time.time()
        self._task: Optional[asyncio.Task[None]] = None
        self._stop = asyncio.Event()
        self._last_stream_id = "$"
        self._last_generation = 0
        self._seen_events: set[str] = set()
        self._pending_generation = 0
        self._pending_change = "indexed"
        self._debounce_handle: Optional[asyncio.TimerHandle] = None

    @property
    def stream_key(self) -> str:
        return f"{KB_EVENT_STREAM_PREFIX}{self.tenant_id}"

    def start(self, initial_generation: int = 0) -> None:
        self._last_generation = int(initial_generation or 0)
        if self._task is None or self._task.done():
            self._stop.clear()
            self._task = asyncio.create_task(self._run(), name=f"kb-watch-{self.session_id}")

    async def stop(self) -> None:
        self._stop.set()
        if self._debounce_handle is not None:
            self._debounce_handle.cancel()
            self._debounce_handle = None
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run(self) -> None:
        logger.info(
            "KB watcher started tenant=%s session=%s stream=%s gen=%s",
            self.tenant_id,
            self.session_id,
            self.stream_key,
            self._last_generation,
        )
        try:
            while not self._stop.is_set():
                progressed = await self._read_stream_once()
                if not progressed:
                    await self._reconcile_generation()
                    try:
                        await asyncio.wait_for(self._stop.wait(), timeout=KB_POLL_INTERVAL_SEC)
                    except asyncio.TimeoutError:
                        pass
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("KB watcher crashed: %s", exc)
        finally:
            logger.info("KB watcher stopped session=%s", self.session_id)

    async def _read_stream_once(self) -> bool:
        rdb = get_redis()
        if rdb is None:
            return False
        try:
            rows = await rdb.xread({self.stream_key: self._last_stream_id}, count=20, block=1000)
        except Exception as exc:
            logger.warning("XREAD failed: %s", exc)
            return False
        if not rows:
            return False
        for _stream, messages in rows:
            for msg_id, fields in messages:
                self._last_stream_id = msg_id
                await self._handle_fields(fields)
        return True

    async def _handle_fields(self, fields: dict[str, Any]) -> None:
        event_id = str(fields.get("event_id") or "")
        if event_id and event_id in self._seen_events:
            return
        if event_id:
            self._seen_events.add(event_id)
            if len(self._seen_events) > 500:
                # Bound memory for long calls.
                self._seen_events = set(list(self._seen_events)[-250:])

        try:
            generation = int(fields.get("generation") or 0)
        except (TypeError, ValueError):
            generation = 0
        change = str(fields.get("change") or "indexed")
        ts_raw = fields.get("ts")
        try:
            ts = float(ts_raw) if ts_raw is not None else 0.0
        except (TypeError, ValueError):
            ts = 0.0

        # Ignore stale pre-session events except when generation advances past ours.
        if ts and ts < self.session_started_ts and generation <= self._last_generation:
            return
        if generation <= self._last_generation and generation > 0:
            return

        self._pending_generation = max(self._pending_generation, generation)
        if change in HARD_REFRESH_CHANGES:
            self._pending_change = change
        elif self._pending_change not in HARD_REFRESH_CHANGES:
            self._pending_change = change
        self._schedule_refresh()

    def _schedule_refresh(self) -> None:
        loop = asyncio.get_running_loop()
        if self._debounce_handle is not None:
            self._debounce_handle.cancel()
        delay = max(KB_REFRESH_DEBOUNCE_MS, 50) / 1000.0
        self._debounce_handle = loop.call_later(
            delay, lambda: asyncio.create_task(self._apply_pending())
        )

    async def _apply_pending(self) -> None:
        generation = self._pending_generation
        change = self._pending_change
        self._pending_generation = 0
        self._pending_change = "indexed"
        if generation <= self._last_generation:
            return
        await self._refresh(generation=generation, change=change)

    async def _reconcile_generation(self) -> None:
        try:
            hb = await self.client.session_heartbeat()
            remote_gen = int(hb.get("kb_generation") or 0)
        except Exception as exc:
            logger.debug("heartbeat/reconcile failed: %s", exc)
            return
        if remote_gen > self._last_generation:
            await self._refresh(generation=remote_gen, change="rebuilt")

    async def _refresh(self, *, generation: int, change: str) -> None:
        hard = change in HARD_REFRESH_CHANGES
        if self.notify:
            await self.notify(
                {
                    "type": "kb-context",
                    "status": "refreshing",
                    "generation": generation,
                    "change": change,
                    "mode": "hard" if hard else "soft",
                }
            )
        try:
            ctx = await self.client.kb_context()
            if not ctx.get("ok", True) and ctx.get("status", 200) >= 400:
                raise RuntimeError(ctx.get("error") or "kb context failed")
            brief = str(ctx.get("context") or "")
            remote_gen = int(ctx.get("kb_generation") or generation)
            instructions = compose_instructions(self.base_instructions, brief)
            await self.update_instructions(instructions)
            self._last_generation = max(generation, remote_gen)
            logger.info(
                "KB instructions refreshed session=%s generation=%s mode=%s",
                self.session_id,
                self._last_generation,
                "hard" if hard else "soft",
            )
            if self.notify:
                await self.notify(
                    {
                        "type": "kb-context",
                        "status": "refreshed",
                        "generation": self._last_generation,
                        "change": change,
                        "mode": "hard" if hard else "soft",
                        "digest": ctx.get("digest"),
                    }
                )
        except Exception as exc:
            logger.warning("KB refresh failed: %s", exc)
            if self.notify:
                await self.notify(
                    {
                        "type": "kb-context",
                        "status": "error",
                        "generation": generation,
                        "error": str(exc)[:200],
                    }
                )


def compose_instructions(base_instructions: str, voice_context: str) -> str:
    instructions = base_instructions or ""
    if voice_context.strip():
        instructions += (
            "\n\nORGANIZATION KNOWLEDGE (use tools for live stock/orders):\n"
            f"{voice_context.strip()}\n"
        )
    return instructions


def parse_stream_payload(raw: str | dict[str, Any]) -> dict[str, Any]:
    """Helper for unit tests — normalize stream field payloads."""
    if isinstance(raw, dict):
        if "payload" in raw and isinstance(raw["payload"], str):
            try:
                return json.loads(raw["payload"])
            except json.JSONDecodeError:
                return raw
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}
