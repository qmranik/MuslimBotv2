"""URL classification + text extraction for KB ingestion.

Classifies a URL (youtube / pdf / single link / crawlable website) and provides
synchronous fetch helpers used by the ingest pipeline (run in a thread). Heavy
optional deps (trafilatura, youtube-transcript-api) are imported lazily so the
module — and therefore the whole KB BFF — imports even when they are absent.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger("muslimbot.kb.scrape")


@dataclass
class UrlClassification:
    url_type: str          # youtube | pdf | link | website
    depth_default: int     # suggested crawl depth
    normalized_url: str


def _normalize(url: str) -> str:
    url = (url or "").strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = "https://" + url
    p = urlparse(url)
    path = p.path.rstrip("/") or "/"
    return urlunparse((p.scheme, p.netloc, path, "", p.query, ""))


def classify_url(url: str) -> UrlClassification:
    normalized = _normalize(url)
    p = urlparse(normalized)
    host = p.netloc.lower()
    lower = normalized.lower()

    if "youtube.com" in host or "youtu.be" in host:
        return UrlClassification("youtube", 0, normalized)
    if lower.endswith(".pdf"):
        return UrlClassification("pdf", 0, normalized)
    # Root path → treat as a crawlable website; deep path → single link.
    if p.path in ("", "/"):
        return UrlClassification("website", 1, normalized)
    return UrlClassification("link", 0, normalized)


def fetch_text(url: str) -> str:
    """Fetch and extract the main text of a page (blocking; call via to_thread)."""
    try:
        import trafilatura  # lazy
    except Exception:
        logger.warning("trafilatura not available; cannot fetch %s", url)
        return ""
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        return trafilatura.extract(downloaded) or ""
    except Exception as exc:
        logger.warning("fetch_text failed for %s: %s", url, exc)
        return ""


def fetch_youtube_transcript(url: str) -> str:
    """Best-effort YouTube transcript extraction."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi  # lazy
    except Exception:
        return ""
    m = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not m:
        return ""
    try:
        parts = YouTubeTranscriptApi.get_transcript(m.group(1))
        return " ".join(p.get("text", "") for p in parts)
    except Exception as exc:
        logger.info("no transcript for %s: %s", url, exc)
        return ""
