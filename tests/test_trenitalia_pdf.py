"""Tests for the Trenitalia PDF extractor (tools/trenitalia_pdf.py).

The PDF itself is not committed: tables are rebuilt from synthetic word boxes
that follow the geometry of Regionale_Emilia.pdf (quadro 1, file page 75).
"""

from __future__ import annotations

import pytest

from tools.trenitalia_pdf import (
    ALL_DAYS,
    PDF_URL,
    Cell,
    Column,
    PageTable,
    Word,
    calendar_note,
    decode_key,
    dedupe,
    duration,
    group_lines,
    operator_for,
    parse_page,
    parse_sidebar,
    parse_table,
    runs_from_table,
    to_clock,
)

KM_X = 200.0  # x of the "Km" header label
NOTE_FONT = "Infotra2"


def word(x0: float, y0: float, text: str, font: str = "ArialMT", width: float = 16) -> Word:
    return Word(x0, y0, x0 + width, y0 + 6, text, font)


def table_words() -> list[Word]:
    """Two columns (RV 3907, R 2451) over Reggio Emilia, Rubiera, Modena (arrival)."""
    return [
        word(KM_X, 100, "Km", width=10),
        # station labels (x0 between Km+10 and Km+58) and the arrival marker "a"
        word(KM_X + 10, 110, "Reggio", width=18),
        word(KM_X + 30, 110, "Emilia", width=16),
        word(KM_X + 10, 120, "Rubiera", width=20),
        word(KM_X + 10, 130, "Modena", width=20),
        word(KM_X + 70, 130, "a", width=4),
        # header: category glyphs (infotra1), train numbers, note keys
        word(310, 70, "o", "infotra1", width=6),
        word(350, 70, "L", "infotra1", width=6),
        word(310, 80, "3907"),
        word(350, 80, "2451"),
        word(314, 87, "$&", NOTE_FONT, width=8),  # note 35
        word(314, 93, ")", NOTE_FONT, width=4),  # note 8
        word(354, 87, ")", NOTE_FONT, width=4),
        # times (right of the number centre), "|" = passes without stopping
        word(318, 110, "07.44"),
        word(320, 120, "|", width=2),
        word(318, 130, "07.56"),
        word(358, 110, "07.04"),
        word(352, 120, ":", width=4),  # "solo periodi indicati"
        word(358, 120, "07.12"),
        word(358, 130, "07.20"),
    ]


NOTES = {
    "$&": "Si effettua fino al 16/11",
    ")": "Servizio di Trenitalia Tper",
}


@pytest.fixture
def table() -> PageTable:
    words = table_words()
    anchor = next(w for w in words if w.text == "Km")
    parsed = parse_table(words, anchor, KM_X, 553.0, 75)
    assert parsed is not None
    parsed.printed_page, parsed.notes = "63", NOTES
    return parsed


# --- pure helpers -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"), [("$&", "35"), (")", "8"), ("!", "0"), ("a", "a"), ("", "")]
)
def test_decode_key(raw: str, expected: str) -> None:
    assert decode_key(raw) == expected


def test_clock_and_duration_cross_midnight() -> None:
    assert to_clock("23.49") == "23:49"
    assert duration("07:44", "07:56") == 12
    assert duration("23:49", "00:03") == 14  # RV 2485


def test_group_lines_sorts_by_position() -> None:
    lines = group_lines([word(50, 10.4, "b"), word(10, 10, "a"), word(10, 20, "c")])
    assert [[w.text for w in line] for line in lines] == [["a", "b"], ["c"]]


def test_parse_sidebar_joins_continuations_and_hyphenation() -> None:
    words = [
        word(10, 50, "$&", NOTE_FONT, width=8),
        word(20, 50, "Si"),
        word(40, 50, "effettua"),
        word(60, 50, "nei"),
        word(80, 50, "giorni"),
        word(100, 50, "lavo-"),
        word(20, 57, "rativi"),
        word(10, 64, ")", NOTE_FONT, width=4),
        word(20, 64, "Servizio"),
        word(50, 64, "di"),
        word(60, 64, "Trenitalia"),
        word(20, 71, "Tper"),
        word(10, 40, "Note"),  # key-less heading before the first note is ignored
    ]
    assert parse_sidebar(words) == {
        "$&": "Si effettua nei giorni lavorativi",
        ")": "Servizio di Trenitalia Tper",
    }


def test_operator_and_calendar_note() -> None:
    assert operator_for(["Si effettua dal 17/11", "Servizio di Trenitalia Tper"]) == (
        "Trenitalia Tper"
    )
    assert operator_for(["Servizio di Trenord"]) == "Trenord"
    assert operator_for([]) == "Trenitalia"
    column = Column(center=0, number="3907", category="RV", note_keys=["$&", ")", "$&", "?"])
    assert calendar_note(column, NOTES) == (
        "Nota 35: Si effettua fino al 16/11. Nota 8: Servizio di Trenitalia Tper."
    )


