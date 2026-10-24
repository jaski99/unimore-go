"""Repository abstractions and JSON implementations for UnimoreGo.

Follows the Repository Pattern and Dependency Inversion Principle (DIP):
the planner depends purely on abstract interfaces, allowing seamless extension
to database, remote API, or test mock repositories without altering planner logic.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path

from engine.models import Campus, Station, TrainRun

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def station_key(name: str) -> str:
    """Matching key for station names ("Reggio Emilia FS" == "Reggio Emilia")."""
    return name.lower().strip().replace(" fs", "")


class TrainRepository(ABC):
    """Abstract interface for accessing train timetable data."""

    @abstractmethod
    def get_trains(self, from_station: str, to_station: str) -> list[TrainRun]:
        """Return all scheduled train runs between two stations."""
        ...

    @abstractmethod
    def all_trains(self) -> list[TrainRun]:
        """Return all train runs in the repository."""
        ...


class LocationRepository(ABC):
    """Abstract interface for accessing university campuses and stations."""

    @abstractmethod
    def get_campus(self, campus_id: str) -> Campus | None:
        """Lookup campus by ID."""
        ...

    @abstractmethod
    def all_campuses(self) -> list[Campus]:
        """Return all university campuses."""
        ...

    @abstractmethod
    def get_station(self, station_id: str) -> Station | None:
        """Lookup station by ID."""
        ...

    @abstractmethod
    def get_station_by_name(self, name: str) -> Station | None:
        """Lookup station by name (e.g. 'Modena FS' or 'Reggio Emilia')."""
        ...

    @abstractmethod
    def all_stations(self) -> list[Station]:
        """Return all railway stations."""
        ...


class SegmentRepository(ABC):
    """Abstract interface for accessing active transport segment measurements."""

    @abstractmethod
    def get_segment(self, origin_id: str, destination_id: str) -> dict | None:
        """Lookup segment data by origin and destination IDs."""
        ...

    @abstractmethod
    def get_minutes(self, origin_id: str, destination_id: str, mode: str) -> int | None:
        """Return precalculated travel duration in minutes for mode ('walk' or 'bike')."""
        ...


class JsonTrainRepository(TrainRepository):
    """JSON-backed implementation of TrainRepository."""

    def __init__(self, file_path: str | Path | None = None) -> None:
        self.file_path = Path(file_path) if file_path else DEFAULT_DATA_DIR / "trains.json"
        self._trains: list[TrainRun] = []
        self._load()

    def _load(self) -> None:
        if not self.file_path.exists():
            raise FileNotFoundError(f"Trains JSON file not found: {self.file_path}")
        raw_data = json.loads(self.file_path.read_text(encoding="utf-8"))
        self._trains = [
            TrainRun(
                from_station=item["from"],
                to_station=item["to"],
                depart=item["depart"],
                arrive=item["arrive"],
                train=str(item["train"]),
                category=item["category"],
                operator=item["operator"],
                days=tuple(item.get("days", ["mon", "tue", "wed", "thu", "fri"])),
                valid_from=item["valid_from"],
                valid_to=item["valid_to"],
                calendar_note=item["calendar_note"],
                source=item["source"],
            )
            for item in raw_data
        ]

    def get_trains(self, from_station: str, to_station: str) -> list[TrainRun]:
        key = (station_key(from_station), station_key(to_station))
        return [
            t
            for t in self._trains
            if (station_key(t.from_station), station_key(t.to_station)) == key
        ]

    def all_trains(self) -> list[TrainRun]:
        return list(self._trains)


class JsonLocationRepository(LocationRepository):
    """JSON-backed implementation of LocationRepository."""

    def __init__(
        self,
        locations_path: str | Path | None = None,
        stations_path: str | Path | None = None,
    ) -> None:
        self.locations_path = (
            Path(locations_path) if locations_path else DEFAULT_DATA_DIR / "locations.json"
        )
        self.stations_path = (
            Path(stations_path) if stations_path else DEFAULT_DATA_DIR / "stations.json"
        )
        self._campuses: dict[str, Campus] = {}
        self._stations: dict[str, Station] = {}
        self._stations_by_name: dict[str, Station] = {}
        self._load()

    def _load(self) -> None:
        if not self.locations_path.exists():
            raise FileNotFoundError(f"Locations file not found: {self.locations_path}")
        if not self.stations_path.exists():
            raise FileNotFoundError(f"Stations file not found: {self.stations_path}")

        raw_locs = json.loads(self.locations_path.read_text(encoding="utf-8"))
        for item in raw_locs:
            c = Campus(
                id=item["id"],
                name=item["name"],
                address=item["address"],
                city=item["city"],
                lat=float(item["lat"]),
                lon=float(item["lon"]),
                reference_station=item["reference_station"],
                source=item.get("source", ""),
            )
            self._campuses[c.id] = c

        raw_stations = json.loads(self.stations_path.read_text(encoding="utf-8"))
        for item in raw_stations:
            s = Station(
                id=item["id"],
                name=item["name"],
                city=item["city"],
                lat=float(item["lat"]),
                lon=float(item["lon"]),
                address=item.get("address", ""),
                uic_code=item.get("uic_code", ""),
            )
            self._stations[s.id] = s
            self._stations_by_name[s.name.lower().strip()] = s
            # also register without FS suffix
            clean_name = s.name.lower().replace(" fs", "").strip()
            self._stations_by_name[clean_name] = s

    def get_campus(self, campus_id: str) -> Campus | None:
        return self._campuses.get(campus_id)

    def all_campuses(self) -> list[Campus]:
        return list(self._campuses.values())

    def get_station(self, station_id: str) -> Station | None:
        return self._stations.get(station_id)

    def get_station_by_name(self, name: str) -> Station | None:
        return self._stations_by_name.get(name.lower().strip())

    def all_stations(self) -> list[Station]:
        return list(self._stations.values())


class JsonSegmentRepository(SegmentRepository):
    """JSON-backed implementation of SegmentRepository."""

    def __init__(self, file_path: str | Path | None = None) -> None:
        self.file_path = Path(file_path) if file_path else DEFAULT_DATA_DIR / "segments.json"
        self._segments: dict[tuple[str, str], dict] = {}
        self._load()

    def _load(self) -> None:
        if not self.file_path.exists():
            raise FileNotFoundError(f"Segments file not found: {self.file_path}")
        raw_data = json.loads(self.file_path.read_text(encoding="utf-8"))
        for item in raw_data:
            orig_id = item["origin"]["id"]
            dest_id = item["destination"]["id"]
            self._segments[(orig_id, dest_id)] = item
            # Also register bi-directional lookup if symmetric
            if (dest_id, orig_id) not in self._segments:
                self._segments[(dest_id, orig_id)] = item

    def get_segment(self, origin_id: str, destination_id: str) -> dict | None:
        return self._segments.get((origin_id, destination_id))

    def get_minutes(self, origin_id: str, destination_id: str, mode: str) -> int | None:
        seg = self.get_segment(origin_id, destination_id)
        if not seg:
            return None
        if mode == "bike":
            return seg.get("bike_minutes")
        return seg.get("walk_minutes")
