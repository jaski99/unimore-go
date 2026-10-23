"""Domain models for UnimoreGo planning engine.

Contains immutable dataclasses representing stations, campuses, train runs,
legs, itineraries, and plan requests following SOLID principles.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time


def time_to_minutes(t: time) -> int:
    """Convert a time object to minutes from midnight."""
    return t.hour * 60 + t.minute


def minutes_to_time(m: int) -> time:
    """Convert minutes from midnight to a time object (modulo 24h)."""
    m = m % (24 * 60)
    return time(hour=m // 60, minute=m % 60)


def format_time(t: time) -> str:
    """Format time as HH:MM string."""
    return f"{t.hour:02d}:{t.minute:02d}"


def parse_time_str(val: str | time) -> time:
    """Parse a time string HH:MM or return time object."""
    if isinstance(val, time):
        return val
    parts = val.strip().split(":")
    return time(hour=int(parts[0]), minute=int(parts[1]))


def parse_date_str(val: str | date) -> date:
    """Parse an ISO date string YYYY-MM-DD or return date object."""
    if isinstance(val, date):
        return val
    return date.fromisoformat(val.strip())


@dataclass(frozen=True)
class Station:
    """Railway station entity."""

    id: str
    name: str
    city: str
    lat: float
    lon: float
    address: str = ""
    uic_code: str = ""


@dataclass(frozen=True)
class Campus:
    """University campus / department entity."""

    id: str
    name: str
    address: str
    city: str
    lat: float
    lon: float
    reference_station: str
    source: str = ""


@dataclass(frozen=True)
class TrainRun:
    """A scheduled regional or long-distance train run."""

    from_station: str
    to_station: str
    depart: str
    arrive: str
    train: str
    category: str
    operator: str
    days: tuple[str, ...]
    valid_from: str
    valid_to: str
    calendar_note: str
    source: str

    @property
    def depart_time(self) -> time:
        return parse_time_str(self.depart)

    @property
    def arrive_time(self) -> time:
        return parse_time_str(self.arrive)

    @property
    def duration_minutes(self) -> int:
        dep = time_to_minutes(self.depart_time)
        arr = time_to_minutes(self.arrive_time)
        if arr < dep:
            arr += 24 * 60
        return arr - dep


@dataclass(frozen=True)
class Leg:
    """A single segment of an itinerary (walk, bike, or train)."""

    leg_type: str  # "walk" | "bike" | "train"
    origin: str
    destination: str
    depart: str
    arrive: str
    minutes: int
    train: TrainRun | None = None

    @property
    def depart_time(self) -> time:
        return parse_time_str(self.depart)

    @property
    def arrive_time(self) -> time:
        return parse_time_str(self.arrive)


@dataclass(frozen=True)
class Itinerary:
    """A complete commuter journey from origin to campus."""

    leave_at: str
    legs: tuple[Leg, ...]
    arrive_at: str
    slack_min: int
    warnings: tuple[str, ...] = ()

    @property
    def leave_time(self) -> time:
        return parse_time_str(self.leave_at)

    @property
    def arrive_time(self) -> time:
        return parse_time_str(self.arrive_at)

    @property
    def total_travel_minutes(self) -> int:
        return sum(leg.minutes for leg in self.legs)


@dataclass(frozen=True)
class PlanRequest:
    """Request parameters for door-to-door itinerary planning."""

    target_date: str | date
    target_time: str | time
    destination_campus_id: str
    origin_station_id: str | None = None
    origin_coords: tuple[float, float] | None = None
    origin_city: str | None = None
    first_mile_mode: str = "walk"  # "walk" | "bike"
    first_mile_minutes: int | None = None
    last_mile_mode: str = "walk"  # "walk" | "bike"
    margin_minutes: int = 10

    @property
    def parsed_date(self) -> date:
        return parse_date_str(self.target_date)

    @property
    def parsed_time(self) -> time:
        return parse_time_str(self.target_time)
