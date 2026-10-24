"""Tests for engine/journeys/suggestion.py (same-city bike suggestion)."""

from engine.journeys.suggestion import WALK_SUGGESTION_THRESHOLD_MIN, bike_suggestion
from engine.models import ModeSuggestion


def never() -> int:
    raise AssertionError("bike time must not be computed")


def test_long_walk_suggests_the_bike() -> None:
    assert bike_suggestion("walk", 53, lambda: 22) == ModeSuggestion(
        "bike", 22, "In bici circa 22 min (a piedi 53 min)."
    )


def test_long_walks_use_hours() -> None:
    suggestion = bike_suggestion("walk", 75, lambda: 25)
    assert suggestion is not None
    assert suggestion.message == "In bici circa 25 min (a piedi 1 h 15 min)."


def test_short_walks_and_bike_trips_get_no_suggestion() -> None:
    assert WALK_SUGGESTION_THRESHOLD_MIN == 20
    assert bike_suggestion("walk", 20, never) is None
    assert bike_suggestion("bike", 53, never) is None


def test_no_suggestion_when_the_bike_is_not_faster() -> None:
    assert bike_suggestion("walk", 21, lambda: 21) is None
