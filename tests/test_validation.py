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


def test_validate_real_datasets():
    """Verify all real workspace datasets pass validation cleanly."""
    trains = json.loads((DATA_DIR / "trains.json").read_text(encoding="utf-8"))
    stats = validate_trains(trains)
    assert stats["total"] >= 100
    assert stats["reggio_to_modena"] >= 50
    assert stats["modena_to_reggio"] >= 50

    stations = json.loads((DATA_DIR / "stations.json").read_text(encoding="utf-8"))
    assert validate_stations(stations) == 2

    locations = json.loads((DATA_DIR / "locations.json").read_text(encoding="utf-8"))
    assert validate_locations(locations) == 5

    segments = json.loads((DATA_DIR / "segments.json").read_text(encoding="utf-8"))
    assert validate_segments(segments) == 7


def test_validate_trains_rejects_arrive_before_depart():
    bad_train = [
        {
            "from": "Reggio Emilia",
            "to": "Modena",
            "depart": "08:20",
            "arrive": "08:10",  # arrive < depart
            "train": "9999",
            "category": "Regionale",
            "operator": "Trenitalia Tper",
            "days": ["mon"],
            "valid_from": "2026-10-17",
            "valid_to": "2026-12-12",
            "calendar_note": "",
            "source": "",
        }
    ]
    with pytest.raises(ValueError, match="arrive .* <= depart"):
        validate_trains(bad_train)


def test_validate_trains_rejects_out_of_bounds_duration():
    short_train = [
        {
            "from": "Reggio Emilia",
            "to": "Modena",
            "depart": "08:00",
            "arrive": "08:05",  # 5 min < 10 min
            "train": "9998",
            "category": "Regionale",
            "operator": "Trenitalia Tper",
            "days": ["mon"],
            "valid_from": "2026-10-17",
            "valid_to": "2026-12-12",
            "calendar_note": "",
            "source": "",
        }
    ]
    with pytest.raises(ValueError, match="duration .* outside required 10-30 min"):
        validate_trains(short_train)


def test_validate_trains_rejects_duplicate():
    dup_trains = [
        {
            "from": "Reggio Emilia",
            "to": "Modena",
            "depart": "08:00",
            "arrive": "08:16",
            "train": "1234",
            "category": "Regionale",
            "operator": "Trenitalia Tper",
            "days": ["mon"],
            "valid_from": "2026-10-17",
            "valid_to": "2026-12-12",
            "calendar_note": "",
            "source": "",
        },
        {
            "from": "Reggio Emilia",
            "to": "Modena",
            "depart": "08:00",
            "arrive": "08:16",
            "train": "1234",
            "category": "Regionale",
            "operator": "Trenitalia Tper",
            "days": ["mon"],
            "valid_from": "2026-10-17",
            "valid_to": "2026-12-12",
            "calendar_note": "",
            "source": "",
        },
    ]
    with pytest.raises(ValueError, match="Duplicate train number"):
        validate_trains(dup_trains)


def test_validate_trains_rejects_missing_field():
    bad = [{"from": "Reggio Emilia"}]
    with pytest.raises(ValueError, match="missing fields"):
        validate_trains(bad)


def test_validate_trains_rejects_identical_stations():
    bad = [
        {
            "from": "Modena",
            "to": "Modena",
            "depart": "08:00",
            "arrive": "08:16",
            "train": "1234",
            "category": "Regionale",
            "operator": "Trenitalia Tper",
            "days": ["mon"],
            "valid_from": "2026-10-17",
            "valid_to": "2026-12-12",
            "calendar_note": "",
            "source": "",
        }
    ]
    with pytest.raises(ValueError, match="identical from/to station"):
        validate_trains(bad)
