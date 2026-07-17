"""KB BFF ingestion/registry tests.

Run: KB_DATA_DIR=/tmp/kbtest python -m pytest tests/test_kb.py
Verifies the modules that previously crashed the BFF on startup
(source_registry, ingest_pipeline, scrape_adapter) import and function.
"""

import os

os.environ.setdefault("KB_DATA_DIR", "/tmp/kb_pytest")

import pytest  # noqa: E402

from services import ingest_pipeline as ing  # noqa: E402
from services import scrape_adapter as sc  # noqa: E402
from services import source_registry as reg  # noqa: E402


def test_bff_imports():
    import bff_main

    assert len(bff_main.app.routes) >= 5


def test_classify_url():
    assert sc.classify_url("youtu.be/abcdefghijk").url_type == "youtube"
    assert sc.classify_url("example.com/a.pdf").url_type == "pdf"
    assert sc.classify_url("example.com/deep/path").url_type == "link"
    assert sc.classify_url("example.com").url_type == "website"
    assert sc.classify_url("example.com").normalized_url.startswith("https://")


def test_chunk_text():
    chunks = ing.chunk_text("word " * 500, size=100, overlap=20)
    assert len(chunks) > 1
    assert all(len(c) <= 100 for c in chunks)
    assert ing.chunk_text("") == []


@pytest.mark.asyncio
async def test_ingest_and_search():
    s = await reg.create_source("t1", "Policy", "bulk")
    assert s["status"] == "queued"
    await ing.ingest_text_content("t1", s["id"], "Policy", "30-day refund on electronics. " * 30)
    got = await reg.get_source(s["id"])
    assert got["status"] == "indexed" and got["chunk_count"] > 0

    hits = await reg.search_chunks("t1", "refund electronics", top_k=3)
    assert hits and "refund" in hits[0]["text"].lower()

    assert await reg.count_indexed_sources("t1") >= 1
    assert await reg.delete_source(s["id"]) is True


@pytest.mark.asyncio
async def test_missing_text_marks_failed():
    s = await reg.create_source("t2", "Empty", "bulk")
    await ing.ingest_text_content("t2", s["id"], "Empty", "   ")
    got = await reg.get_source(s["id"])
    assert got["status"] == "failed"
    await reg.delete_source(s["id"])
