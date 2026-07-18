"""Domain helpers that format Go orchestrator tool/KB responses for speech."""

from __future__ import annotations

import json
from typing import Any

from services.orchestrator_client import OrchestratorClient


def _format_result(payload: dict[str, Any]) -> str:
    if not payload.get("ok", True) and payload.get("error"):
        return f"Sorry, that failed: {payload['error']}"
    result = payload.get("result")
    if isinstance(result, dict):
        if result.get("ok") is False:
            return f"Sorry, that failed: {result.get('error', 'unknown error')}"
        data = result.get("data")
        if data is not None:
            if isinstance(data, (dict, list)):
                return json.dumps(data)[:1500]
            return str(data)[:1500]
    if payload.get("status") == "pending_confirmation":
        summary = payload.get("summary") or "Please confirm this write action."
        action_id = payload.get("action_id", "")
        return (
            f"I need your confirmation before continuing. {summary} "
            f"Say yes to approve or no to cancel. Action ID {action_id}."
        )
    if payload.get("status") == "executed":
        return _format_result({"ok": True, "result": payload.get("result", payload)})
    if payload.get("status") == "rejected":
        return "Okay, I cancelled that action."
    if "chunks" in payload:
        chunks = payload.get("chunks") or []
        if not chunks:
            return "I could not find anything relevant in the knowledge base."
        lines = []
        for chunk in chunks[:5]:
            text = chunk.get("text") if isinstance(chunk, dict) else str(chunk)
            if text:
                lines.append(text[:400])
        return "Here is what I found:\n" + "\n".join(lines)
    if "context" in payload and payload.get("context"):
        return str(payload["context"])[:2000]
    return json.dumps(payload)[:1200]


async def run_read_tool(client: OrchestratorClient, tool: str, **arguments: Any) -> str:
    payload = await client.prepare_tool(tool, arguments)
    return _format_result(payload)


async def prepare_write_tool(client: OrchestratorClient, tool: str, **arguments: Any) -> str:
    payload = await client.prepare_tool(tool, arguments)
    return _format_result(payload)


async def confirm_write_tool(
    client: OrchestratorClient, action_id: str, approve: bool, transcript: str = ""
) -> str:
    decision = "approve" if approve else "reject"
    payload = await client.confirm_tool(action_id, decision, transcript=transcript)
    return _format_result(payload)


async def search_knowledge(client: OrchestratorClient, query: str, session_id: str = "") -> str:
    payload = await client.retrieve_kb(query, session_id=session_id)
    return _format_result(payload)
