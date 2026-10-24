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

WEEKDAYS_IT_SHORT = ("lun", "mar", "mer", "gio", "ven", "sab", "dom")
MONTHS_IT_SHORT = (
    "gen",
    "feb",
    "mar",
    "apr",
    "mag",
    "giu",
    "lug",
    "ago",
    "set",
    "ott",
    "nov",
    "dic",
)


def format_it_day(day: date) -> str:
    """Short Italian date, e.g. "dom 25 ott 2026" (locale independent).

    Same text as ``Intl.DateTimeFormat('it-IT', {weekday, day, month: 'short',
    year})`` in the web app, so API messages and UI read alike.
    """
    weekday = WEEKDAYS_IT_SHORT[day.weekday()]
    return f"{weekday} {day.day} {MONTHS_IT_SHORT[day.month - 1]} {day.year}"


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
        window = f"valido dal {format_it_day(self.valid_from)} al {format_it_day(self.valid_to)}"
        if day > self.valid_to:
            return (
                f"{format_it_day(day).capitalize()} è dopo la fine di validità "
                "dell'orario caricato "
                f"({window}): non ci sono dati sui treni per questa data. Controlla il nuovo "
                "orario Trenitalia; qui sotto trovi la soluzione più vicina nel periodo coperto."
            )
        if day < self.valid_from:
            return (
                f"{format_it_day(day).capitalize()} è prima dell'inizio di validità "
                f"dell'orario caricato ({window}): non ci sono dati sui treni per questa data."
            )
        return None
