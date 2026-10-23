"""Italian national public holidays.

Used by calendar rules ("festivi", "lavorativi") and by planners to warn the
user that the loaded timetable describes weekday service. Only national
holidays are modelled; local patron saints (San Geminiano in Modena on 31/01,
San Prospero in Reggio Emilia on 24/11) do not change the regional timetable
and are therefore not treated as holidays.
"""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

# (month, day, name) of fixed-date national holidays (L. 260/1949 and following).
FIXED_HOLIDAYS: tuple[tuple[int, int, str], ...] = (
    (1, 1, "Capodanno"),
    (1, 6, "Epifania"),
    (4, 25, "Festa della Liberazione"),
    (5, 1, "Festa del Lavoro"),
    (6, 2, "Festa della Repubblica"),
    (8, 15, "Ferragosto"),
    (11, 1, "Ognissanti"),
    (12, 8, "Immacolata Concezione"),
    (12, 25, "Natale"),
    (12, 26, "Santo Stefano"),
)


def easter_sunday(year: int) -> date:
    """Return Gregorian Easter Sunday (anonymous Gregorian algorithm)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l_ = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_) // 451
    month, day = divmod(h + l_ - 7 * m + 114, 31)
    return date(year, month, day + 1)


@lru_cache(maxsize=32)
def italian_holidays(year: int) -> dict[date, str]:
    """Map each national holiday date of ``year`` to its Italian name."""
    holidays = {date(year, month, day): name for month, day, name in FIXED_HOLIDAYS}
    easter = easter_sunday(year)
    holidays[easter] = "Pasqua"
    holidays[easter + timedelta(days=1)] = "Lunedì dell'Angelo"
    return holidays


def holiday_name(day: date) -> str | None:
    """Return the holiday name if ``day`` is a national holiday, else None."""
    return italian_holidays(day.year).get(day)


def is_public_holiday(day: date) -> bool:
    """True for national public holidays (Sundays are not included)."""
    return holiday_name(day) is not None


def is_festive(day: date) -> bool:
    """True for Sundays and national holidays (Trenitalia 'festivi')."""
    return day.weekday() == 6 or is_public_holiday(day)
