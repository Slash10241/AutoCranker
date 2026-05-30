"""FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.dashboard import router as dashboard_router
from app.channels.whatsapp import router as whatsapp_router
from app.config import get_settings
from app.db.seed import seed_demo_data
from app.db.session import get_session_factory, init_db, migrate_db
from app.services import init_services


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    _configure_logging()
    settings = get_settings()
    services = init_services(settings)
    logger = logging.getLogger("app.main")

    # Initialise database and run migrations + seed.
    init_db()
    migrate_db()
    factory = get_session_factory()
    with factory() as db:
        seed_demo_data(db)

    logger.info(
        "AutoCranker starting: debug=%s app=%r secret_set=%s llm_available=%s",
        settings.debug,
        settings.app_name,
        bool(settings.make_webhook_secret),
        services.llm_client.available,
    )
    yield
    logger.info("AutoCranker shutting down")


app = FastAPI(title="AutoCranker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> Dict[str, str]:
    return {"service": "autocranker", "status": "ok"}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


app.include_router(whatsapp_router)
app.include_router(chat_router)
app.include_router(dashboard_router)


if get_settings().debug:

    @app.post("/debug/echo")
    async def debug_echo(request: Request) -> Dict[str, Any]:
        body = await request.body()
        try:
            payload = await request.json()
        except Exception:
            payload = None
        return {
            "headers": dict(request.headers),
            "raw_body": body.decode("utf-8", errors="replace"),
            "json": payload,
        }
