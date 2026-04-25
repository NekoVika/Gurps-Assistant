from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gurpsai.api.routers.chat import router as chat_router
from gurpsai.api.routers.files import router as files_router
from gurpsai.api.routers.health import router as health_router
from gurpsai.api.routers.providers import router as providers_router
from gurpsai.api.routers.rules import router as rules_router
from gurpsai.api.routers.settings import router as settings_router
from gurpsai.api.routers.campaign import router as campaign_router
from gurpsai.api.routers.sessions import router as sessions_router
from gurpsai.api.routers.activity import router as activity_router
from gurpsai.api.routers.update import router as update_router

import sys
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from gurpsai.app.config import ROOT

STATIC_DIR = ROOT / "web" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(
        title="GURPS AI Local App API",
        version="0.2.0",
        description="Local-first backend for GURPS AI workflows, rules retrieval, and provider orchestration.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(chat_router)
    app.include_router(files_router)
    app.include_router(health_router)
    app.include_router(providers_router)
    app.include_router(rules_router)
    app.include_router(settings_router)
    app.include_router(campaign_router)
    app.include_router(sessions_router)
    app.include_router(activity_router)
    app.include_router(update_router)

    # SPA Serve (Serve this last as Catch-All)
    if STATIC_DIR.exists():
        # Mount the assets directory explicitly so Vite's /assets/* URLs work
        assets_dir = STATIC_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            target = STATIC_DIR / full_path
            # If the specific file exists, return it (e.g. vite.svg, favicon.ico)
            if target.is_file():
                return FileResponse(target)
            # Otherwise return index.html to let React Router handle the path
            return FileResponse(STATIC_DIR / "index.html")
    else:
        @app.get("/")
        def root():
            return {"message": "GURPS Assistant backend is running. (UI not built in root/web/dist)"}

    return app


app = create_app()
