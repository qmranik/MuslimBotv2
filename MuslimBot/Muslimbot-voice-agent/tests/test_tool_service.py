"""Unit tests for LiveKit-only worker helpers (no FastAPI BFF)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.tool_service import _format_result, confirm_write_tool, search_knowledge


def test_format_pending_confirmation():
    spoken = _format_result(
        {
            "status": "pending_confirmation",
            "summary": "Create sales order for Demo Client",
            "action_id": "TA-ABC",
        }
    )
    assert "Action ID TA-ABC" in spoken
    assert "Create sales order" in spoken


def test_format_kb_chunks():
    spoken = _format_result(
        {
            "ok": True,
            "chunks": [{"text": "Return policy is 7 days."}],
        }
    )
    assert "Return policy" in spoken


@pytest.mark.asyncio
async def test_search_knowledge_calls_orchestrator():
    client = MagicMock()
    client.retrieve_kb = AsyncMock(
        return_value={"ok": True, "chunks": [{"text": "Shipping is free over 500."}]}
    )
    result = await search_knowledge(client, "shipping", session_id="VS-1")
    client.retrieve_kb.assert_awaited_once()
    assert "Shipping is free" in result


@pytest.mark.asyncio
async def test_confirm_write_tool():
    client = MagicMock()
    client.confirm_tool = AsyncMock(
        return_value={
            "ok": True,
            "status": "executed",
            "result": {"ok": True, "data": {"name": "ACC-SINV-1"}},
        }
    )
    result = await confirm_write_tool(client, "TA-1", approve=True, transcript="yes")
    client.confirm_tool.assert_awaited_once()
    assert "ACC-SINV-1" in result or "executed" in result.lower() or "{" in result
