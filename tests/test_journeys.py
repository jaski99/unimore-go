"""Tests for the journey planners (engine/journeys) and the Planner registry.

Expected times come from data/trains.json (Trenitalia Regionale_Emilia.pdf,
edition 17/10-12/12/2026) and data/segments.json.
"""

from __future__ import annotations

import pytest

from engine.journeys import JourneyPlanner, PlanningContext
from engine.journeys.arrive_by import late_train_label
from engine.models import Itinerary, Leg, PlanRequest, PlanResult
from engine.notices import GENERIC, notice
from engine.planner import Planner
from engine.repositories import JsonLocationRepository, JsonSegmentRepository, JsonTrainRepository
from engine.train_categories import HIGH_SPEED, INTERCITY, REGIONAL
from tests.fakes import ExtendedTrainRepository, synthetic_run

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


def test_calendar_note_suspends_run_on_listed_dates(planner: Planner) -> None:
    # FR 9303 07:23: "Nota 33: Si effettua dal 15/11. Sospeso il 21/11, il 22/11 ..." (page 74)
    friday = [
        train(it).train.train for it in planner.plan(req(target_date="2026-11-20")).itineraries
    ]
    saturday = planner.plan(req(target_date="2026-11-21")).itineraries
    assert "9303" in friday
    assert "9303" not in [train(it).train.train for it in saturday]


def test_period_variant_keeps_the_train_after_the_change_date(planner: Planner) -> None:
    # RV 3907: "fino al 16/11" (nota 35) and "dal 17/11" (nota 26), same times (page 75)
    for day in ("2026-11-16", "2026-11-17"):
        result = planner.plan(req(target_date=day, train_categories=REGIONAL_ONLY))
        assert train(result.itineraries[0]).train.train == "3907"


def test_uninterpretable_note_is_reported_on_the_leg() -> None:
    repo = ExtendedTrainRepository([synthetic_run()])
    custom = Planner(repo, JsonLocationRepository(), JsonSegmentRepository())
    result = custom.plan(req())
    synthetic = next(it for it in result.itineraries if train(it).train.train == "99999")
    assert train(synthetic).notes and "pag. 74" in train(synthetic).notes[0]


def test_duplicate_slots_are_shown_once(planner: Planner) -> None:
    # 14:23 Modena->Reggio is printed twice in the PDF (RV 2474 and RV 2490)
    result = planner.plan(req(target_time="13:00", train_categories=REGIONAL_ONLY), "depart_after")
    departures = [train(it).depart for it in result.itineraries]
    assert len(departures) == len(set(departures))


# --- robustness: night, holidays, validity ---------------------------------------


def test_night_lesson_offers_the_first_train_with_its_delay(planner: Planner) -> None:
    result = planner.plan(req(target_time="05:00", train_categories=REGIONAL_ONLY))
    assert result.itineraries == ()
    assert any(w.startswith("Nessun treno da Reggio Emilia FS") for w in result.warnings)
    # No regional train reaches Modena by 04:38 on any day: no "previous" solution.
    (following,) = result.nearby
    assert following.kind == "next" and following.itinerary.service_date == "2026-10-26"
    lateness = -following.itinerary.slack_min
    assert 0 < lateness <= 60
    assert f"arrivi in sede {lateness} min in ritardo" in following.label


def test_no_train_message_explains_the_calculation(planner: Planner) -> None:
    result = planner.plan(
        req(target_time="05:00", margin_minutes=10, last_mile_mode="walk", first_mile_mode="walk")
    )
    expected = (
        "Calcolo: lezione alle 05:00 − 10 min di anticipo − 53 min a piedi dalla stazione alla "
        "sede = arrivo a Modena FS entro le 03:57."
    )
    # No result for the date: the formula is shown once, inside the notice (round 3).
    assert result.calculation is None
    (no_service,) = [n for n in result.notices if n.code == "no_service"]
    assert "entro le 03:57 di lun 26 ott 2026" in no_service.message
    assert expected in no_service.message


def test_calculation_arithmetic_and_omitted_zero_terms(planner: Planner) -> None:
    with_margin = planner.plan(req(margin_minutes=15)).calculation
    assert with_margin is not None
    assert with_margin.time == "07:53"  # 08:30 - 15 - 22 (bike Modena FS -> DIEF)
    assert "15 min di anticipo" in with_margin.summary
    no_margin = planner.plan(req(margin_minutes=0)).calculation
    assert no_margin is not None and no_margin.time == "08:08"
    assert "anticipo" not in no_margin.summary


def test_far_lesson_late_train_is_replaced_by_next_working_day(planner: Planner) -> None:
    # Lesson 05:00 with only high-speed trains: the first FR is hours late, so the
    # same lesson time on the next working day is proposed instead (no 22:xx trains).
    result = planner.plan(req(target_time="05:00", train_categories=frozenset({HIGH_SPEED})))
    assert result.itineraries == ()
    assert all(n.itinerary.service_date != "2026-10-26" for n in result.nearby)


def test_weekday_holiday_is_informational_and_has_trains(planner: Planner) -> None:
    # The PDF (quadri 1-2) has no day symbols: trains run on holidays too.
    result = planner.plan(req(target_date="2026-12-08", train_categories=REGIONAL_ONLY))
    (festive,) = [n for n in result.notices if n.code == "festive_day"]
    assert "festivo (Immacolata Concezione)" in festive.message and festive.level == "info"
    assert train(result.itineraries[0]).train.train == "3907"


