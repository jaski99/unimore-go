"""Main FastAPI application module for UnimoreGo.

Provides create_app factory with configurable CORS, uniform error handling,
and modular router aggregation.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from api.errors import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from api.routers import (
    campuses_router,
    health_router,
    plan_router,
    stations_router,
)
from api.routers.health import API_VERSION
from api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory for UnimoreGo API.

    ``settings`` defaults to values read from the environment at call time.
    """
    settings = settings or Settings.from_env()
    app = FastAPI(
        title="UnimoreGo API",
        version=API_VERSION,
        description=(
            "API REST per studenti pendolari UNIMORE sull'asse Modena FS <-> Reggio Emilia FS. "
            "Calcola orario di uscita di casa (partenza + margine), treni utili e tratti attivi a piedi/bici."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # 1. CORS: origins come from settings (env CORS_ORIGINS, comma separated).
    # The frontend sends no cookies, so credentials stay disabled; this also
    # keeps a wildcard origin from being combined with credentials.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    # 2. Uniform Exception Handlers
    app.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, generic_exception_handler)

    # 3. Include Routers
    app.include_router(health_router)
    app.include_router(campuses_router)
    app.include_router(stations_router)
    app.include_router(plan_router)

    return app


app = create_app()


def run() -> None:  # pragma: no cover - thin CLI wrapper around uvicorn
    """Console entry point: serve the API with uvicorn (HOST/PORT from env)."""
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
    )
