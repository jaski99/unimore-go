"""Tests for the journey planners (engine/journeys) and the Planner registry.

Expected times come from data/trains.json (Trenitalia Regionale_Emilia.pdf,
edition 17/10-12/12/2026) and data/segments.json.
"""

from __future__ import annotations

import pytest

from engine.journeys import JourneyPlanner, PlanningContext
from engine.models import Itinerary, Leg, PlanRequest, PlanResult
from engine.planner import Planner
from engine.repositories import JsonLocationRepository, JsonSegmentRepository, JsonTrainRepository
from engine.train_categories import HIGH_SPEED, INTERCITY, REGIONAL

REGIONAL_ONLY = frozenset({REGIONAL})


@pytest.fixture(scope="module")
def planner() -> Planner:
    return Planner(JsonTrainRepository(), JsonLocationRepository(), JsonSegmentRepository())


def req(**kwargs) -> PlanRequest:
    base = {
        "target_date": "2026-10-26",
        "target_time": "08:30",
        "destination_campus_id": "dief",
        "origin_station_id": "reggio_fs",
        "first_mile_mode": "bike",
        "last_mile_mode": "bike",
    }
    base.update(kwargs)
    return PlanRequest(**base)


def train(it: Itinerary) -> Leg:
    return next(leg for leg in it.legs if leg.leg_type == "train")


def kinds(it: Itinerary) -> list[str]:
    return [leg.leg_type for leg in it.legs]


# --- station buffer and zero-minute legs ------------------------------------------


def test_station_buffer_makes_leave_time_earlier_than_train(planner: Planner) -> None:
    best = planner.plan(req(train_categories=REGIONAL_ONLY)).itineraries[0]
    assert train(best).train is not None and train(best).train.train == "3907"
    assert best.leave_at == "07:39"
    assert train(best).depart == "07:44"
    assert kinds(best) == ["wait", "train", "bike"]
    assert best.legs[0].minutes == 5
    assert (best.arrive_at, best.slack_min) == ("08:18", 12)


def test_configurable_buffer(planner: Planner) -> None:
    best = planner.plan(req(station_buffer_minutes=12, train_categories=REGIONAL_ONLY)).itineraries[
        0
    ]
    assert best.legs[0].minutes == 12
    zero = planner.plan(req(station_buffer_minutes=0, train_categories=REGIONAL_ONLY)).itineraries[
        0
    ]
    assert kinds(zero) == ["train", "bike"]  # no 0-minute wait leg


def test_no_zero_minute_legs_anywhere(planner: Planner) -> None:
    for planner_name in ("arrive_by", "depart_after"):
        result = planner.plan(req(target_time="13:00"), planner_name)
        assert result.itineraries
        for it in result.itineraries:
            assert all(leg.minutes > 0 for leg in it.legs)


def test_home_leg_then_buffer(planner: Planner) -> None:
    best = planner.plan(req(first_mile_minutes=10, train_categories=REGIONAL_ONLY)).itineraries[0]
    assert kinds(best) == ["bike", "wait", "train", "bike"]
    assert best.leave_at == "07:29"
    assert best.legs[0].origin == "Casa"


# --- train categories --------------------------------------------------------------


def test_regional_filter_excludes_fr_and_ic(planner: Planner) -> None:
    every = planner.plan(req()).itineraries
    assert "Frecciarossa" in {train(it).train.category for it in every}
    regional = planner.plan(req(train_categories=REGIONAL_ONLY)).itineraries
    assert {train(it).train.category for it in regional} <= {"Regionale", "Regionale Veloce"}
    assert [train(it).train.train for it in regional] == ["3907", "17405", "2451"]


def test_only_high_speed(planner: Planner) -> None:
    result = planner.plan(req(train_categories=frozenset({HIGH_SPEED})))
    assert {train(it).train.category for it in result.itineraries} == {"Frecciarossa"}


def test_category_hint_in_no_train_warning(planner: Planner) -> None:
    regional = planner.plan(req(target_time="05:00", train_categories=REGIONAL_ONLY))
    assert any("solo treni regionali" in w for w in regional.warnings)
    mixed = planner.plan(
        req(target_time="05:00", train_categories=frozenset({REGIONAL, INTERCITY}))
    )
    assert any("filtro sul tipo di treno" in w for w in mixed.warnings)
    every = planner.plan(req(target_time="05:00"))
    assert not any("filtro" in w or "regionali" in w for w in every.warnings)


