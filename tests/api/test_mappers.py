"""Tests for api/mappers.py (presentation mapping of engine objects)."""

from __future__ import annotations

from api.mappers import leg_schema, plan_response
from engine.models import Itinerary, Leg, ModeSuggestion, PlanResult, TrainRun

RUN = TrainRun(
    from_station="Reggio Emilia",
    to_station="Modena",
    depart="07:44",
    arrive="07:56",
    train="3907",
    category="Regionale Veloce",
    operator="Trenitalia Tper",
    days=("mon", "tue", "wed", "thu", "fri", "sat", "sun"),
    valid_from="2026-10-17",
    valid_to="2026-12-12",
    calendar_note="",
    source="Regionale_Emilia.pdf p.92",
)


def train_leg(festive_unverified: bool) -> Leg:
    return Leg(
        "train", "Reggio Emilia", "Modena", "07:44", "07:56", 12, RUN,
        festive_unverified=festive_unverified,
    )  # fmt: skip


def test_festive_flag_is_exposed_on_the_train() -> None:
    assert leg_schema(train_leg(True)).train.festive_unverified is True  # type: ignore[union-attr]
    assert leg_schema(train_leg(False)).train.festive_unverified is False  # type: ignore[union-attr]


def test_walk_legs_have_no_train() -> None:
    assert leg_schema(Leg("walk", "A", "B", "08:00", "08:10", 10)).train is None


def test_suggestion_is_mapped() -> None:
    walk = Leg("walk", "Modena", "DIEF", "07:57", "08:50", 53)
    itinerary = Itinerary("07:57", (walk,), "08:50", 10, service_date="2026-10-26")
    result = PlanResult(
        "arrive_by",
        (itinerary,),
        suggestion=ModeSuggestion("bike", 22, "In bici circa 22 min (a piedi 53 min)."),
    )
    response = plan_response(result, [])
    assert response.suggestion is not None
    assert response.suggestion.model_dump() == {
        "mode": "bike",
        "minutes": 22,
        "message": "In bici circa 22 min (a piedi 53 min).",
    }
    assert plan_response(PlanResult("arrive_by", ()), []).suggestion is None
