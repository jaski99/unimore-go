"""Human-readable durations for user-facing messages.

The single formatter for minutes in API texts ("4 h 32 min", never "272 min").
The web uses the same rules in ``web/src/lib/time-format.ts`` (``formatDuration``).
"""

from __future__ import annotations

MINUTES_PER_HOUR = 60


def format_minutes(minutes: int) -> str:
    """0 -> "0 min", 59 -> "59 min", 60 -> "1 h", 61 -> "1 h 1 min", 272 -> "4 h 32 min"."""
    if minutes < 0:
        raise ValueError(f"duration must be non-negative, got {minutes}")
    hours, rest = divmod(minutes, MINUTES_PER_HOUR)
    if not hours:
        return f"{rest} min"
    return f"{hours} h" if not rest else f"{hours} h {rest} min"
