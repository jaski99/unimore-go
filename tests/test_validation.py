"""Unit tests for dataset validation logic in tools/validate_data.py."""

import json
from pathlib import Path

import pytest

from tools.validate_data import (
    validate_locations,
    validate_segments,
    validate_stations,
    validate_trains,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PDF = "https://www.trenitalia.com/content/dam/trenitalia/Regionale_Emilia.pdf"


def run(**overrides) -> dict:
    """A valid run (as produced by tools/trenitalia_pdf.py) with overrides."""
    base = {
        "from": "Reggio Emilia",
        "to": "Modena",
        "depart": "08:00",
        "arrive": "08:16",
        "train": "1234",
        "category": "Regionale",
        "operator": "Trenitalia Tper",
        "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        "valid_from": "2026-10-17",
        "valid_to": "2026-12-12",
        "calendar_note": "Nota 8: Servizio di Trenitalia Tper.",
        "source": f"{PDF}#page=75 (pagina stampata 63; note 8)",
    }
    base.update(overrides)
    return base


def test_validate_real_datasets():
    """Verify all real workspace datasets pass validation cleanly."""
    trains = json.loads((DATA_DIR / "trains.json").read_text(encoding="utf-8"))
    stats = validate_trains(trains)
    assert stats["total"] >= 100
    assert stats["reggio_to_modena"] >= 50
    assert stats["modena_to_reggio"] >= 50
    assert stats["rubiera"] > 0

    stations = json.loads((DATA_DIR / "stations.json").read_text(encoding="utf-8"))
    assert validate_stations(stations) == 3

    locations = json.loads((DATA_DIR / "locations.json").read_text(encoding="utf-8"))
    assert validate_locations(locations) == 5

    segments = json.loads((DATA_DIR / "segments.json").read_text(encoding="utf-8"))
    assert validate_segments(segments) == 7


def test_valid_run_passes_and_counts_rubiera():
    stats = validate_trains([run(), run(to="Rubiera", arrive="08:08")])
    assert stats == {"total": 2, "reggio_to_modena": 1, "modena_to_reggio": 0, "rubiera": 1}


def test_run_crossing_midnight_is_allowed():
    # RV 2485 Reggio Emilia 23:49 -> Modena 00:03 (PDF page 77)
    assert validate_trains([run(depart="23:49", arrive="00:03")])["total"] == 1


def test_validate_trains_rejects_arrive_before_depart():
    # 08:20 -> 08:10 would be a 23 h 50 min run: outside the window.
    with pytest.raises(ValueError, match="duration 1430m outside 3-45 min"):
        validate_trains([run(depart="08:20", arrive="08:10")])


@pytest.mark.parametrize("arrive", ["08:02", "08:46"])
def test_validate_trains_rejects_out_of_bounds_duration(arrive: str):
    with pytest.raises(ValueError, match="outside 3-45 min window"):
        validate_trains([run(arrive=arrive)])


def test_validate_trains_rejects_duplicate():
    with pytest.raises(ValueError, match="Duplicate train run"):
        validate_trains([run(), run()])


def test_period_variants_with_different_notes_are_allowed():
    first = run(calendar_note="Nota 35: Si effettua fino al 16/11.")
    second = run(calendar_note="Nota 26: Si effettua dal 17/11.")
    assert validate_trains([first, second])["total"] == 2


def test_validate_trains_rejects_missing_field():
    with pytest.raises(ValueError, match="missing fields"):
        validate_trains([run(), {"from": "Reggio Emilia"}])


def test_validate_trains_rejects_identical_stations():
    with pytest.raises(ValueError, match="identical from/to station"):
        validate_trains([run(to="Reggio Emilia")])


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"to": "Bologna"}, "invalid station pair"),
        ({"category": "Bus"}, "invalid category"),
        ({"days": []}, "days must be non-empty"),
        ({"days": ["mon", "xyz"]}, "invalid days"),
        ({"valid_from": "2026-12-13"}, "valid_from"),
        ({"depart": "8:00"}, "Invalid time format"),
        ({"depart": "24:10"}, "out of bounds"),
        ({"source": "PDF page 75"}, "must cite the PDF page"),
        ({"source": f"{PDF} (pagina 63)"}, "must cite the PDF page"),
        (
            {"calendar_note": "Nota 9: Si effettua secondo calendario speciale."},
            "not interpretable",
        ),
    ],
)
def test_validate_trains_rejects_invalid_rows(override: dict, message: str):
    with pytest.raises(ValueError, match=message):
        validate_trains([run(**override)])


def test_validate_trains_rejects_empty_dataset():
    with pytest.raises(ValueError, match="non-empty"):
        validate_trains([])