# --- table geometry -----------------------------------------------------------------


def test_parse_table_reads_columns_rows_and_markers(table: PageTable) -> None:
    assert [(label, kind) for label, kind, _y in table.rows] == [
        ("Reggio Emilia", "dep"),
        ("Rubiera", "dep"),
        ("Modena", "arr"),
    ]
    rv, regional = table.columns
    assert (rv.number, rv.category, rv.note_keys) == ("3907", "Regionale Veloce", ["$&", ")"])
    assert (regional.number, regional.category) == ("2451", "Regionale")
    assert rv.cells[("Rubiera", "dep")] == Cell(None, "|")
    assert regional.cells[("Rubiera", "dep")] == Cell("07:12", ":")
    assert regional.cells[("Modena", "arr")] == Cell("07:20", "")


def test_parse_table_without_train_numbers_is_skipped() -> None:
    words = [w for w in table_words() if w.text not in ("3907", "2451")]
    anchor = next(w for w in words if w.text == "Km")
    assert parse_table(words, anchor, KM_X, 553.0, 75) is None


def test_runs_from_table_skips_markers_and_non_stops(table: PageTable) -> None:
    report: list[str] = []
    runs = runs_from_table(table, report)
    assert [(r["train"], r["from"], r["to"], r["depart"], r["arrive"]) for r in runs] == [
        ("3907", "Reggio Emilia", "Modena", "07:44", "07:56"),
        ("2451", "Reggio Emilia", "Modena", "07:04", "07:20"),
    ]
    first = runs[0]
    assert first["operator"] == "Trenitalia Tper"
    assert first["days"] == list(ALL_DAYS)
    assert first["calendar_note"].startswith("Nota 35: Si effettua fino al 16/11.")
    assert first["source"] == f"{PDF_URL}#page=75 (pagina stampata 63; note 35, 8)"
    assert any("2451" in line and "stop marker ':'" in line for line in report)


def test_runs_from_table_skips_bus_suburban_unknown_and_sleeper_only(table: PageTable) -> None:
    table.columns[0].category = "Suburbano"
    table.columns[1].note_keys.append("&")
    table.notes = {
        **NOTES,
        "&": "Sono ammessi esclusivamente i viaggiatori muniti di biglietto per cuccetta",
    }
    unknown = Column(center=400, number="B123", category="")
    table.columns.append(unknown)
    report: list[str] = []
    assert runs_from_table(table, report) == []
    assert any("Suburbano" in line for line in report)
    assert any("sleeper" in line for line in report)
    assert any("B123" in line and "not recognised" in line for line in report)


def test_runs_from_table_rejects_implausible_durations(table: PageTable) -> None:
    table.columns[0].cells[("Modena", "arr")] = Cell("09:56", "")
    report: list[str] = []
    runs = runs_from_table(table, report)
    assert all(r["train"] != "3907" for r in runs)
    assert any("3907" in line and "132 min" in line for line in report)


def test_dedupe_keeps_period_variants() -> None:
    base = {
        "from": "Reggio Emilia",
        "to": "Modena",
        "train": "3907",
        "depart": "07:44",
        "arrive": "07:56",
    }
    first = {**base, "calendar_note": "Nota 35: Si effettua fino al 16/11."}
    second = {**base, "calendar_note": "Nota 26: Si effettua dal 17/11."}
    assert dedupe([first, second, dict(first)]) == [first, second]


# --- whole page ---------------------------------------------------------------------


def test_parse_page_reads_sidebar_title_and_printed_page() -> None:
    sidebar = [
        word(20, 50, "$&", NOTE_FONT, width=8),
        word(30, 50, "Si"),
        word(50, 50, "effettua"),
        word(70, 50, "fino"),
        word(90, 50, "al"),
        word(110, 50, "16/11"),
        word(20, 57, ")", NOTE_FONT, width=4),
        word(30, 57, "Servizio"),
        word(60, 57, "di"),
        word(80, 57, "Trenitalia"),
        word(110, 57, "Tper"),
    ]
    header = [
        word(20, 10, "1", "Arial-BoldMT", width=6),
        word(30, 30, "Bologna-Milano", "Arial-BoldMT", width=40),
        word(300, 400, "63", width=8),
    ]
    (table,) = parse_page([*table_words(), *sidebar, *header], 75)
    assert table.title == "Bologna-Milano"
    assert table.printed_page == "63"
    assert table.notes == NOTES
    assert len(runs_from_table(table, [])) == 2


def test_parse_page_without_tables_or_quadro_number() -> None:
    assert parse_page([word(10, 10, "Legenda")], 6) == []
    assert parse_page(table_words(), 75) == []  # no bold quadro number at the top
