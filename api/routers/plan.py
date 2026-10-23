"""Trip planning router for UnimoreGo API."""

from __future__ import annotations

import math
import zoneinfo
from datetime import date, datetime

from fastapi import APIRouter, Depends

from api.deps import get_location_repository, get_planner
from api.errors import APIError, error_response_docs
from api.schemas import (
    ItinerarySchema,
    LegSchema,
    OriginCoords,
    OriginStation,
    PlanRequestSchema,
    PlanResponseSchema,
    TrainInfoSchema,
)
from engine.legs import haversine_distance_m
from engine.models import PlanRequest
from engine.planner import Planner
from engine.repositories import LocationRepository

router = APIRouter(prefix="/api", tags=["Planning"], responses=error_response_docs())

ROME_TZ = zoneinfo.ZoneInfo("Europe/Rome")
SCHEDULE_EXPIRY = date(2026, 12, 12)
SCHEDULE_START = date(2026, 10, 17)


@router.post(
    "/plan",
    response_model=PlanResponseSchema,
    summary="Calcola orario di uscita di casa e itinerari pendolari",
    description="Calcola fino a 3 migliori itinerari door-to-door (ordinati per partenza più tardiva) per giungere alla sede UNIMORE prima dell'orario stabilito.",
)
async def plan_trip(
    body: PlanRequestSchema,
    planner: Planner = Depends(get_planner),
    loc_repo: LocationRepository = Depends(get_location_repository),
) -> PlanResponseSchema:
    """Plan door-to-door commuter itinerary according to UnimoreGo domain rules."""
    # 1. Validate target campus
    campus = loc_repo.get_campus(body.campus_id)
    if not campus:
        raise APIError(
            status_code=404,
            detail=f"Campus non trovato: {body.campus_id}",
            code="NOT_FOUND",
        )

    # 2. Parse and normalize arrival time with Europe/Rome timezone
    try:
        dt = datetime.fromisoformat(body.arrive_by)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ROME_TZ)
        else:
            dt = dt.astimezone(ROME_TZ)
    except Exception as exc:
        raise APIError(
            status_code=422,
            detail=f"Formato arrive_by non valido: {body.arrive_by}. Richiesto formato ISO 8601.",
            code="VALIDATION_ERROR",
        ) from exc

    target_date = dt.date()
    target_time_str = dt.strftime("%H:%M")

    warnings: list[str] = [
        "Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale)."
    ]

    # Check schedule validity window
    if not (SCHEDULE_START <= target_date <= SCHEDULE_EXPIRY):
        warnings.append(
            f"Data richiesta al di fuori del periodo di validità dell'orario ufficiale (scade il {SCHEDULE_EXPIRY.strftime('%d/%m/%Y')})."
        )

    # 3. Resolve origin
    origin_station_id: str | None = None
    origin_coords: tuple[float, float] | None = None
    origin_city: str | None = None
    home_to_station_min: int | None = body.home_to_station_min

    if isinstance(body.origin, OriginStation):
        st = loc_repo.get_station(body.origin.station_id)
        if not st:
            raise APIError(
                status_code=404,
                detail=f"Stazione non trovata: {body.origin.station_id}",
                code="NOT_FOUND",
            )
        origin_station_id = st.id
        origin_city = st.city
        if home_to_station_min is None:
            home_to_station_min = 0

    elif isinstance(body.origin, OriginCoords):
        origin_coords = (body.origin.lat, body.origin.lon)
        all_stations = loc_repo.all_stations()

        # Find closest station
        closest_st = None
        min_dist_m = float("inf")
        for st in all_stations:
            dist = haversine_distance_m(body.origin.lat, body.origin.lon, st.lat, st.lon)
            if dist < min_dist_m:
                min_dist_m = dist
                closest_st = st

        if closest_st:
            origin_city = closest_st.city

            # Warning if far from station (> 10 km)
            if min_dist_m > 10000.0:
                warnings.append(
                    "Attenzione: il punto di partenza si trova a oltre 10 km dalla stazione ferroviaria più vicina."
                )

    # Check if origin city matches campus city
    is_same_city = (origin_city or "").lower().strip() == campus.city.lower().strip()

    if is_same_city:
        warnings.append(
            "Origine e destinazione nella stessa città: percorso diretto a piedi/bici (nessun treno necessario)."
        )
    else:
        # Inter-city: requires train. Estimate first mile to station if origin coords and not specified.
        if origin_coords and home_to_station_min is None and closest_st:
            speed_kmh = 15.0 if body.mode == "bike" else 4.5
            dist_km = (min_dist_m / 1000.0) * 1.3
            est_min = max(1, math.ceil((dist_km / speed_kmh) * 60.0))
            mode_label = "in bicicletta" if body.mode == "bike" else "a piedi"
            warnings.append(
                f"Stima primo tratto casa->stazione: {est_min} minuti {mode_label} basata su distanza stradale stimata (~{dist_km:.1f} km)."
            )
            home_to_station_min = est_min

    # 4. Invoke domain planner
    plan_req = PlanRequest(
        target_date=target_date,
        target_time=target_time_str,
        destination_campus_id=body.campus_id,
        origin_station_id=origin_station_id,
        origin_coords=origin_coords,
        origin_city=origin_city,
        first_mile_mode=body.mode,
        first_mile_minutes=home_to_station_min,
        last_mile_mode=body.mode,
        margin_minutes=body.margin_min,
    )

    domain_itineraries = planner.arrive_by(plan_req)

    # If different cities and no trains found
    if not domain_itineraries and not is_same_city:
        warnings.append("Nessun treno disponibile per i criteri specificati.")

    # 5. Format response schemas
    itinerary_schemas: list[ItinerarySchema] = []
    for it in domain_itineraries:
        leg_schemas: list[LegSchema] = []
        for leg in it.legs:
            train_info = None
            if leg.train:
                train_info = TrainInfoSchema(
                    number=leg.train.train,
                    category=leg.train.category,
                    operator=leg.train.operator,
                )
            leg_schemas.append(
                LegSchema(
                    leg_type=leg.leg_type,  # type: ignore[arg-type]
                    from_location=leg.origin,
                    to_location=leg.destination,
                    depart=leg.depart,
                    arrive=leg.arrive,
                    minutes=leg.minutes,
                    train=train_info,
                )
            )

        itinerary_schemas.append(
            ItinerarySchema(
                leave_at=it.leave_at,
                arrive_at=it.arrive_at,
                slack_min=it.slack_min,
                legs=leg_schemas,
            )
        )

        # Append any itinerary-level warnings
        for w in it.warnings:
            if w not in warnings:
                warnings.append(w)

    return PlanResponseSchema(
        itineraries=itinerary_schemas[:3],
        warnings=warnings,
    )
