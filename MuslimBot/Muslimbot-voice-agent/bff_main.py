"""
MuslimBot KB BFF — FastAPI application entry point.
Run: uvicorn bff_main:app --host 0.0.0.0 --port 8787
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.config import CORS_ORIGINS
from routes.health import router as health_router
from routes.sources import router as sources_router
from routes.retrieve import router as retrieve_router
from routes.chat import router as chat_router
from routes.voice import router as voice_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.erp_client import get_http_session
    from services.voice_brief import rebuild
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    import logging
    
    await get_http_session()
    
    scheduler = AsyncIOScheduler()
    scheduler.add_job(rebuild, 'cron', hour=2, minute=0)
    scheduler.start()
    logging.getLogger("muslimbot").info("Started APScheduler for daily voice brief rebuild at 02:00")
    
    yield
    from services.erp_client import close_http_session
    scheduler.shutdown()
    await close_http_session()


app = FastAPI(
    title="MuslimBot KB BFF",
    description="Knowledge Hub Backend-for-Frontend — RAG, voice sessions, chat",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(sources_router)
app.include_router(retrieve_router)
app.include_router(chat_router)
app.include_router(voice_router)
