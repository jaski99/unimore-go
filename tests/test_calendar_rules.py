"""Tests for engine/calendar_rules.py.

Real notes are copied verbatim from data/trains.json (Trenitalia
Regionale_Emilia.pdf, edition 17/10-12/12/2026; the page is in each run's
``source``). Synthetic notes only exercise grammar that the PDF legend uses
(feriali, festivi, sabato escluso) and are marked as such.
"""

from datetime import date

import pytest

from engine.calendar_rules import (
    INTERPRETED,
    UNINTERPRETABLE,
    UNRESTRICTED,
    AllOf,
    AnyOf,
    CalendarNoteParser,
    DateWindow,
    ExceptDates,
    ExceptWeekdays,
    ExceptWindow,
    FestiveDays,
    Not,
    OnlyDates,
    OnlyWeekdays,
    WorkingDays,
)

parser = CalendarNoteParser(edition_start=date(2026, 10, 17))


# --- real notes ---------------------------------------------------------------


def test_real_note_until_date_pdf_page_75() -> None:
    # RV 3907 Reggio 07:44, PDF page 75 (printed 63), note 35
    note = (
        "Nota 35: si effettua fino al 16/11; verificato attivo lunedì 2026-10-26. "
        "Nota 8: servizio di Trenitalia Tper."
    )
    result = parser.parse(note)
    assert result.status == INTERPRETED
    assert result.rules == (DateWindow(None, date(2026, 11, 16)),)
    assert result.runs_on(date(2026, 11, 16))
    assert not result.runs_on(date(2026, 11, 17))


def test_real_note_period_with_suspensions_pdf_page_78() -> None:
    # R 2067 Reggio 08:44, PDF page 78 (printed 66), note 53
    note = (
        "Nota 53: si effettua dal 22/10 al 16/11, sospeso il 23/10, il 24/10 e il 25/10; "
        "verificato attivo lunedì 2026-10-26. Nota 8: servizio di Trenitalia Tper."
    )
    result = parser.parse(note)
    assert result.status == INTERPRETED
    assert DateWindow(date(2026, 10, 22), date(2026, 11, 16)) in result.rules
    assert ExceptDates(frozenset({date(2026, 10, d) for d in (23, 24, 25)})) in result.rules
    assert result.runs_on(date(2026, 10, 22))
    assert not result.runs_on(date(2026, 10, 23))
    assert result.runs_on(date(2026, 10, 26))
    assert not result.runs_on(date(2026, 10, 21))


def test_real_note_suspended_on_friday_pdf_page_60() -> None:
    result = parser.parse(
        "Nota 188: sospeso il venerdì; verificato attivo lunedì 2026-10-26. "
        "Nota 1: servizio di Trenitalia Tper."
    )
    assert result.rules == (ExceptWeekdays(frozenset({4})),)
    assert not result.runs_on(date(2026, 10, 23))  # Friday
    assert result.runs_on(date(2026, 10, 24))


def test_real_note_weekday_list_with_hyphen_break_pdf_page_124() -> None:
    result = parser.parse(
        "Si effettua il lunedì, il venerdì e il sa- bato.; nota 8: servizio di Trenitalia Tper."
    )
    assert result.status == INTERPRETED
    assert result.rules == (OnlyWeekdays(frozenset({0, 4, 5})),)


def test_real_note_single_weekday() -> None:
    assert parser.parse("Si effettua il venerdì.; nota 1: servizio di Trenitalia Tper.").rules == (
        OnlyWeekdays(frozenset({4})),
    )


def test_unrestricted_and_informative_notes() -> None:
    for note in (
        "Nessuna limitazione di calendario stampata per la corsa; nota 1: servizio di Trenitalia Tper.",
        "servizio di Trenitalia Tper.",
        "Non sono ammessi i gruppi con bigliet-; nota 1: servizio di Trenitalia Tper.",
        "",
    ):
        result = parser.parse(note)
        assert result.status == UNRESTRICTED, note
        assert result.runs_on(date(2026, 12, 1))
        assert result.describe() == "nessuna limitazione"


def test_alternative_variants_are_uninterpretable() -> None:
    # IC 580, PDF page 31: two alternative notes, the run's one is unknown
    result = parser.parse("Si effettua fino al 14/11. | Si effettua dal 15/11. Sospeso il 21/11,")
    assert result.status == UNINTERPRETABLE
    assert "varianti" in result.reason
    assert result.runs_on(date(2026, 11, 21))  # never filters on its own
    assert result.describe() == "non interpretata"


@pytest.mark.parametrize(
    "note",
    [
        "Si effettua il 17/10, il 18/10, il 31/10, il; nota 1: servizio di Trenitalia Tper.",
        "Si effettua dal 18/10 al 22/10, dal",
        "Sospeso il lunedì, il venerdì, il sabato; nota 8: servizio di Trenitalia Tper.",
        "Si effettua dal 2/12. Sospeso dal marte- dì alla domenica dal 6/12 al 11/12 nonché",
        "Sono ammessi esclusivamente i viag-",
        "S ie f f e t t u ai l2 1 / 1 0 ,i l2 2 / 1 0ei l2 3 / 1 0 .",
    ],
)
def test_truncated_or_garbled_notes_are_uninterpretable(note: str) -> None:
    result = parser.parse(note)
    assert result.status == UNINTERPRETABLE
    assert result.unparsed
    assert "incompleto" in result.reason


