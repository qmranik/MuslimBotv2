"""Typed HTTP client for the Go orchestrator agent API."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

import aiohttp

from services.config import GO_ORCHESTRATOR_URL, ORCHESTRATOR_TIMEOUT_SEC

logger = logging.getLogger("muslimbot.orchestrator")


class OrchestratorClient:
    """Calls /v1/agent/* using a session-bound workload JWT."""

    def __init__(self, workload_token: str, base_url: str = GO_ORCHESTRATOR_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self.workload_token = workload_token
        self._session: Optional[aiohttp.ClientSession] = None

    async def _http(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=ORCHESTRATOR_TIMEOUT_SEC)
            )
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
        self._session = None

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.workload_token}",
            "Content-Type": "application/json",
            "X-Request-Id": uuid.uuid4().hex,
        }

    async def _request(self, method: str, path: str, payload: Optional[dict] = None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        session = await self._http()
        try:
            async with session.request(method, url, json=payload, headers=self._headers()) as resp:
                text = await resp.text()
                data: Any
                try:
                    data = await resp.json(content_type=None)
                except Exception:
                    data = {"raw": text[:500]}
                if resp.status >= 400:
                    err = data.get("error") if isinstance(data, dict) else text
                    return {"ok": False, "status": resp.status, "error": str(err)[:500], "data": data}
                if isinstance(data, dict):
                    data.setdefault("ok", True)
                    data["status"] = resp.status
                    return data
                return {"ok": True, "status": resp.status, "data": data}
        except Exception as exc:
            logger.error("Orchestrator request failed %s %s: %s", method, path, exc)
            return {"ok": False, "error": str(exc), "status": 0}

    async def list_tools(self) -> dict[str, Any]:
        return await self._request("GET", "/v1/agent/tools")

    async def retrieve_kb(self, query: str, top_k: int = 8, session_id: str = "") -> dict[str, Any]:
        return await self._request(
            "POST",
            "/v1/agent/kb/retrieve",
            {"query": query, "top_k": top_k, "session_id": session_id},
        )

    async def voice_brief(self) -> dict[str, Any]:
        return await self._request("GET", "/v1/agent/kb/voice-brief")

    async def prepare_tool(
        self,
        tool: str,
        arguments: Optional[dict[str, Any]] = None,
        idempotency_key: str = "",
    ) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/v1/agent/tool-actions",
            {
                "tool": tool,
                "arguments": arguments or {},
                "idempotency_key": idempotency_key or uuid.uuid4().hex,
            },
        )

    async def confirm_tool(
        self,
        action_id: str,
        decision: str,
        transcript: str = "",
        channel: str = "voice",
    ) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/v1/agent/tool-actions/{action_id}/confirm",
            {
                "decision": decision,
                "evidence": {
                    "channel": channel,
                    "transcript": transcript,
                },
            },
        )

    async def get_tool_action(self, action_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/v1/agent/tool-actions/{action_id}")
