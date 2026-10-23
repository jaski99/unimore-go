"""Stations router for UnimoreGo API."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import get_location_repository
from api.schemas import StationItem
from engine.repositories import LocationRepository

router = APIRouter(prefix="/api", tags=["Locations"])


@router.get(
    "/stations",
    response_model=list[StationItem],
    summary="Elenco delle stazioni ferroviarie di riferimento",
    description="Restituisce le stazioni ferroviarie servite lungo l'asse Modena FS <-> Reggio Emilia FS.",
)
async def list_stations(
    loc_repo: LocationRepository = Depends(get_location_repository),
) -> list[StationItem]:
    """Return all railway stations."""
    stations = loc_repo.all_stations()
    return [
        StationItem(
            id=s.id,
            name=s.name,
            city=s.city,
            lat=s.lat,
            lon=s.lon,
        )
        for s in stations
    ]
