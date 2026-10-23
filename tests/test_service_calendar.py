"""Tests for engine/service_calendar.py."""

from dataclasses import replace
from datetime import date

from engine.calendar_rules import CalendarNoteParser
from engine.models import TrainRun
from engine.service_calendar import ServiceCalendar, pdf_reference

PDF = "https://www.trenitalia.com/x/Regionale_Emilia.pdf"


def make_run(**overrides) -> TrainRun:
    base = TrainRun(
        from_station="Reggio Emilia",
        to_station="Modena",
        depart="07:44",
        arrive="07:56",
        train="3907",
        category="Regionale Veloce",
        operator="Trenitalia Tper",
        days=("mon", "tue", "wed", "thu", "fri"),
        valid_from="2026-10-17",
        valid_to="2026-12-12",
        calendar_note="Nota 35: si effettua fino al 16/11",
        source=f"{PDF}#page=75 (pagina stampata 63; note 8 e 35)",
    )
    return replace(base, **overrides)


calendar = ServiceCalendar(CalendarNoteParser(edition_start=date(2026, 10, 17)))


def test_pdf_reference() -> None:
    assert pdf_reference(f"{PDF}#page=75 (pagina stampata 63; note 8 e 35)") == (
        "Regionale_Emilia.pdf, pag. 75 (pagina stampata 63; note 8 e 35)"
    )
    assert pdf_reference(f"{PDF}#page=9") == "Regionale_Emilia.pdf, pag. 9"
    assert pdf_reference(PDF) == "Regionale_Emilia.pdf"


def test_runs_on_combines_data_and_note() -> None:
    run = make_run()
    assert calendar.runs_on(run, date(2026, 10, 26))
    assert not calendar.runs_on(run, date(2026, 11, 17))  # note: fino al 16/11
    assert not calendar.runs_on(run, date(2026, 10, 24))  # Saturday not in days
    assert not calendar.runs_on(run, date(2026, 12, 14))  # after valid_to
    assert calendar.warning_for(run) is None


def test_weekday_holiday_follows_sunday_service() -> None:
    weekday_only = make_run(calendar_note="")
    assert not calendar.runs_on(weekday_only, date(2026, 12, 8))  # Tuesday holiday
    every_day = make_run(calendar_note="", days=("mon", "tue", "wed", "thu", "fri", "sat", "sun"))
    assert calendar.runs_on(every_day, date(2026, 12, 8))


def test_uninterpretable_note_keeps_run_and_cites_pdf_page() -> None:
    run = make_run(
        train="580",
        calendar_note="Si effettua fino al 14/11. | Si effettua dal 15/11. Sospeso il 21/11,",
        source=f"{PDF}#page=31 (pagina stampata 19; note 91)",
    )
    assert calendar.runs_on(run, date(2026, 11, 20))
    warning = calendar.warning_for(run)
    assert warning is not None
    assert "non interpretata" in warning
    assert "pag. 31 (pagina stampata 19; note 91)" in warning
    assert "Si effettua fino al 14/11." in warning


def test_long_unparsed_text_is_truncated() -> None:
    run = make_run(calendar_note=" | ".join(f"Si effettua il {d}/11." for d in range(1, 29)))
    warning = calendar.warning_for(run)
    assert warning is not None and "…" in warning


def test_interpretations_are_cached() -> None:
    run = make_run()
    assert calendar.interpretation(run) is calendar.interpretation(make_run(train="9999"))
