"""Data validation script for UnimoreGo dataset files.

Validates schema, time coherence (duration 3-45 minutes, overnight runs
allowed), duplicate freedom, interpretable calendar notes and geographic
consistency across:
- data/trains.json
- data/locations.json
- data/stations.json
- data/segments.json

Usage:
    python tools/validate_data.py
    pytest tests/test_validation.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.calendar_rules import CalendarNoteParser  # noqa: E402

REQUIRED_TRAIN_FIELDS = {
    "from",
    "to",
    "depart",
    "arrive",
    "train",
    "category",
    "operator",
    "days",
    "valid_from",
    "valid_to",
    "calendar_note",
    "source",
}

VALID_STATIONS = {"Reggio Emilia", "Rubiera", "Modena"}
MIN_RUN_MINUTES, MAX_RUN_MINUTES = 3, 45
VALID_CATEGORIES = {
    "Regionale",
    "Regionale Veloce",
    "Intercity",
    "Intercity Notte",
    "Frecciarossa",
    "EuroCity",
}
VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


def parse_hh_mm(val: str) -> time:
    m = re.fullmatch(r"(\d{2}):(\d{2})", val)
    if not m:
        raise ValueError(f"Invalid time format: {val!r}")
    hour, minute = int(m.group(1)), int(m.group(2))
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"Hour/minute out of bounds: {val!r}")
    return time(hour, minute)


def parse_iso_date(val: str) -> date:
    return date.fromisoformat(val)


def validate_trains(data: list[dict]) -> dict[str, int]:
    if not isinstance(data, list) or not data:
        raise ValueError("trains.json must contain a non-empty JSON array")

    # Schema first: every later check (and the edition start) relies on it.
    for idx, t in enumerate(data):
        missing = REQUIRED_TRAIN_FIELDS - set(t.keys())
        if missing:
            raise ValueError(f"Train row {idx} missing fields: {sorted(missing)}")

    seen_run_keys: set[tuple[str, ...]] = set()
    edition_start = min(parse_iso_date(t["valid_from"]) for t in data)
    parser = CalendarNoteParser(edition_start=edition_start)

    for idx, t in enumerate(data):
        from_st = t["from"]
        to_st = t["to"]
        if from_st not in VALID_STATIONS or to_st not in VALID_STATIONS:
            raise ValueError(f"Train row {idx}: invalid station pair ({from_st} -> {to_st})")
        if from_st == to_st:
            raise ValueError(f"Train row {idx}: identical from/to station ({from_st})")

        dep_t = parse_hh_mm(t["depart"])
        arr_t = parse_hh_mm(t["arrive"])

        dep_min = dep_t.hour * 60 + dep_t.minute
        arr_min = arr_t.hour * 60 + arr_t.minute

        # Coherence: positive duration; a run may cross midnight (23:49 -> 00:03).
        duration = (arr_min - dep_min) % (24 * 60)
        if not (MIN_RUN_MINUTES <= duration <= MAX_RUN_MINUTES):
            raise ValueError(
                f"Train row {idx} ({t['train']}): duration {duration}m outside "
                f"{MIN_RUN_MINUTES}-{MAX_RUN_MINUTES} min window"
            )

        if t["category"] not in VALID_CATEGORIES:
            raise ValueError(f"Train row {idx}: invalid category {t['category']!r}")

        days = t["days"]
        if not isinstance(days, list) or not days:
            raise ValueError(f"Train row {idx}: days must be non-empty list")
        invalid_days = set(days) - VALID_DAYS
        if invalid_days:
            raise ValueError(f"Train row {idx}: invalid days {invalid_days}")

        d_from = parse_iso_date(t["valid_from"])
        d_to = parse_iso_date(t["valid_to"])
        if d_from > d_to:
            raise ValueError(f"Train row {idx}: valid_from ({d_from}) > valid_to ({d_to})")

        # The PDF prints period variants of the same train in separate columns
        # (e.g. "fino al 16/11" and "dal 17/11"): allowed, but only with
        # different calendar notes. Exact duplicates are rejected.
        run_key = (from_st, to_st, str(t["train"]), t["depart"], t["arrive"], t["calendar_note"])
        if run_key in seen_run_keys:
            raise ValueError(f"Duplicate train run: {run_key[:4]}")
        seen_run_keys.add(run_key)

        if not t["source"].startswith("https://") or "#page=" not in t["source"]:
            raise ValueError(f"Train row {idx}: source must cite the PDF page (#page=N)")

        interpretation = parser.parse(t["calendar_note"])
        if not interpretation.interpretable:
            raise ValueError(
                f"Train row {idx} ({t['train']}): calendar note not interpretable: "
                f"{' / '.join(interpretation.unparsed)}"
            )

    def count(origin: str, destination: str) -> int:
        return sum(1 for t in data if t["from"] == origin and t["to"] == destination)

    return {
        "total": len(data),
        "reggio_to_modena": count("Reggio Emilia", "Modena"),
        "modena_to_reggio": count("Modena", "Reggio Emilia"),
        "rubiera": sum(1 for t in data if "Rubiera" in (t["from"], t["to"])),
    }


def validate_stations(data: list[dict]) -> int:
    if not isinstance(data, list) or len(data) < 2:
        raise ValueError("stations.json must contain at least 2 stations")
    ids = set()
    for s in data:
        for k in ("id", "name", "city", "lat", "lon"):
            if k not in s:
                raise ValueError(f"Station missing field {k}")
        if s["id"] in ids:
            raise ValueError(f"Duplicate station id: {s['id']}")
        ids.add(s["id"])
        if not (44.5 <= s["lat"] <= 44.8 and 10.5 <= s["lon"] <= 11.1):
            raise ValueError(f"Station {s['id']} coords out of Emilia bounds")
    return len(data)


def validate_locations(data: list[dict]) -> int:
    if not isinstance(data, list) or len(data) < 5:
        raise ValueError("locations.json must contain at least 5 locations")
    ids = set()
    for loc in data:
        for k in ("id", "name", "city", "lat", "lon", "reference_station"):
            if k not in loc:
                raise ValueError(f"Location missing field {k}")
        if loc["id"] in ids:
            raise ValueError(f"Duplicate location id: {loc['id']}")
        ids.add(loc["id"])
        if not (44.5 <= loc["lat"] <= 44.8 and 10.5 <= loc["lon"] <= 11.1):
            raise ValueError(f"Location {loc['id']} coords out of bounds")
    return len(data)


def validate_segments(data: list[dict]) -> int:
    if not isinstance(data, list) or len(data) < 5:
        raise ValueError("segments.json must contain at least 5 segments")
    ids = set()
    for seg in data:
        for k in (
            "id",
            "origin",
            "destination",
            "walk_minutes",
            "bike_minutes",
            "walking",
            "cycling",
        ):
            if k not in seg:
                raise ValueError(f"Segment missing field {k}")
        if seg["id"] in ids:
            raise ValueError(f"Duplicate segment id: {seg['id']}")
        ids.add(seg["id"])
        if not (isinstance(seg["walk_minutes"], int) and seg["walk_minutes"] > 0):
            raise ValueError(f"Invalid walk_minutes for segment {seg['id']}")
        if not (isinstance(seg["bike_minutes"], int) and seg["bike_minutes"] > 0):
            raise ValueError(f"Invalid bike_minutes for segment {seg['id']}")
        if seg["bike_minutes"] > seg["walk_minutes"]:
            raise ValueError(f"Bike minutes should not exceed walk minutes for {seg['id']}")
    return len(data)


def main() -> None:
    data_dir = Path(__file__).resolve().parent.parent / "data"

    trains_path = data_dir / "trains.json"
    stations_path = data_dir / "stations.json"
    locations_path = data_dir / "locations.json"
    segments_path = data_dir / "segments.json"

    print("=== UnimoreGo Data Validation ===")

    print(f"Validating {stations_path.name}...")
    stations_data = json.loads(stations_path.read_text(encoding="utf-8"))
    st_count = validate_stations(stations_data)
    print(f"  OK: {st_count} stations validated.")

    print(f"Validating {locations_path.name}...")
    loc_data = json.loads(locations_path.read_text(encoding="utf-8"))
    loc_count = validate_locations(loc_data)
    print(f"  OK: {loc_count} campus locations validated.")

    print(f"Validating {segments_path.name}...")
    seg_data = json.loads(segments_path.read_text(encoding="utf-8"))
    seg_count = validate_segments(seg_data)
    print(f"  OK: {seg_count} segments validated.")

    print(f"Validating {trains_path.name}...")
    trains_data = json.loads(trains_path.read_text(encoding="utf-8"))
    stats = validate_trains(trains_data)
    print(
        f"  OK: {stats['total']} train runs validated "
        f"({stats['reggio_to_modena']} RE->MO, {stats['modena_to_reggio']} MO->RE, "
        f"{stats['rubiera']} to/from Rubiera)."
    )

    print("\nALL DATASET VALIDATIONS PASSED SUCCESSFULLY.")


if __name__ == "__main__":
    main()