# --- calendar notes ------------------------------------------------------------------


def test_calendar_note_removes_run_after_its_end_date(planner: Planner) -> None:
    # RV 3907: "Nota 35: si effettua fino al 16/11" (PDF page 75)
    result = planner.plan(req(target_date="2026-11-17", train_categories=REGIONAL_ONLY))
    numbers = [train(it).train.train for it in result.itineraries]
    assert "3907" not in numbers
    assert numbers[0] == "17405"


def test_uninterpretable_note_is_reported_on_the_leg(planner: Planner) -> None:
    result = planner.plan(req())
    fr = next(it for it in result.itineraries if train(it).train.category == "Frecciarossa")
    assert fr.legs[1].notes and "pag. 74" in train(fr).notes[0]


def test_duplicate_slots_are_shown_once(planner: Planner) -> None:
    # 14:23 Modena->Reggio is printed twice in the PDF (RV 2474 and RV 2490)
    result = planner.plan(req(target_time="13:00", train_categories=REGIONAL_ONLY), "depart_after")
    departures = [train(it).depart for it in result.itineraries]
    assert len(departures) == len(set(departures))


# --- robustness: night, holidays, validity ---------------------------------------


def test_night_lesson_offers_previous_and_next(planner: Planner) -> None:
    result = planner.plan(req(target_time="05:00", train_categories=REGIONAL_ONLY))
    assert result.itineraries == ()
    assert any(w.startswith("Nessun treno utile") for w in result.warnings)
    previous, following = result.nearby
    assert previous.kind == "previous" and previous.itinerary.service_date == "2026-10-25"
    assert train(previous.itinerary).depart == "22:43"
    assert following.kind == "next" and following.itinerary.service_date == "2026-10-26"
    assert train(following.itinerary).depart == "06:19"
    assert following.itinerary.slack_min < 0  # arrives after the lesson start


def test_weekday_holiday_warns_and_uses_sunday_runs(planner: Planner) -> None:
    result = planner.plan(req(target_date="2026-12-08", train_categories=REGIONAL_ONLY))
    assert any("festivo (Immacolata Concezione)" in w for w in result.warnings)
    assert result.itineraries == ()
    assert {n.kind for n in result.nearby} == {"previous", "next"}


def test_sunday_warning(planner: Planner) -> None:
    result = planner.plan(req(target_date="2026-10-25"))
    assert any("domenica" in w for w in result.warnings)


def test_after_validity_has_explicit_warning_and_previous_solution(planner: Planner) -> None:
    result = planner.plan(req(target_date="2026-12-14"))
    assert result.itineraries == ()
    assert any("dopo la fine di validità" in w and "12/12/2026" in w for w in result.warnings)
    assert [n.kind for n in result.nearby] == ["previous"]
    assert result.nearby[0].itinerary.service_date == "2026-12-12"


def test_far_future_date_has_no_nearby_solutions(planner: Planner) -> None:
    result = planner.plan(req(target_date="2027-03-01"))
    assert result.itineraries == () and result.nearby == ()


# --- same city: never a train ----------------------------------------------------------


@pytest.mark.parametrize(
    ("campus", "origin", "mode", "expected_minutes"),
    [
        ("dief", {"origin_station_id": "modena_fs"}, "bike", 22),  # Modena -> Modena
        ("dief", {"origin_coords": (44.6500, 10.9300)}, "bike", 15),
        ("campus_san_lazzaro", {"origin_station_id": "reggio_fs"}, "bike", 11),  # Reggio -> Reggio
        ("palazzo_dossetti", {"origin_coords": (44.698, 10.635)}, "walk", 13),
    ],
)
def test_same_city_is_direct_without_train(
    planner: Planner, campus: str, origin: dict, mode: str, expected_minutes: int
) -> None:
    kwargs = {"origin_station_id": None, **origin}
    for name in ("arrive_by", "depart_after"):
        result = planner.plan(
            req(destination_campus_id=campus, last_mile_mode=mode, first_mile_mode=mode, **kwargs),
            name,
        )
        (it,) = result.itineraries
        assert kinds(it) == [mode]
        assert it.legs[0].minutes == expected_minutes
        assert any("stessa città" in w for w in result.warnings)
        assert not any("stimato" in w for w in result.warnings)


