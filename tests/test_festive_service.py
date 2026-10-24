"""Tests for engine/festive_service.py (round 4, point 4)."""

from datetime import date

from engine.calendar_rules import CalendarNoteParser
from engine.festive_service import festive_service_unverified
from engine.models import TrainRun

SUN = date(2026, 10, 25)
MON = date(2026, 10, 26)
IMMACOLATA = date(2026, 12, 8)  # Tuesday, national holiday
ALL_DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def run(days: tuple[str, ...], note: str = "") -> TrainRun:
    return TrainRun(
        from_station="Reggio Emilia",
        to_station="Modena",
        depart="07:44",
        arrive="07:56",
        train="3907",
        category="Regionale Veloce",
        operator="Trenitalia Tper",
        days=days,
        valid_from="2026-10-17",
        valid_to="2026-12-12",
        calendar_note=note,
        source="",
    )


def check(train: TrainRun, day: date) -> bool:
    parser = CalendarNoteParser(edition_start=date(2026, 10, 17))
    return festive_service_unverified(train, day, parser.parse(train.calendar_note))


def test_working_days_never_need_a_label() -> None:
    assert not check(run(ALL_DAYS), MON)


def test_no_day_symbol_on_a_sunday_or_holiday_is_not_verified() -> None:
    # The PDF legend (file page 6) lists only restricting symbols: a run without
    # one is assumed to run every day, which is not a verified festive calendar.
    assert check(run(ALL_DAYS), SUN)
    assert check(run(ALL_DAYS, "Nota 26: Si effettua dal 17/11."), IMMACOLATA)


def test_festive_symbols_verify_the_service() -> None:
    assert not check(run(("sun",)), SUN)  # † festivi
    assert not check(run(("mon", "tue", "wed", "thu", "fri", "sun")), IMMACOLATA)  # Ⓑ
    assert not check(run(("sat", "sun")), SUN)  # Ⓒ


def test_a_note_naming_the_date_or_the_festive_days_verifies_it() -> None:
    assert not check(run(ALL_DAYS, "Nota 25: Si effettua il 17/10 e il 18/10."), date(2026, 10, 18))
    assert not check(run(ALL_DAYS, "Nota 9: Si effettua nei giorni festivi."), SUN)
