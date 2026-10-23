"""Mode suggestions for same-city trips (round 4, point 2).

A same-city walk longer than ``WALK_SUGGESTION_THRESHOLD_MIN`` suggests the
bike, with its own time from the bike planner (OSRM distance at 15 km/h).
"""

from __future__ import annotations

from collections.abc import Callable

from engine.durations import format_minutes
from engine.models import ModeSuggestion

WALK_SUGGESTION_THRESHOLD_MIN = 20


def bike_suggestion(
    mode: str, walk_minutes: int, bike_minutes: Callable[[], int]
) -> ModeSuggestion | None:
    """The bike alternative to a long walk, or ``None`` when not worth it.

    ``bike_minutes`` is called only when a suggestion is possible.
    """
    if mode != "walk" or walk_minutes <= WALK_SUGGESTION_THRESHOLD_MIN:
        return None
    minutes = bike_minutes()
    if minutes >= walk_minutes:
        return None
    return ModeSuggestion(
        mode="bike",
        minutes=minutes,
        message=(
            f"In bici circa {format_minutes(minutes)} (a piedi {format_minutes(walk_minutes)})."
        ),
    )
