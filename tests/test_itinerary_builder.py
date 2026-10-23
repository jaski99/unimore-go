"""Tests for engine/itinerary_builder.py."""

from datetime import date

import pytest

from engine.itinerary_builder import assemble, clock, station_wait_leg, timed_leg


def test_clock_wraps_around_midnight() -> None:
    assert clock(-5) == "23:55"
    assert clock(24 * 60 + 70) == "01:10"


def test_zero_minute_legs_are_not_generated() -> None:
    assert timed_leg("walk", "Casa", "Modena FS", 400, 0) is None
    assert station_wait_leg("Modena FS", 400, 0) is None


def test_wait_leg() -> None:
    leg = station_wait_leg("Reggio Emilia FS", 7 * 60 + 39, 5)
    assert leg is not None
    assert (leg.leg_type, leg.depart, leg.arrive, leg.minutes) == ("wait", "07:39", "07:44", 5)


def test_assemble_drops_empty_legs_and_sets_times() -> None:
    walk = timed_leg("walk", "Casa", "Modena FS", 400, 10)
    it = assemble(
        [None, walk, station_wait_leg("Modena FS", 410, 5)], 12, date(2026, 10, 26), ["w"]
    )
    assert [leg.leg_type for leg in it.legs] == ["walk", "wait"]
    assert (it.leave_at, it.arrive_at, it.slack_min) == ("06:40", "06:55", 12)
    assert it.service_date == "2026-10-26" and it.warnings == ("w",)


def test_assemble_requires_a_leg() -> None:
    with pytest.raises(ValueError):
        assemble([None], 0, date(2026, 10, 26))
