"""Test doubles shared by engine and API tests."""

from __future__ import annotations

from engine.models import TrainRun
from engine.repositories import JsonTrainRepository, TrainRepository, station_key

PDF = (
    "https://www.trenitalia.com/content/dam/trenitalia/allegati/info/orario-digitale/"
    "orari-regionali/Regionale_Emilia.pdf"
)


def synthetic_run(**overrides) -> TrainRun:
    """A Reggio Emilia -> Modena run with an uninterpretable note (not in the PDF)."""
    values = {
        "from_station": "Reggio Emilia",
        "to_station": "Modena",
        "depart": "07:40",
        "arrive": "07:54",
        "train": "99999",
        "category": "Frecciarossa",
        "operator": "Trenitalia",
        "days": ("mon", "tue", "wed", "thu", "fri", "sat", "sun"),
        "valid_from": "2026-10-17",
        "valid_to": "2026-12-12",
        "calendar_note": "Nota 99: Si effettua secondo calendario speciale.",
        "source": f"{PDF}#page=74 (pagina stampata 62; note 99)",
    }
    values.update(overrides)
    return TrainRun(**values)


class ExtendedTrainRepository(TrainRepository):
    """Real timetable plus extra synthetic runs (decorator over a repository)."""

    def __init__(self, extra: list[TrainRun], base: TrainRepository | None = None) -> None:
        self.base = base or JsonTrainRepository()
        self.extra = list(extra)

    def get_trains(self, from_station: str, to_station: str) -> list[TrainRun]:
        key = (station_key(from_station), station_key(to_station))
        runs = self.base.get_trains(from_station, to_station) + [
            r for r in self.extra if (station_key(r.from_station), station_key(r.to_station)) == key
        ]
        return sorted(runs, key=lambda r: r.depart)

    def all_trains(self) -> list[TrainRun]:
        return self.base.all_trains() + self.extra
