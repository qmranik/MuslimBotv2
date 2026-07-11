"""Knowledge source CRUD routes."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from services import ingest_pipeline, source_registry
from services.config import tenant_id
from services.scrape_adapter import classify_url
from routes.dependencies import verify_kb_api_key, get_tenant_id

router = APIRouter(prefix="/sources", tags=["sources"], dependencies=[Depends(verify_kb_api_key)])


class UrlSourceRequest(BaseModel):
    title: str = ""
    url: str
    depth: int | None = Field(default=None, ge=0, le=3)


@router.post("/url/classify")
async def classify_source_url(body: UrlSourceRequest) -> dict[str, Any]:
    classification = classify_url(body.url)
    return {
        "url_type": classification.url_type,
        "depth_default": classification.depth_default,
        "normalized_url": classification.normalized_url,
    }


@router.post("/url")
async def add_url_source(
    background_tasks: BackgroundTasks,
    body: UrlSourceRequest,
) -> dict[str, Any]:
    tenant_id = _tenant()
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    classification = classify_url(url)
    display_title = body.title.strip() or classification.normalized_url
    source_type = classification.url_type if classification.url_type != "website" else "scrape"
    depth = body.depth if body.depth is not None else classification.depth_default

    source = await source_registry.create_source(
        tenant_id,
        display_title,
        source_type,
        url=classification.normalized_url,
    )
    background_tasks.add_task(
        ingest_pipeline.ingest_url,
        tenant_id,
        source["id"],
        display_title,
        classification.normalized_url,
        depth,
    )
    return {
        "source": source["id"],
        "status": "scrape_queued",
        "url_type": classification.url_type,
        "depth": depth,
    }


def _tenant() -> str:
    return tenant_id


@router.get("")
async def list_sources(page: int = 1, page_size: int = 20, status: str = "") -> dict[str, Any]:
    return await source_registry.list_sources(
        _tenant(),
        page=page,
        page_size=min(page_size, 100),
        status=status or None,
    )


@router.get("/{source_id}")
async def get_source(source_id: str) -> dict[str, Any]:
    source = await source_registry.get_source(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.post("/upload")
async def upload_source(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(""),
    source_type: str = Form("document"),
) -> dict[str, Any]:
    tenant_id = _tenant()
    filename = file.filename or "upload.bin"
    display_title = title.strip() or filename
    source = await source_registry.create_source(tenant_id, display_title, source_type or "document")
    data = await file.read()

    background_tasks.add_task(
        ingest_pipeline.ingest_file_bytes,
        tenant_id,
        source["id"],
        filename,
        data,
        display_title,
    )
    return {"source": source["id"], "status": "queued"}


@router.post("/link")
async def add_link(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    url: str = Form(...),
) -> dict[str, Any]:
    tenant_id = _tenant()
    source = await source_registry.create_source(tenant_id, title, "link", url=url)
    background_tasks.add_task(ingest_pipeline.ingest_link, tenant_id, source["id"], title, url)
    return {"source": source["id"], "status": "scrape_queued"}


@router.post("/scrape")
async def add_scrape(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    url: str = Form(...),
    depth: int = Form(1),
) -> dict[str, Any]:
    tenant_id = _tenant()
    source = await source_registry.create_source(tenant_id, title, "scrape", url=url)
    background_tasks.add_task(
        ingest_pipeline.ingest_scrape,
        tenant_id,
        source["id"],
        title,
        url,
        min(int(depth), 3),
    )
    return {"source": source["id"], "status": "scrape_queued"}


@router.post("/bulk")
async def add_bulk(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    content: str = Form(""),
    pages_json: str = Form(""),
) -> dict[str, Any]:
    tenant_id = _tenant()
    source = await source_registry.create_source(tenant_id, title, "bulk")

    if pages_json.strip():
        try:
            pages = json.loads(pages_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid pages_json") from exc
        background_tasks.add_task(
            ingest_pipeline.ingest_bulk_pages,
            tenant_id,
            source["id"],
            title,
            pages,
        )
    elif content.strip():
        background_tasks.add_task(
            ingest_pipeline.ingest_text_content,
            tenant_id,
            source["id"],
            title,
            content,
            "bulk.md",
        )
    else:
        raise HTTPException(status_code=400, detail="content or pages_json required")

    return {"source": source["id"], "status": "queued"}


@router.post("/{source_id}/sync")
async def trigger_sync(source_id: str, background_tasks: BackgroundTasks) -> dict[str, str]:
    source = await source_registry.get_source(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    background_tasks.add_task(ingest_pipeline.resync_source, _tenant(), source_id)
    return {"source": source_id, "status": "queued"}


@router.delete("/{source_id}")
async def delete_source(source_id: str) -> dict[str, str]:
    source = await source_registry.get_source(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    rag_file_id = source.get("rag_file_id")
    if rag_file_id:
        from services import rag_vertex

        await rag_vertex.delete_rag_file(_tenant(), rag_file_id)
    deleted = await source_registry.delete_source(source_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Source not found")
    return {"deleted": source_id}
