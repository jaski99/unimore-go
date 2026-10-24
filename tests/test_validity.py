"""Tests for engine/validity.py."""

from datetime import date

import pytest

from engine.repositories import JsonTrainRepository
from engine.validity import TimetableValidity, format_it_day


def test_validity_derived_from_data() -> None:
    validity = TimetableValidity.from_trains(JsonTrainRepository().all_trains())
    assert validity.valid_from == date(2026, 10, 17)
    assert validity.valid_to == date(2026, 12, 12)
    assert validity.contains(date(2026, 12, 12))
    assert validity.warning_for(date(2026, 10, 26)) is None


def test_warning_after_and_before_validity() -> None:
    validity = TimetableValidity(date(2026, 10, 17), date(2026, 12, 12))
    after = validity.warning_for(date(2026, 12, 14))
    assert after is not None and "dal sab 17 ott 2026 al sab 12 dic 2026" in after
    assert after.startswith("Lun 14 dic 2026 è dopo la fine di validità")
    before = validity.warning_for(date(2026, 10, 1))
    assert before is not None and "sab 17 ott 2026" in before
    assert before.startswith("Gio 1 ott 2026 è prima")


def test_empty_data_rejected() -> None:
    with pytest.raises(ValueError):
        TimetableValidity.from_trains([])


@pytest.mark.parametrize(
    ("day", "text"),
    [
        # Same strings as Intl.DateTimeFormat('it-IT', short weekday/month) in Node 20.
        (date(2026, 10, 26), "lun 26 ott 2026"),
        (date(2026, 10, 25), "dom 25 ott 2026"),
        (date(2026, 12, 8), "mar 8 dic 2026"),
        (date(2026, 11, 1), "dom 1 nov 2026"),
        (date(2026, 6, 3), "mer 3 giu 2026"),
        (date(2026, 9, 14), "lun 14 set 2026"),
        (date(2026, 7, 1), "mer 1 lug 2026"),
        (date(2027, 1, 5), "mar 5 gen 2027"),
    ],
)
def test_format_it_day_matches_intl_it(day: date, text: str) -> None:
    assert format_it_day(day) == text
