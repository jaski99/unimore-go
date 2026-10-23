"""Timetable validity window derived from the loaded train data.

The window is never hard-coded: it is the span between the earliest
``valid_from`` and the latest ``valid_to`` of the loaded runs, so a new
timetable edition only requires new data files.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from engine.models import TrainRun, parse_date_str


def format_it_date(day: date) -> str:
    """Format a date as DD/MM/YYYY (Italian convention)."""
    return day.strftime("%d/%m/%Y")


@dataclass(frozen=True)
class TimetableValidity:
    """Inclusive date range covered by the loaded timetable."""

    valid_from: date
    valid_to: date

    @classmethod
    def from_trains(cls, trains: Iterable[TrainRun]) -> TimetableValidity:
        runs = list(trains)
        if not runs:
            raise ValueError("Cannot derive timetable validity without train runs")
        return cls(
            valid_from=min(parse_date_str(t.valid_from) for t in runs),
            valid_to=max(parse_date_str(t.valid_to) for t in runs),
        )

    def contains(self, day: date) -> bool:
        return self.valid_from <= day <= self.valid_to

    def warning_for(self, day: date) -> str | None:
        """Explicit Italian warning when ``day`` is outside the window."""
        if day > self.valid_to:
            return (
                f"Attenzione: il {format_it_date(day)} è dopo la fine di validità dell'orario "
                f"caricato ({format_it_date(self.valid_to)}). Non ci sono dati sui treni per "
                "questa data: controlla il nuovo orario Trenitalia."
            )
        if day < self.valid_from:
            return (
                f"Attenzione: il {format_it_date(day)} è prima dell'inizio di validità dell'orario "
                f"caricato ({format_it_date(self.valid_from)}). Non ci sono dati sui treni per "
                "questa data."
            )
        return None
