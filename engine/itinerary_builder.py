"""Helpers that assemble legs into itineraries.

Invariants enforced here (shared by every journey planner):

* walk/bike/wait legs of 0 minutes are never emitted;
* the station buffer is an explicit ``wait`` leg, so "leave at" is always
  earlier than the train departure when a buffer is configured;
* ``leave_at``/``arrive_at`` come from the first/last emitted leg.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date

from engine.models import Itinerary, Leg, format_time, minutes_to_time

WAIT_LEG = "wait"


def clock(minutes: int) -> str:
    """Minutes from midnight (any integer, wraps over days) to HH:MM."""
    return format_time(minutes_to_time(minutes))


def timed_leg(
    leg_type: str,
    origin: str,
    destination: str,
    depart_min: int,
    minutes: int,
) -> Leg | None:
    """Active or wait leg starting at ``depart_min``; None when it lasts 0 minutes."""
    if minutes <= 0:
        return None
    return Leg(
        leg_type=leg_type,
        origin=origin,
        destination=destination,
        depart=clock(depart_min),
        arrive=clock(depart_min + minutes),
        minutes=minutes,
    )


def station_wait_leg(station_name: str, start_min: int, minutes: int) -> Leg | None:
    """Time spent in the station before boarding (ticket, platform)."""
    return timed_leg(WAIT_LEG, station_name, station_name, start_min, minutes)


def assemble(
    legs: Iterable[Leg | None],
    slack_min: int,
    service_date: date,
    warnings: Iterable[str] = (),
) -> Itinerary:
    """Build an itinerary from legs, dropping empty ones."""
    kept = tuple(leg for leg in legs if leg is not None and (leg.minutes > 0))
    if not kept:
        raise ValueError("An itinerary needs at least one leg")
    return Itinerary(
        leave_at=kept[0].depart,
        legs=kept,
        arrive_at=kept[-1].arrive,
        slack_min=slack_min,
        warnings=tuple(warnings),
        service_date=service_date.isoformat(),
    )
