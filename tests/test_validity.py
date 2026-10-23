"""Tests for engine/validity.py."""

from datetime import date

import pytest

from engine.repositories import JsonTrainRepository
from engine.validity import TimetableValidity, format_it_date, format_it_weekday_date


def test_validity_derived_from_data() -> None:
    validity = TimetableValidity.from_trains(JsonTrainRepository().all_trains())
    assert validity.valid_from == date(2026, 10, 17)
    assert validity.valid_to == date(2026, 12, 12)
    assert validity.contains(date(2026, 12, 12))
    assert validity.warning_for(date(2026, 10, 26)) is None


def test_warning_after_and_before_validity() -> None:
    validity = TimetableValidity(date(2026, 10, 17), date(2026, 12, 12))
    after = validity.warning_for(date(2026, 12, 14))
    assert after is not None and "14/12/2026" in after and "12/12/2026" in after
    assert after.startswith("Lunedì 14/12/2026 è dopo la fine di validità")
    before = validity.warning_for(date(2026, 10, 1))
    assert before is not None and "17/10/2026" in before
    assert before.startswith("Giovedì 01/10/2026 è prima")


def test_empty_data_rejected() -> None:
    with pytest.raises(ValueError):
        TimetableValidity.from_trains([])


def test_format_it_date() -> None:
    assert format_it_date(date(2026, 1, 5)) == "05/01/2026"
    assert format_it_weekday_date(date(2026, 10, 25)) == "domenica 25/10/2026"
