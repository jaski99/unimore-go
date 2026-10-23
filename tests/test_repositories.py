"""Unit tests for engine/repositories.py."""

from pathlib import Path

import pytest

from engine.models import Campus, Station, TrainRun
from engine.repositories import (
    JsonLocationRepository,
    JsonSegmentRepository,
    JsonTrainRepository,
    LocationRepository,
    SegmentRepository,
    TrainRepository,
)


def test_json_train_repository():
    repo = JsonTrainRepository()
    trains = repo.all_trains()
    assert len(trains) >= 100

    re_to_mo = repo.get_trains("Reggio Emilia", "Modena")
    assert len(re_to_mo) >= 50

    # Case insensitivity and FS suffix tolerance
    re_to_mo_fs = repo.get_trains("Reggio Emilia FS", "Modena FS")
    assert len(re_to_mo_fs) == len(re_to_mo)

    # Empty for invalid route
    assert repo.get_trains("Modena", "Bologna") == []


def test_json_train_repository_missing_file(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        JsonTrainRepository(tmp_path / "non_existent.json")


def test_json_location_repository():
    repo = JsonLocationRepository()
    campuses = repo.all_campuses()
    assert len(campuses) == 5

    # Known campuses
    dief = repo.get_campus("dief")
    assert dief is not None
    assert dief.city == "Modena"
    assert dief.reference_station == "Modena FS"

    palazzo = repo.get_campus("palazzo_dossetti")
    assert palazzo is not None
    assert palazzo.city == "Reggio Emilia"

    assert repo.get_campus("unknown_campus") is None

    # Stations
    stations = repo.all_stations()
    assert [s.id for s in stations] == ["modena_fs", "rubiera", "reggio_fs"]
    rubiera = repo.get_station("rubiera")
    assert rubiera is not None and rubiera.city == "Rubiera"

    mo_fs = repo.get_station("modena_fs")
    assert mo_fs is not None
    assert mo_fs.name == "Modena FS"

    # Name lookup
    assert repo.get_station_by_name("Modena FS") == mo_fs
    assert repo.get_station_by_name("Modena") == mo_fs
    assert repo.get_station_by_name("Reggio Emilia FS") is not None
    assert repo.get_station_by_name("Unknown Station") is None


def test_json_location_repository_missing_files(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        JsonLocationRepository(
            locations_path=tmp_path / "locs.json",
            stations_path=tmp_path / "stations.json",
        )


def test_json_segment_repository():
    repo = JsonSegmentRepository()

    # Precalculated minutes
    walk_min = repo.get_minutes("modena_fs", "dief", "walk")
    bike_min = repo.get_minutes("modena_fs", "dief", "bike")
    assert walk_min == 53
    assert bike_min == 22

    # Bi-directional / symmetric lookup
    assert repo.get_minutes("dief", "modena_fs", "walk") == 53

    # Unknown segment
    assert repo.get_minutes("modena_fs", "unknown_dest", "walk") is None
    assert repo.get_segment("modena_fs", "unknown_dest") is None


def test_json_segment_repository_missing_file(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        JsonSegmentRepository(tmp_path / "non_existent.json")


def test_custom_in_memory_repositories():
    """Verify abstract interface can be implemented cleanly by custom classes (OCP/LSP)."""

    class MemoryTrainRepo(TrainRepository):
        def get_trains(self, from_station: str, to_station: str) -> list[TrainRun]:
            return [
                TrainRun(
                    from_station=from_station,
                    to_station=to_station,
                    depart="08:00",
                    arrive="08:15",
                    train="1234",
                    category="Regionale",
                    operator="Trenitalia Tper",
                    days=("mon", "tue", "wed", "thu", "fri"),
                    valid_from="2026-10-17",
                    valid_to="2026-12-12",
                    calendar_note="",
                    source="",
                )
            ]

        def all_trains(self) -> list[TrainRun]:
            return self.get_trains("A", "B")

    class MemoryLocationRepo(LocationRepository):
        def get_campus(self, campus_id: str) -> Campus | None:
            return Campus(
                id="test_campus",
                name="Test Campus",
                address="Via Test 1",
                city="Modena",
                lat=44.6,
                lon=10.9,
                reference_station="Modena FS",
            )

        def all_campuses(self) -> list[Campus]:
            c = self.get_campus("test")
            return [c] if c else []

        def get_station(self, station_id: str) -> Station | None:
            return Station("modena_fs", "Modena FS", "Modena", 44.6, 10.9)

        def get_station_by_name(self, name: str) -> Station | None:
            return self.get_station("modena_fs")

        def all_stations(self) -> list[Station]:
            s = self.get_station("modena_fs")
            return [s] if s else []

    class MemorySegmentRepo(SegmentRepository):
        def get_segment(self, origin_id: str, destination_id: str) -> dict | None:
            return {"id": "seg"}

        def get_minutes(self, origin_id: str, destination_id: str, mode: str) -> int | None:
            return 10 if mode == "walk" else 4

    tr = MemoryTrainRepo()
    assert len(tr.all_trains()) == 1
    loc = MemoryLocationRepo()
    assert loc.get_campus("x") is not None
    seg = MemorySegmentRepo()
    assert seg.get_minutes("a", "b", "walk") == 10
