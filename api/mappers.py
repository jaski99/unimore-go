"""Map engine domain objects to API response schemas (presentation only)."""

from __future__ import annotations

from api.schemas import (
    CalculationSchema,
    ItinerarySchema,
    LegSchema,
    NearbySchema,
    NoticeSchema,
    PlanResponseSchema,
    TrainInfoSchema,
)
from engine.models import Itinerary, Leg, PlanResult, TrainRun
from engine.notices import GENERIC, Notice, NoticeComposer, notice
from engine.service_calendar import pdf_reference
from engine.train_categories import category_code, category_group, requires_different_ticket


def train_info(train: TrainRun) -> TrainInfoSchema:
    return TrainInfoSchema(
        number=train.train,
        category=train.category,
        operator=train.operator,
        code=category_code(train.category),
        category_group=category_group(train.category),  # type: ignore[arg-type]
        different_ticket=requires_different_ticket(train.category),
        source=pdf_reference(train.source) if train.source else "",
    )


def leg_schema(leg: Leg) -> LegSchema:
    return LegSchema(
        leg_type=leg.leg_type,  # type: ignore[arg-type]
        from_location=leg.origin,
        to_location=leg.destination,
        depart=leg.depart,
        arrive=leg.arrive,
        minutes=leg.minutes,
        train=train_info(leg.train) if leg.train else None,
        notes=list(leg.notes),
    )


def itinerary_schema(itinerary: Itinerary) -> ItinerarySchema:
    return ItinerarySchema(
        leave_at=itinerary.leave_at,
        arrive_at=itinerary.arrive_at,
        slack_min=itinerary.slack_min,
        legs=[leg_schema(leg) for leg in itinerary.legs],
        date=itinerary.service_date,
        duration_min=itinerary.door_to_door_minutes,
        changes=itinerary.changes,
    )


def plan_response(
    result: PlanResult,
    trailing: list[Notice],
    composer: NoticeComposer | None = None,
) -> PlanResponseSchema:
    """Build the response; ``trailing`` notices (e.g. "non in tempo reale") go last
    in ``notices`` but first in the legacy ``warnings`` list (v0.4 contract)."""
    extra = [notice(GENERIC, w) for it in result.itineraries for w in it.warnings]
    notices = (composer or NoticeComposer()).compose([*result.notices, *extra, *trailing])
    leading = [n.message for n in trailing]
    warnings = leading + [n.message for n in notices if n.message not in leading]
    calculation = result.calculation
    return PlanResponseSchema(
        planner=result.planner,  # type: ignore[arg-type]
        itineraries=[itinerary_schema(it) for it in result.itineraries[:3]],
        nearby=[
            NearbySchema(
                kind=n.kind,  # type: ignore[arg-type]
                itinerary=itinerary_schema(n.itinerary),
                label=n.label,
            )
            for n in result.nearby
        ],
        calculation=(
            CalculationSchema(
                station=calculation.station, time=calculation.time, summary=calculation.summary
            )
            if calculation
            else None
        ),
        notices=[
            NoticeSchema(code=n.code, level=n.level, message=n.message)  # type: ignore[arg-type]
            for n in notices
        ],
        warnings=warnings,
    )
