"""Unit tests for engine/models.py."""

import dataclasses
from datetime import date, time

import pytest

from engine.models import (
    Campus,
    Itinerary,
    Leg,
    PlanRequest,
    Station,
    TrainRun,
    format_time,
    minutes_to_time,
    parse_date_str,
    parse_time_str,
    time_to_minutes,
)


def test_time_conversions():
    t = time(7, 30)
    assert time_to_minutes(t) == 450
    assert minutes_to_time(450) == t
    assert format_time(t) == "07:30"
    assert parse_time_str("07:30") == t
    assert parse_time_str(t) == t

    # Midnight wrap
    assert minutes_to_time(1440) == time(0, 0)
    assert minutes_to_time(1500) == time(1, 0)


def test_date_conversions():
    d = date(2026, 10, 26)
    assert parse_date_str("2026-10-26") == d
    assert parse_date_str(d) == d


def test_station_immutable():
    st = Station(
        id="modena_fs",
        name="Modena FS",
        city="Modena",
        lat=44.653998,
        lon=10.930751,
        address="Piazza Dante Alighieri",
        uic_code="830005032",
    )
    assert st.id == "modena_fs"
    assert st.name == "Modena FS"
    with pytest.raises(dataclasses.FrozenInstanceError):
        st.name = "New Name"  # type: ignore


def test_campus_immutable():
    c = Campus(
        id="dief",
        name="DIEF",
        address="Via Vivarelli 10",
        city="Modena",
        lat=44.629,
        lon=10.949,
        reference_station="Modena FS",
    )
    assert c.id == "dief"
    assert c.city == "Modena"
    with pytest.raises(dataclasses.FrozenInstanceError):
        c.city = "Reggio Emilia"  # type: ignore


def test_train_run_properties():
    tr = TrainRun(
        from_station="Reggio Emilia",
        to_station="Modena",
        depart="07:04",
        arrive="07:20",
        train="2451",
        category="Regionale Veloce",
        operator="Trenitalia Tper",
        days=("mon", "tue", "wed", "thu", "fri"),
        valid_from="2026-10-17",
        valid_to="2026-12-12",
        calendar_note="Nessuna limitazione",
        source="PDF p.73",
    )
    assert tr.depart_time == time(7, 4)
    assert tr.arrive_time == time(7, 20)
    assert tr.duration_minutes == 16


def test_leg_and_itinerary():
    l1 = Leg(
        leg_type="walk",
        origin="Casa",
        destination="Reggio Emilia FS",
        depart="06:54",
        arrive="07:04",
        minutes=10,
    )
    l2 = Leg(
        leg_type="train",
        origin="Reggio Emilia",
        destination="Modena",
        depart="07:04",
        arrive="07:20",
        minutes=16,
    )
    l3 = Leg(
        leg_type="bike",
        origin="Modena FS",
        destination="DIEF",
        depart="07:20",
        arrive="07:42",
        minutes=22,
    )

    it = Itinerary(
        leave_at="06:54",
        legs=(l1, l2, l3),
        arrive_at="07:42",
        slack_min=48,
    )
    assert it.leave_time == time(6, 54)
    assert it.arrive_time == time(7, 42)
    assert it.total_travel_minutes == 48

    # Leg properties
    assert l1.depart_time == time(6, 54)
    assert l1.arrive_time == time(7, 4)


def test_plan_request():
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="08:30",
        destination_campus_id="dief",
        first_mile_mode="bike",
        first_mile_minutes=15,
        last_mile_mode="walk",
        margin_minutes=12,
    )
    assert req.parsed_date == date(2026, 10, 26)
    assert req.parsed_time == time(8, 30)
    assert req.margin_minutes == 12