def test_invalid_calendar_date_is_uninterpretable() -> None:
    assert parser.parse("Si effettua il 31/11.").status == UNINTERPRETABLE


# --- grammar (synthetic notes using the PDF legend vocabulary) ------------------


def test_working_days_and_saturday_excluded() -> None:
    feriali = parser.parse("Si effettua nei giorni feriali.")
    assert feriali.rules == (WorkingDays(include_saturday=True),)
    assert feriali.runs_on(date(2026, 10, 24))  # Saturday
    assert not feriali.runs_on(date(2026, 10, 25))  # Sunday
    assert not feriali.runs_on(date(2026, 12, 8))  # holiday
    no_sat = parser.parse("Si effettua nei giorni lavorativi escluso il sabato.")
    assert no_sat.rules == (WorkingDays(include_saturday=False),)
    assert not no_sat.runs_on(date(2026, 10, 24))
    assert no_sat.runs_on(date(2026, 10, 26))
    assert parser.parse("Feriali sabato escluso").rules == (WorkingDays(include_saturday=False),)


def test_festive_rules() -> None:
    only = parser.parse("Si effettua nei giorni festivi.")
    assert only.rules == (FestiveDays(only=True),)
    assert only.runs_on(date(2026, 11, 1)) and not only.runs_on(date(2026, 11, 2))
    sospeso = parser.parse("Sospeso nei giorni festivi.")
    assert sospeso.rules == (FestiveDays(only=False),)
    assert not sospeso.runs_on(date(2026, 12, 8))
    assert parser.parse("Non si effettua nei festivi").rules == (FestiveDays(only=False),)


def test_periods_dates_and_weekday_ranges() -> None:
    assert parser.parse("Si effettua dal 17/11.").rules == (DateWindow(date(2026, 11, 17), None),)
    assert parser.parse("Sospeso dal 3/11 al 8/11.").rules == (
        ExceptWindow(date(2026, 11, 3), date(2026, 11, 8)),
    )
    assert parser.parse("Si effettua il 14/11 e il 15/11.").rules == (
        OnlyDates(frozenset({date(2026, 11, 14), date(2026, 11, 15)})),
    )
    sat = parser.parse("Si effettua il sabato fino al 31/10.")
    assert sat.rules == (OnlyWeekdays(frozenset({5})), DateWindow(None, date(2026, 10, 31)))
    week = parser.parse("Si effettua dal lunedì al venerdì.")
    assert week.rules == (OnlyWeekdays(frozenset({0, 1, 2, 3, 4})),)
    wrap = parser.parse("Sospeso dal martedì alla domenica dal 6/12 al 11/12.")
    assert wrap.rules == (
        ExceptWeekdays(frozenset({1, 2, 3, 4, 5, 6}), date(2026, 12, 6), date(2026, 12, 11)),
    )
    assert not wrap.runs_on(date(2026, 12, 9))
    assert wrap.runs_on(date(2026, 12, 7))  # Monday
    weekend = parser.parse("Si effettua dal sabato al lunedì.")
    assert weekend.rules == (OnlyWeekdays(frozenset({5, 6, 0})),)


def test_year_rollover_for_editions_crossing_new_year() -> None:
    winter = CalendarNoteParser(edition_start=date(2026, 12, 13))
    assert winter.resolve_date("6/1") == date(2027, 1, 6)
    assert winter.resolve_date("20/12") == date(2026, 12, 20)


def test_rule_descriptions_are_italian() -> None:
    result = parser.parse(
        "Nota 53: si effettua dal 22/10 al 16/11, sospeso il 23/10, il 24/10 e il 25/10"
    )
    assert result.describe() == "dal 22/10 al 16/11; sospeso il 23/10, 24/10, 25/10"
    texts = [
        OnlyWeekdays(frozenset({0})).describe(),
        ExceptWeekdays(frozenset({4}), date(2026, 12, 6), None).describe(),
        ExceptWindow(None, date(2026, 11, 1)).describe(),
        DateWindow().describe(),
        OnlyDates(frozenset({date(2026, 11, 1)})).describe(),
        WorkingDays(False).describe(),
        FestiveDays(True).describe(),
        FestiveDays(False).describe(),
        WorkingDays(True).describe(),
    ]
    assert texts == [
        "solo lun",
        "sospeso ven (6/12–…)",
        "sospeso fino al 1/11",
        "sempre",
        "solo il 1/11",
        "feriali escluso il sabato",
        "solo festivi",
        "sospeso nei festivi",
        "feriali",
    ]


# --- term lists (TermListClauseParser) ----------------------------------------
# Real notes from data/trains.json; each case lists (day, runs?) pairs checked
# against the calendar by hand.

D = date


