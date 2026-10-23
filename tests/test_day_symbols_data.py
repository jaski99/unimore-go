"""Day-of-week symbols in the real dataset (round 3, item 9).

Facts checked by eye on Regionale_Emilia.pdf (edition valid 17/10-12/12/2026):
R 17405 Reggio Emilia 07:33 carries ⚒ (lavorativi, file page 75); at 12:44 the
same slot is R 3921 ⚒ on working days and R 3953 † (festivi) on Sundays and
holidays (file page 92). Holidays follow the Sunday service.
"""

from datetime import date

import pytest

from engine.calendar_rules import CalendarNoteParser
from engine.repositories import JsonTrainRepository
from engine.service_calendar import ServiceCalendar

SUNDAY, MONDAY, SATURDAY = date(2026, 10, 25), date(2026, 10, 26), date(2026, 10, 24)
IMMACOLATA = date(2026, 12, 8)  # Tuesday, national holiday


@pytest.fixture(scope="module")
def runs_on():
    trains = JsonTrainRepository().get_trains("Reggio Emilia", "Modena")
    calendar = ServiceCalendar(CalendarNoteParser(edition_start=date(2026, 6, 14)))

    def trains_at(depart: str, day: date) -> set[str]:
        return {t.train for t in trains if t.depart == depart and calendar.runs_on(t, day)}

    return trains_at


def test_working_day_train_does_not_run_on_sunday(runs_on) -> None:
    assert runs_on("07:33", MONDAY) == {"17405"}
    assert runs_on("07:33", SATURDAY) == {"17405"}
    assert runs_on("07:33", SUNDAY) == set()
    assert runs_on("07:33", IMMACOLATA) == set()


def test_same_slot_is_served_by_the_festive_train_on_sundays_and_holidays(runs_on) -> None:
    assert runs_on("12:44", MONDAY) == {"3921"}
    assert runs_on("12:44", SUNDAY) == {"3953"}
    assert runs_on("12:44", IMMACOLATA) == {"3953"}


def test_only_a_minority_of_runs_is_day_restricted() -> None:
    trains = JsonTrainRepository().all_trains()
    restricted = [t for t in trains if len(t.days) < 7]
    assert len(trains) == 402
    assert len(restricted) == 30
    assert all("simbolo" in t.source for t in restricted)
