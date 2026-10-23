"""Tests for engine/durations.py: the one minutes formatter of API messages."""

import pytest

from engine.durations import format_minutes


@pytest.mark.parametrize(
    ("minutes", "text"),
    [
        (0, "0 min"),
        (1, "1 min"),
        (59, "59 min"),
        (60, "1 h"),
        (61, "1 h 1 min"),
        (125, "2 h 5 min"),
        (152, "2 h 32 min"),
        (272, "4 h 32 min"),
        (1440, "24 h"),
    ],
)
def test_format_minutes(minutes: int, text: str) -> None:
    # Same cases as web/src/lib/time-format.test.ts (formatDuration).
    assert format_minutes(minutes) == text


def test_negative_minutes_are_rejected() -> None:
    with pytest.raises(ValueError):
        format_minutes(-1)