@pytest.mark.parametrize(
    ("note", "expected"),
    [
        (
            # FR 9303 07:23 Reggio Emilia -> Modena, page 74
            "Nota 33: Si effettua dal 15/11. Sospeso il 21/11, il 22/11, il 28/11 e il 29/11.",
            {
                D(2026, 11, 14): False,
                D(2026, 11, 15): True,
                D(2026, 11, 21): False,
                D(2026, 11, 23): True,
                D(2026, 11, 29): False,
            },
        ),
        (
            # ICN 755, page 77: weekday restricted by a period, then "nonché" dates
            "Nota 201: Si effettua il mercoledì dal 25/11 nonché il 24/11 e il 1/12.",
            {
                D(2026, 11, 18): False,
                D(2026, 11, 24): True,
                D(2026, 11, 25): True,
                D(2026, 11, 26): False,
                D(2026, 12, 1): True,
                D(2026, 12, 2): True,
            },
        ),
        (
            # ICN 755, page 77: suspended weekday range in two periods plus dates
            "Nota 202: Si effettua dal 15/11. Sospeso dal martedì alla domenica dal 15/11 al "
            "25/11 e dal 27/11 al 2/12 nonché il 16/11, il 8/12 e il 9/12.",
            {
                D(2026, 11, 14): False,
                D(2026, 11, 16): False,
                D(2026, 11, 17): False,
                D(2026, 11, 23): True,
                D(2026, 11, 26): True,
                D(2026, 11, 30): True,
                D(2026, 12, 1): False,
                D(2026, 12, 3): True,
                D(2026, 12, 8): False,
                D(2026, 12, 9): False,
                D(2026, 12, 10): True,
            },
        ),
        (
            # R 3945 22:43, page 77
            "Nota 192: Sospeso il lunedì, il venerdì, il sabato e nei festivi.",
            {
                D(2026, 10, 25): False,
                D(2026, 10, 26): False,
                D(2026, 10, 27): True,
                D(2026, 10, 30): False,
                D(2026, 12, 8): False,
                D(2026, 12, 9): True,
            },
        ),
        (
            # R 3951 22:43, page 77
            "Nota 191: Si effettua il lunedì, il venerdì e il sabato.",
            {D(2026, 10, 26): True, D(2026, 10, 27): False, D(2026, 10, 31): True},
        ),
        (
            # ICN 765, page 77
            "Nota 194: Si effettua il venerdì e il sabato dal 23/10 al 14/11.",
            {
                D(2026, 10, 23): True,
                D(2026, 10, 24): True,
                D(2026, 10, 25): False,
                D(2026, 11, 20): False,
            },
        ),
        (
            # ICN 755, page 77: one period minus four periods
            "Nota 200: Si effettua fino al 14/11. Sospeso fino al 22/10, dal 25/10 al 29/10, "
            "dal 1/11 al 5/11 e dal 8/11 al 12/11.",
            {
                D(2026, 10, 22): False,
                D(2026, 10, 23): True,
                D(2026, 10, 26): False,
                D(2026, 10, 30): True,
                D(2026, 11, 13): True,
                D(2026, 11, 15): False,
            },
        ),
        (
            # R 17400, page 13: dates minus a date
            "Nota 1: Servizio di Trenitalia Tper. Nota 5: Si effettua il 17/10, il 18/10 e il "
            "19/10. Sospeso il 17/10.",
            {
                D(2026, 10, 17): False,
                D(2026, 10, 18): True,
                D(2026, 10, 19): True,
                D(2026, 10, 20): False,
            },
        ),
    ],
)
def test_real_term_list_notes(note: str, expected: dict[date, bool]) -> None:
    interpretation = parser.parse(note)
    assert interpretation.status == INTERPRETED
    assert {day: interpretation.runs_on(day) for day in expected} == expected


@pytest.mark.parametrize(
    "note",
    [
        "Si effettua il lunedì e secondo calendario.",  # unknown token
        "Sospeso il lunedì, il venerdì, il sabato.",  # comma list without closing "e"
        "Si effettua il lunedìx.",  # weekday glued to other letters
        "Sospeso.",  # empty term list
    ],
)
def test_term_lists_outside_the_grammar_are_rejected(note: str) -> None:
    assert parser.parse(note).status == UNINTERPRETABLE


def test_combinators() -> None:
    monday = OnlyWeekdays(frozenset({0}))
    november = DateWindow(date(2026, 11, 1), date(2026, 11, 30))
    either, both, never_monday = AnyOf((monday, november)), AllOf((monday, november)), Not(monday)
    assert either.applies(date(2026, 10, 26)) and either.applies(date(2026, 11, 3))
    assert not either.applies(date(2026, 10, 27))
    assert both.applies(date(2026, 11, 2)) and not both.applies(date(2026, 10, 26))
    assert never_monday.applies(date(2026, 10, 27)) and not never_monday.applies(date(2026, 10, 26))
    assert " oppure " in either.describe()
    assert both.describe().startswith("(") and " e (" in both.describe()
    assert never_monday.describe().startswith("sospeso: ")
