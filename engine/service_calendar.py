"""Decide whether a train run operates on a given date.

Combines three sources, in this order:

1. the structured fields of the run (``valid_from``/``valid_to``, ``days``);
2. national public holidays: the dataset transcribes weekday service, so on a
   weekday holiday (e.g. 8/12) a run is kept only if it is marked as running
   on Sundays (holidays follow the Sunday service);
3. the interpreted calendar note (see :mod:`engine.calendar_rules`).

Notes that cannot be interpreted never filter a run; they produce a warning
that quotes the note and cites the PDF page instead.
"""

from __future__ import annotations

import re
from datetime import date

from engine.calendar_rules import CalendarInterpretation, CalendarNoteParser
from engine.holidays import is_public_holiday
from engine.models import TrainRun, parse_date_str

DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
_PAGE_REF = re.compile(r"#page=(?P<page>\d+)(?:\s*\((?P<detail>[^)]*)\))?")
_EXCERPT_LEN = 140


def pdf_reference(source: str) -> str:
    """Human citation of the PDF page encoded in a TrainRun ``source`` URL."""
    file_name = source.split("#", 1)[0].rsplit("/", 1)[-1] or "PDF Trenitalia"
    match = _PAGE_REF.search(source)
    if not match:
        return file_name
    detail = f" ({match.group('detail')})" if match.group("detail") else ""
    return f"{file_name}, pag. {match.group('page')}{detail}"


class ServiceCalendar:
    """Calendar service for train runs (interpretations are cached per note)."""

    def __init__(self, parser: CalendarNoteParser) -> None:
        self.parser = parser
        self._cache: dict[str, CalendarInterpretation] = {}

    def interpretation(self, train: TrainRun) -> CalendarInterpretation:
        note = train.calendar_note or ""
        if note not in self._cache:
            self._cache[note] = self.parser.parse(note)
        return self._cache[note]

    def runs_on(self, train: TrainRun, day: date) -> bool:
        if not (parse_date_str(train.valid_from) <= day <= parse_date_str(train.valid_to)):
            return False
        day_key = "sun" if is_public_holiday(day) else DAY_KEYS[day.weekday()]
        if day_key not in train.days:
            return False
        return self.interpretation(train).runs_on(day)

    def warning_for(self, train: TrainRun) -> str | None:
        """Italian warning for runs whose note could not be interpreted."""
        interpretation = self.interpretation(train)
        if interpretation.interpretable:
            return None
        excerpt = " / ".join(interpretation.unparsed)
        if len(excerpt) > _EXCERPT_LEN:
            excerpt = excerpt[: _EXCERPT_LEN - 1].rstrip() + "…"
        return (
            f"Nota di calendario non interpretata ({interpretation.reason}): «{excerpt}». "
            f"Verifica che il treno circoli quel giorno: {pdf_reference(train.source)}."
        )