def test_sunday_lesson_is_planned_without_a_sunday_warning(planner: Planner) -> None:
    # Review B1: Sunday 25/10, Modena FS -> Palazzo Dossetti, lesson 09:00, walk.
    result = planner.plan(
        req(
            target_date="2026-10-25",
            target_time="09:00",
            destination_campus_id="palazzo_dossetti",
            origin_station_id="modena_fs",
            first_mile_mode="walk",
            last_mile_mode="walk",
            margin_minutes=10,
        )
    )
    best = result.itineraries[0]
    assert (best.leave_at, train(best).train.train, train(best).depart) == (
        "07:55",
        "3902",
        "08:00",
    )
    assert result.calculation is not None and result.calculation.time == "08:31"
    assert not any("domenica" in w.lower() for w in result.warnings)


def test_after_validity_has_explicit_warning_and_previous_solution(planner: Planner) -> None:
    result = planner.plan(req(target_date="2026-12-14"))
    assert result.itineraries == ()
    assert any("dopo la fine di validità" in w and "12 dic 2026" in w for w in result.warnings)
    assert [n.kind for n in result.nearby] == ["previous"]
    assert result.nearby[0].itinerary.service_date == "2026-12-12"


def test_out_of_validity_sunday_has_one_primary_notice(planner: Planner) -> None:
    # Review B4: Sunday 20/12 used to show validity + Sunday + "no train" warnings.
    result = planner.plan(req(target_date="2026-12-20"))
    codes = [n.code for n in result.notices]
    assert codes[0] == "out_of_validity"
    assert "no_service" not in codes and "festive_day" not in codes
    (previous,) = result.nearby
    assert previous.itinerary.service_date == "2026-12-12"
    assert previous.itinerary.slack_min >= 0  # same lesson time on that day
    assert "sab 12 dic 2026 (giorno feriale precedente)" in previous.label


def test_before_validity_searches_forward_from_the_first_day(planner: Planner) -> None:
    result = planner.plan(req(target_date="2026-10-10"))
    assert [n.kind for n in result.nearby] == ["next"]
    assert result.nearby[0].itinerary.service_date == "2026-10-17"


def test_far_future_date_offers_the_last_covered_working_day(planner: Planner) -> None:
    result = planner.plan(req(target_date="2027-03-01"))
    assert result.itineraries == ()
    assert [n.itinerary.service_date for n in result.nearby] == ["2026-12-12"]


def test_itinerary_duration_and_changes(planner: Planner) -> None:
    best = planner.plan(req(train_categories=REGIONAL_ONLY)).itineraries[0]
    assert best.door_to_door_minutes == 39  # 07:39 -> 08:18
    assert best.changes == 0


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
    assert "prima della fine della lezione" in previous.label
    assert following.kind == "next" and following.itinerary.service_date == "2026-10-27"
    assert following.label == "Primo treno di mar 27 ott 2026."


def test_return_calculation(planner: Planner) -> None:
    result = planner.plan(req(target_time="13:00"), "depart_after")
    assert result.calculation is not None
    assert result.calculation.summary == (
        "Calcolo: fine lezione alle 13:00 + 22 min in bici fino alla stazione + 5 min in "
        "stazione = treni da Modena FS dalle 13:27."
    )


def test_return_trip_without_trains_that_day_searches_previous_days(planner: Planner) -> None:
    result = planner.plan(req(target_date="2026-12-14", target_time="13:00"), "depart_after")
    assert [n.kind for n in result.nearby] == ["previous"]
    assert result.nearby[0].label == "Ultimo treno di sab 12 dic 2026."
    assert result.nearby[0].itinerary.service_date == "2026-12-12"


# --- registry -------------------------------------------------------------------------------


class _EchoPlanner(JourneyPlanner):
    name = "echo"

    def plan(self, request: PlanRequest, ctx: PlanningContext) -> PlanResult:
        return PlanResult(
            self.name, (), (notice(GENERIC, f"campus={request.destination_campus_id}"),)
        )


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


def test_train_hours_before_the_lesson_is_an_alternative_not_a_result(planner: Planner) -> None:
    # R 17400 00:53 Modena -> Reggio Emilia runs on 26/10 (nota 6, page 13); for a
    # 05:30 lesson it would mean leaving at 00:48, which is not a sensible answer.
    result = planner.plan(
        req(
            target_time="05:30",
            destination_campus_id="palazzo_dossetti",
            origin_station_id="modena_fs",
            first_mile_mode="walk",
            last_mile_mode="walk",
            margin_minutes=10,
            train_categories=REGIONAL_ONLY,
        )
    )
    assert result.itineraries == ()
    (no_service,) = [n for n in result.notices if n.code == "no_service"]
    assert "tra le 03:01 e le 05:01 di lun 26 ott 2026" in no_service.message
    previous, following = result.nearby
    assert (previous.kind, previous.itinerary.leave_at) == ("previous", "00:48")
    assert previous.label.startswith("Ultimo treno utile del giorno: arrivi in sede 4 h 2 min")
    assert following.kind == "next" and following.itinerary.slack_min == -26


@pytest.mark.parametrize(
    ("slack", "label"),
    [
        (-7, "Primo treno dopo: arrivi in sede 7 min in ritardo sull'inizio della lezione."),
        (
            0,
            "Primo treno dopo: arrivi in sede all'inizio della lezione, meno dei 10 min di "
            "anticipo che hai scelto.",
        ),
        (
            4,
            "Primo treno dopo: arrivi in sede 4 min prima dell'inizio della lezione, meno dei "
            "10 min di anticipo che hai scelto.",
        ),
    ],
)
def test_late_train_label_is_coherent_with_the_sign_of_the_slack(slack: int, label: str) -> None:
    """Round 3, item 4: never "4 min prima" next to "-4 min di ritardo"."""
    assert late_train_label(slack, 10) == label
