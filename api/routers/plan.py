"""Trip planning router for UnimoreGo API (thin adapter over the engine)."""

from __future__ import annotations

import zoneinfo
from datetime import datetime

from fastapi import APIRouter, Depends

from api.deps import get_location_repository, get_planner
from api.errors import APIError, error_response_docs
from api.mappers import plan_response
from api.schemas import OriginCoords, OriginStation, PlanRequestSchema, PlanResponseSchema
from engine.models import PlanRequest
from engine.planner import Planner
from engine.repositories import LocationRepository
from engine.train_categories import normalize_groups

router = APIRouter(prefix="/api", tags=["Planning"], responses=error_response_docs())

ROME_TZ = zoneinfo.ZoneInfo("Europe/Rome")
NOT_REALTIME = "Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale)."


def _parse_rome(value: str, field: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value)
    except ValueError as exc:
        raise APIError(
            status_code=422,
            detail=f"Formato {field} non valido: {value}. Richiesto formato ISO 8601.",
            code="VALIDATION_ERROR",
        ) from exc
    return dt.replace(tzinfo=ROME_TZ) if dt.tzinfo is None else dt.astimezone(ROME_TZ)


@router.post(
    "/plan",
    response_model=PlanResponseSchema,
    summary="Calcola quando uscire (andata) o quando partire (ritorno)",
    description=(
        "Con arrive_by: fino a 3 itinerari door-to-door per arrivare alla sede prima dell'inizio "
        "lezione (uscita più tardiva per prima). Con depart_after: le prime soluzioni dalla sede "
        "alla stazione di casa dopo la fine della lezione. Se nessun treno è utile restituisce "
        "la soluzione precedente e/o successiva in 'nearby'."
    ),
)
async def plan_trip(
    body: PlanRequestSchema,
    planner: Planner = Depends(get_planner),
    loc_repo: LocationRepository = Depends(get_location_repository),
) -> PlanResponseSchema:
    """Validate the request, delegate to the registered journey planner, map the result."""
    if not loc_repo.get_campus(body.campus_id):
        raise APIError(404, f"Campus non trovato: {body.campus_id}", code="NOT_FOUND")

    station_id: str | None = None
    coords: tuple[float, float] | None = None
    if isinstance(body.origin, OriginStation):
        if not loc_repo.get_station(body.origin.station_id):
            raise APIError(404, f"Stazione non trovata: {body.origin.station_id}", code="NOT_FOUND")
        station_id = body.origin.station_id
    elif isinstance(body.origin, OriginCoords):
        coords = (body.origin.lat, body.origin.lon)

    field = "arrive_by" if body.arrive_by is not None else "depart_after"
    when = _parse_rome(body.target, field)
    request = PlanRequest(
        target_date=when.date(),
        target_time=when.strftime("%H:%M"),
        destination_campus_id=body.campus_id,
        origin_station_id=station_id,
        origin_coords=coords,
        first_mile_mode=body.mode,
        first_mile_minutes=body.home_to_station_min,
        last_mile_mode=body.mode,
        margin_minutes=body.margin_min,
        station_buffer_minutes=body.station_buffer_min,
        train_categories=normalize_groups(body.train_categories),
    )
    result = planner.plan(request, body.planner_name)
    return plan_response(result, [NOT_REALTIME])
