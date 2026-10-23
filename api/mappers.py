"""Map engine domain objects to API response schemas (presentation only)."""

from __future__ import annotations

from api.schemas import (
    ItinerarySchema,
    LegSchema,
    NearbySchema,
    PlanResponseSchema,
    TrainInfoSchema,
)
from engine.models import Itinerary, Leg, PlanResult, TrainRun
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
    )


def plan_response(result: PlanResult, leading_warnings: list[str]) -> PlanResponseSchema:
    warnings = list(leading_warnings)
    for warning in [*result.warnings, *(w for it in result.itineraries for w in it.warnings)]:
        if warning not in warnings:
            warnings.append(warning)
    return PlanResponseSchema(
        planner=result.planner,  # type: ignore[arg-type]
        itineraries=[itinerary_schema(it) for it in result.itineraries[:3]],
        nearby=[
            NearbySchema(kind=n.kind, itinerary=itinerary_schema(n.itinerary))  # type: ignore[arg-type]
            for n in result.nearby
        ],
        warnings=warnings,
    )
