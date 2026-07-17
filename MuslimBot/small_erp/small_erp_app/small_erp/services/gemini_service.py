"""Google Gemini (AI Studio) client for Small ERP assistants."""

from __future__ import annotations

import os
from typing import Any

import frappe
import requests

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.5-flash"
FALLBACK_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
)


class GeminiNotConfiguredError(Exception):
    """Raised when no Gemini / Google API key is available."""


class GeminiAPIError(Exception):
    """Raised when the Gemini API returns an error response."""


def get_gemini_api_key() -> str:
    """Resolve API key from site config or environment (GEMINI_API_KEY or GOOGLE_API_KEY)."""
    return (
        (frappe.conf.get("google_api_key") or "")
        or (frappe.conf.get("gemini_api_key") or "")
        or os.environ.get("GEMINI_API_KEY", "")
        or os.environ.get("GOOGLE_API_KEY", "")
        or ""
    ).strip()


def is_configured() -> bool:
    return bool(get_gemini_api_key())


def generate_text(
    *,
    user_prompt: str,
    system_instruction: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.35,
    max_output_tokens: int = 1200,
) -> str:
    """Call Gemini generateContent and return plain-text reply."""
    api_key = get_gemini_api_key()
    if not api_key:
        raise GeminiNotConfiguredError("GEMINI_API_KEY / GOOGLE_API_KEY is not configured")

    models_to_try = [model] + [m for m in FALLBACK_MODELS if m != model]
    last_error: Exception | None = None

    for model_name in models_to_try:
        try:
            return _generate_with_model(
                api_key=api_key,
                model=model_name,
                user_prompt=user_prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
        except GeminiAPIError as exc:
            last_error = exc
            message = str(exc).lower()
            if "quota" in message or "billing" in message:
                raise
            if "not found" in message or "not supported" in message:
                continue
            raise

    if last_error:
        raise last_error
    raise GeminiAPIError("Gemini request failed")


def _generate_with_model(
    *,
    api_key: str,
    model: str,
    user_prompt: str,
    system_instruction: str,
    temperature: float,
    max_output_tokens: int,
) -> str:
    url = f"{GEMINI_API_BASE}/models/{model}:generateContent"
    payload: dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        },
    }

    try:
        response = requests.post(
            url,
            params={"key": api_key},
            json=payload,
            timeout=45,
        )
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        detail = ""
        try:
            detail = exc.response.json().get("error", {}).get("message", "")
        except Exception:
            detail = str(exc)
        raise GeminiAPIError(detail or "Gemini API request failed") from exc
    except requests.exceptions.RequestException as exc:
        raise GeminiAPIError("Could not reach Gemini API") from exc

    body = response.json()
    candidates = body.get("candidates") or []
    if not candidates:
        raise GeminiAPIError("Gemini returned no candidates")

    parts = (candidates[0].get("content") or {}).get("parts") or []
    text_parts = [part.get("text", "") for part in parts if part.get("text")]
    answer = "\n".join(text_parts).strip()
    if not answer:
        raise GeminiAPIError("Gemini returned an empty response")
    return answer


def test_connection() -> dict[str, Any]:
    """Lightweight health check for the AI assistant status panel."""
    if not is_configured():
        return {"ok": False, "configured": False, "error": "API key not configured"}

    try:
        reply = generate_text(
            user_prompt='Reply with exactly one word: OK',
            system_instruction="Reply with the single word OK and nothing else.",
            max_output_tokens=64,
            temperature=0.0,
        )
        return {
            "ok": bool(reply.strip()),
            "configured": True,
            "model": DEFAULT_MODEL,
        }
    except Exception as exc:
        return {
            "ok": False,
            "configured": True,
            "error": str(exc)[:200],
            "model": DEFAULT_MODEL,
        }
