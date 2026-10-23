"""Health check router for UnimoreGo API."""

from __future__ import annotations

from fastapi import APIRouter

from api.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["Monitoring"])

API_VERSION = "0.2.0"
DATA_VALID_TO = "2026-12-12"


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Stato del servizio e validità dati",
    description="Restituisce lo stato operativo dell'API, la versione corrente e la scadenza dell'orario ferroviario.",
)
async def health_check() -> HealthResponse:
    """Return operational health status and schedule validity boundary."""
    return HealthResponse(
        status="ok",
        data_valid_to=DATA_VALID_TO,
        version=API_VERSION,
    )
