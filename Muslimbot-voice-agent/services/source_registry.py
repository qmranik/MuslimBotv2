"""SQLite-backed knowledge-source registry + local chunk store.

Backs the /sources CRUD routes and the /health indexed-source count. Uses
aiosqlite so the dev/"SQLite keyword retrieval" path works with no GCP. Each
source row tracks ingestion status; chunks are stored in a companion table so
local retrieval (search_chunks) works without Vertex.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any, Optional

import aiosqlite

from services.config import DB_PATH

_SCHEMA = """
CREATE TABLE IF NOT EXISTS kb_sources (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    title        TEXT,
    source_type  TEXT,
    url          TEXT,
    status       TEXT DEFAULT 'queued',
    rag_file_id  TEXT,
    chunk_count  INTEGER DEFAULT 0,
    error        TEXT,
    created_at   REAL,
    updated_at   REAL
);
CREATE TABLE IF NOT EXISTS kb_chunks (
    id         TEXT PRIMARY KEY,
    source_id  TEXT NOT NULL,
    tenant_id  TEXT NOT NULL,
    title      TEXT,
    text       TEXT,
    ord        INTEGER,
    created_at REAL
);
CREATE INDEX IF NOT EXISTS idx_sources_tenant ON kb_sources(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_chunks_tenant ON kb_chunks(tenant_id);
"""


async def _conn() -> aiosqlite.Connection:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.executescript(_SCHEMA)
    await db.commit()
    return db


def _row(row: aiosqlite.Row) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


async def create_source(
    tenant_id: str, title: str, source_type: str, url: Optional[str] = None
) -> dict[str, Any]:
    sid = uuid.uuid4().hex[:16]
    now = time.time()
    db = await _conn()
    try:
        await db.execute(
            "INSERT INTO kb_sources (id, tenant_id, title, source_type, url, status, "
            "chunk_count, created_at, updated_at) VALUES (?,?,?,?,?,?,0,?,?)",
            (sid, tenant_id, title, source_type, url, "queued", now, now),
        )
        await db.commit()
        cur = await db.execute("SELECT * FROM kb_sources WHERE id = ?", (sid,))
        return _row(await cur.fetchone())
    finally:
        await db.close()


async def get_source(source_id: str) -> Optional[dict[str, Any]]:
    db = await _conn()
    try:
        cur = await db.execute("SELECT * FROM kb_sources WHERE id = ?", (source_id,))
        row = await cur.fetchone()
        return _row(row) if row else None
    finally:
        await db.close()


async def list_sources(
    tenant_id: str, page: int = 1, page_size: int = 20, status: Optional[str] = None
) -> dict[str, Any]:
    page = max(page, 1)
    offset = (page - 1) * page_size
    where = "WHERE tenant_id = ?"
    params: list[Any] = [tenant_id]
    if status:
        where += " AND status = ?"
        params.append(status)
    db = await _conn()
    try:
        cur = await db.execute(f"SELECT COUNT(*) AS n FROM kb_sources {where}", params)
        total = (await cur.fetchone())["n"]
        cur = await db.execute(
            f"SELECT * FROM kb_sources {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [*params, page_size, offset],
        )
        rows = [_row(r) for r in await cur.fetchall()]
        return {
            "sources": rows,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }
    finally:
        await db.close()


async def update_source(source_id: str, **fields: Any) -> None:
    if not fields:
        return
    fields["updated_at"] = time.time()
    cols = ", ".join(f"{k} = ?" for k in fields)
    db = await _conn()
    try:
        await db.execute(
            f"UPDATE kb_sources SET {cols} WHERE id = ?", [*fields.values(), source_id]
        )
        await db.commit()
    finally:
        await db.close()


async def delete_source(source_id: str) -> bool:
    db = await _conn()
    try:
        cur = await db.execute("DELETE FROM kb_sources WHERE id = ?", (source_id,))
        await db.execute("DELETE FROM kb_chunks WHERE source_id = ?", (source_id,))
        await db.commit()
        return cur.rowcount > 0
    finally:
        await db.close()


async def count_indexed_sources(tenant_id: str) -> int:
    db = await _conn()
    try:
        cur = await db.execute(
            "SELECT COUNT(*) AS n FROM kb_sources WHERE tenant_id = ? AND status = 'indexed'",
            (tenant_id,),
        )
        return (await cur.fetchone())["n"]
    finally:
        await db.close()


async def store_chunks(
    tenant_id: str, source_id: str, title: str, chunks: list[str]
) -> int:
    now = time.time()
    db = await _conn()
    try:
        # Replace any prior chunks for this source (re-sync safe).
        await db.execute("DELETE FROM kb_chunks WHERE source_id = ?", (source_id,))
        await db.executemany(
            "INSERT INTO kb_chunks (id, source_id, tenant_id, title, text, ord, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            [
                (uuid.uuid4().hex, source_id, tenant_id, title, text, i, now)
                for i, text in enumerate(chunks)
            ],
        )
        await db.commit()
        return len(chunks)
    finally:
        await db.close()


async def search_chunks(tenant_id: str, query: str, top_k: int = 8) -> list[dict[str, Any]]:
    """Naive keyword scoring over local chunks — the no-GCP dev retrieval path."""
    terms = [t for t in query.lower().split() if len(t) > 2]
    db = await _conn()
    try:
        cur = await db.execute(
            "SELECT c.text, c.title, c.source_id FROM kb_chunks c WHERE c.tenant_id = ?",
            (tenant_id,),
        )
        rows = await cur.fetchall()
    finally:
        await db.close()

    scored: list[tuple[int, dict[str, Any]]] = []
    for r in rows:
        text_l = (r["text"] or "").lower()
        score = sum(text_l.count(t) for t in terms) if terms else 0
        if score > 0:
            scored.append((score, {"text": r["text"], "title": r["title"], "source_id": r["source_id"], "score": score}))
    scored.sort(key=lambda s: s[0], reverse=True)
    return [item for _, item in scored[:top_k]]
