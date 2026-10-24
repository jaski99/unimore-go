"""Is a run's service on a festive day confirmed by the timetable data?

The Trenitalia PDF legend (file page 6, "SIMBOLI") lists only *restricting*
day symbols (⚒ lavorativi, † festivi, Ⓐ, Ⓑ, Ⓒ); a run without a symbol is read
as running every day, but the legend does not state it explicitly for
Sundays and holidays. On such days a run counts as verified only when:

* its day symbol explicitly includes the festive days (†, Ⓑ, Ⓒ: ``days``
  contains ``sun`` without being the whole week), or
* its calendar note names the day itself (a date list containing it, "nei
  giorni festivi", or Sunday as an explicit weekday).

Every other run gets the label "Circolazione nei festivi da verificare".
"""

from __future__ import annotations

from datetime import date

from engine.calendar_rules import (
    AllOf,
    AnyOf,
    CalendarInterpretation,
    CalendarRule,
    FestiveDays,
    OnlyDates,
    OnlyWeekdays,
)
from engine.holidays import is_festive
from engine.models import TrainRun
from engine.service_calendar import DAY_KEYS

FESTIVE_DAY_KEY = "sun"
SUNDAY = 6
FESTIVE_UNVERIFIED_LABEL = "Circolazione nei festivi da verificare"


def _symbol_includes_festive(train: TrainRun) -> bool:
    days = set(train.days)
    return FESTIVE_DAY_KEY in days and days != set(DAY_KEYS)


def _rule_names_day(rule: CalendarRule, day: date) -> bool:
    if isinstance(rule, OnlyDates):
        return day in rule.dates
    if isinstance(rule, FestiveDays):
        return rule.only
    if isinstance(rule, OnlyWeekdays):
        return day.weekday() == SUNDAY and SUNDAY in rule.days
    if isinstance(rule, AnyOf | AllOf):
        return any(_rule_names_day(child, day) for child in rule.rules)
    return False


def festive_service_unverified(
    train: TrainRun, day: date, interpretation: CalendarInterpretation
) -> bool:
    """True when ``train`` runs on festive ``day`` without explicit confirmation."""
    if not is_festive(day) or _symbol_includes_festive(train):
        return False
    if interpretation.interpretable and any(
        _rule_names_day(rule, day) for rule in interpretation.rules
    ):
        return False
    return True
