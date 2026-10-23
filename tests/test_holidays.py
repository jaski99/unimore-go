"""Tests for engine/holidays.py."""

from datetime import date

import pytest

from engine.holidays import easter_sunday, holiday_name, is_festive, is_public_holiday


@pytest.mark.parametrize(
    ("year", "expected"),
    [
        (2024, date(2024, 3, 31)),
        (2025, date(2025, 4, 20)),
        (2026, date(2026, 4, 5)),
        (2027, date(2027, 3, 28)),
    ],
)
def test_easter_sunday(year: int, expected: date) -> None:
    assert easter_sunday(year) == expected


def test_holidays_in_timetable_edition() -> None:
    assert holiday_name(date(2026, 11, 1)) == "Ognissanti"
    assert holiday_name(date(2026, 12, 8)) == "Immacolata Concezione"
    assert is_public_holiday(date(2026, 4, 6))  # Easter Monday 2026
    assert not is_public_holiday(date(2026, 10, 26))


def test_local_patron_saints_are_not_holidays() -> None:
    assert not is_public_holiday(date(2026, 1, 31))  # San Geminiano (Modena)
    assert not is_public_holiday(date(2026, 11, 24))  # San Prospero (Reggio Emilia)


def test_is_festive_includes_sundays() -> None:
    assert is_festive(date(2026, 10, 25))  # Sunday
    assert is_festive(date(2026, 12, 8))  # Tuesday holiday
    assert not is_festive(date(2026, 10, 24))  # Saturday
