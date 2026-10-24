"""Health check router for UnimoreGo API."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import get_validity
from api.schemas import HealthResponse
from engine.validity import TimetableValidity

router = APIRouter(prefix="/api", tags=["Monitoring"])

API_VERSION = "0.7.0"


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Stato del servizio e validità dati",
    description="Restituisce lo stato operativo dell'API, la versione e la validità dell'orario (derivata dai dati).",
)
async def health_check(validity: TimetableValidity = Depends(get_validity)) -> HealthResponse:
    """Return operational health status and schedule validity boundaries."""
    return HealthResponse(
        status="ok",
        data_valid_from=validity.valid_from.isoformat(),
        data_valid_to=validity.valid_to.isoformat(),
        version=API_VERSION,
    )