def test_same_city_home_minutes_are_not_used_as_direct_time(planner: Planner) -> None:
    result = planner.plan(req(origin_station_id="modena_fs", first_mile_minutes=12))
    (it,) = result.itineraries
    assert it.legs[0].minutes == 22  # Modena FS -> DIEF by bike, not the 12 home minutes
    assert any("Posizione di casa non indicata" in w for w in result.warnings)


def test_same_city_arrive_by_respects_margin(planner: Planner) -> None:
    (it,) = planner.plan(req(origin_station_id="modena_fs", margin_minutes=10)).itineraries
    assert (it.leave_at, it.arrive_at, it.slack_min) == ("07:58", "08:20", 10)


# --- depart_after (return trip) ---------------------------------------------------------


def test_return_trip_first_solution_after_lesson(planner: Planner) -> None:
    result = planner.plan(req(target_time="13:00", train_categories=REGIONAL_ONLY), "depart_after")
    assert result.planner == "depart_after"
    first = result.itineraries[0]
    assert kinds(first) == ["bike", "wait", "train"]
    assert first.legs[0].origin.startswith("Dipartimento di Ingegneria")
    assert (first.leave_at, train(first).depart, first.arrive_at) == ("13:33", "14:00", "14:17")
    assert first.slack_min == 33
    departures = [train(it).depart for it in result.itineraries]
    assert departures == sorted(departures)


def test_return_trip_with_home_leg(planner: Planner) -> None:
    result = planner.plan(
        req(
            destination_campus_id="palazzo_dossetti",
            origin_station_id="modena_fs",
            first_mile_minutes=12,
            first_mile_mode="walk",
            last_mile_mode="walk",
            target_time="17:00",
            train_categories=REGIONAL_ONLY,
        ),
        "depart_after",
    )
    first = result.itineraries[0]
    assert kinds(first) == ["walk", "wait", "train", "walk"]
    assert (first.leave_at, train(first).depart, first.arrive_at) == ("17:13", "17:37", "18:02")
    assert first.legs[-1].destination == "Casa"


def test_return_trip_too_late_offers_previous_and_next(planner: Planner) -> None:
    result = planner.plan(req(target_time="23:30", train_categories=REGIONAL_ONLY), "depart_after")
    assert result.itineraries == ()
    previous, following = result.nearby
    assert previous.kind == "previous" and previous.itinerary.slack_min < 0
    assert following.kind == "next" and following.itinerary.service_date == "2026-10-27"


def test_return_trip_without_trains_that_day_searches_previous_days(planner: Planner) -> None:
    result = planner.plan(req(target_date="2026-12-14", target_time="13:00"), "depart_after")
    assert [n.kind for n in result.nearby] == ["previous"]
    assert result.nearby[0].itinerary.service_date == "2026-12-12"


# --- registry -------------------------------------------------------------------------------


class _EchoPlanner(JourneyPlanner):
    name = "echo"

    def plan(self, request: PlanRequest, ctx: PlanningContext) -> PlanResult:
        return PlanResult(self.name, (), (f"campus={request.destination_campus_id}",))


def test_planners_are_registered_by_name(planner: Planner) -> None:
    assert planner.available_planners == ("arrive_by", "depart_after")
    assert planner.depart_after(req(target_time="13:00"))
    with pytest.raises(ValueError, match="Unknown planner"):
        planner.plan(req(), "teleport")


def test_new_journey_planner_without_touching_planner() -> None:
    custom = Planner(
        JsonTrainRepository(),
        JsonLocationRepository(),
        JsonSegmentRepository(),
        journey_planners=[_EchoPlanner()],
    )
    assert custom.available_planners == ("echo",)
    assert custom.plan(req(), "echo").warnings == ("campus=dief",)
    custom.register(_EchoPlanner())
    assert custom.available_planners == ("echo",)


def test_planner_without_trains_has_no_validity() -> None:
    class NoTrains(JsonTrainRepository):
        def all_trains(self):  # type: ignore[override]
            return []

        def get_trains(self, from_station, to_station):  # type: ignore[override]
            return []

    empty = Planner(NoTrains(), JsonLocationRepository(), JsonSegmentRepository())
    assert empty.validity is None
    result = empty.plan(req())
    assert result.itineraries == () and result.nearby == ()
