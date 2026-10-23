"""Campuses router for UnimoreGo API."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import get_location_repository
from api.schemas import CampusItem
from engine.repositories import LocationRepository

router = APIRouter(prefix="/api", tags=["Locations"])


@router.get(
    "/campuses",
    response_model=list[CampusItem],
    summary="Elenco delle sedi didattiche UNIMORE",
    description="Restituisce la lista di tutti i dipartimenti e campus universitari supportati con relative coordinate.",
)
async def list_campuses(
    loc_repo: LocationRepository = Depends(get_location_repository),
) -> list[CampusItem]:
    """Return all configured UNIMORE campuses."""
    campuses = loc_repo.all_campuses()
    return [
        CampusItem(
            id=c.id,
            name=c.name,
            city=c.city,
            lat=c.lat,
            lon=c.lon,
        )
        for c in campuses
    ]
