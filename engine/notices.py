"""User-facing notices with a priority and merge rules.

Planners used to emit flat strings, so one date could produce three warnings
saying the same thing ("fuori validità", "domenica", "nessun treno"). Each
notice now has a ``code`` and a ``level``; :class:`NoticeComposer` removes
duplicates, applies merge rules and sorts by priority, so the UI can show one
clear primary message.

Merge rules are small strategy objects: a new rule is appended to the
composer's registry without touching planners (Open/Closed).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, replace

# Codes (stable identifiers the UI may rely on).
OUT_OF_VALIDITY = "out_of_validity"
NO_SERVICE = "no_service"
CALENDAR_NOTE = "calendar_note"
HOME_FAR = "home_far"
HOME_UNKNOWN = "home_unknown"
FESTIVE_DAY = "festive_day"
SAME_CITY = "same_city"
ESTIMATE = "estimate"
NOT_REALTIME = "not_realtime"
GENERIC = "generic"

ERROR, WARNING, INFO = "error", "warning", "info"

PRIORITY: dict[str, int] = {
    OUT_OF_VALIDITY: 100,
    NO_SERVICE: 90,
    CALENDAR_NOTE: 70,
    HOME_FAR: 60,
    HOME_UNKNOWN: 50,
    FESTIVE_DAY: 30,
    SAME_CITY: 25,
    ESTIMATE: 20,
    GENERIC: 15,
    NOT_REALTIME: 10,
}


@dataclass(frozen=True)
class Notice:
    """A message for the user. ``level``: error | warning | info."""

    code: str
    level: str
    message: str

    @property
    def priority(self) -> int:
        return PRIORITY.get(self.code, PRIORITY[GENERIC])


class MergeRule(ABC):
    """Rewrite a list of notices (drop or combine related ones)."""

    @abstractmethod
    def apply(self, notices: list[Notice]) -> list[Notice]:
        """Return the rewritten list (never mutate the input)."""


def _first(notices: Sequence[Notice], code: str) -> Notice | None:
    return next((n for n in notices if n.code == code), None)


class OutOfValiditySupersedes(MergeRule):
    """Outside the timetable there is no data at all: "no train" and festive
    notices add nothing and are folded into the validity notice."""

    def apply(self, notices: list[Notice]) -> list[Notice]:
        validity = _first(notices, OUT_OF_VALIDITY)
        if validity is None:
            return list(notices)
        dropped = {NO_SERVICE, FESTIVE_DAY}
        return [n for n in notices if n.code not in dropped]


class FestiveIntoNoService(MergeRule):
    """When no train is found on a Sunday/holiday, say it once, in one notice."""

    def apply(self, notices: list[Notice]) -> list[Notice]:
        no_service = _first(notices, NO_SERVICE)
        festive = _first(notices, FESTIVE_DAY)
        if no_service is None or festive is None:
            return list(notices)
        merged = replace(no_service, message=f"{no_service.message} {festive.message}")
        return [merged if n is no_service else n for n in notices if n is not festive]


DEFAULT_MERGE_RULES: tuple[MergeRule, ...] = (OutOfValiditySupersedes(), FestiveIntoNoService())


class NoticeComposer:
    """Deduplicate, merge and sort notices (highest priority first)."""

    def __init__(self, rules: Iterable[MergeRule] = DEFAULT_MERGE_RULES) -> None:
        self.rules = tuple(rules)

    def compose(self, notices: Iterable[Notice]) -> tuple[Notice, ...]:
        unique: list[Notice] = []
        seen: set[str] = set()
        for notice in notices:
            if notice.message not in seen:
                seen.add(notice.message)
                unique.append(notice)
        for rule in self.rules:
            unique = rule.apply(unique)
        # Stable sort keeps the planner's order among equal priorities.
        return tuple(sorted(unique, key=lambda n: -n.priority))


def notice(code: str, message: str, level: str | None = None) -> Notice:
    """Build a notice with the default level for its code."""
    default = WARNING if PRIORITY.get(code, 0) >= PRIORITY[HOME_UNKNOWN] else INFO
    return Notice(code, level or default, message)
