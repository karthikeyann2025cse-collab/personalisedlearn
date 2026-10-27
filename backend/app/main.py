"""
LearnOn — FastAPI Application Entry Point
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.db.session import create_all_tables

# Import routers
from app.api import auth, documents, chat, quiz, sessions, analytics, planner, profile, ml_api

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Create all DB tables (for SQLite dev — use Alembic for PostgreSQL)
    await create_all_tables()

    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.vector_store_path, exist_ok=True)
    os.makedirs(settings.ml_models_path, exist_ok=True)

    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title="LearnOn API",
    description="AI-Powered Personalized and Adaptive Learning Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
API_PREFIX = "/api"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(quiz.router, prefix=API_PREFIX)
app.include_router(sessions.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(planner.router, prefix=API_PREFIX)
app.include_router(profile.router, prefix=API_PREFIX)
app.include_router(ml_api.router, prefix=API_PREFIX)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
