"""Strategies for planning active and train legs in UnimoreGo.

Follows the Strategy Pattern (Open/Closed Principle): new transport modes
(e.g., bus, scooter, park-and-ride) can be added as LegPlanner strategies
without modifying the core itinerary planner.
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from datetime import date, time

from engine.models import (
    Leg,
    TrainRun,
    format_time,
    minutes_to_time,
    parse_date_str,
    time_to_minutes,
)
from engine.repositories import SegmentRepository
from engine.service_calendar import DAY_KEYS, ServiceCalendar
from engine.train_categories import allowed

# Documented estimation constants
HAVERSINE_DETOUR_FACTOR = 1.3  # Street network circuity factor
WALK_SPEED_KMH = 4.5  # Standard urban walking speed: 4.5 km/h
BIKE_SPEED_KMH = 15.0  # Conservative urban commuter cycling speed: 15 km/h
EARTH_RADIUS_M = 6371000.0  # Mean Earth radius in meters


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two geographic coordinates in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_M * c


def estimate_active_minutes(distance_m: float, mode: str) -> int:
    """Estimate travel duration in minutes from straight-line distance.

    Applies the documented street network factor (1.3) and mode velocity:
    - walk: 4.5 km/h (~75 m/min)
    - bike: 15.0 km/h (~250 m/min)
    Rounds up to next whole minute (ceiling).
    """
    distance_km = (distance_m / 1000.0) * HAVERSINE_DETOUR_FACTOR
    speed_kmh = BIKE_SPEED_KMH if mode == "bike" else WALK_SPEED_KMH
    hours = distance_km / speed_kmh
    minutes = hours * 60.0
    return max(1, math.ceil(minutes))


class ActiveLegPlanner(ABC):
    """Abstract strategy for active mobility legs (walking or cycling)."""

    def __init__(self, segment_repo: SegmentRepository | None = None) -> None:
        self.segment_repo = segment_repo

    @property
    @abstractmethod
    def mode(self) -> str:
        """Mode name ('walk' or 'bike')."""
        ...

    def calculate_minutes(
        self,
        origin_id: str | None = None,
        destination_id: str | None = None,
        origin_coords: tuple[float, float] | None = None,
        destination_coords: tuple[float, float] | None = None,
        user_override_minutes: int | None = None,
    ) -> int:
        """Resolve leg travel time in minutes.

        Priority order:
        1. User-specified override minutes.
        2. Precalculated segment repository duration (OSRM / 15 km/h).
        3. Haversine distance * 1.3 detour / mode velocity.
        4. Safe default fallback (10 minutes).
        """
        if user_override_minutes is not None and user_override_minutes > 0:
            return user_override_minutes

        if self.segment_repo and origin_id and destination_id:
            seg_min = self.segment_repo.get_minutes(origin_id, destination_id, self.mode)
            if seg_min is not None and seg_min > 0:
                return seg_min

        if origin_coords and destination_coords:
            dist_m = haversine_distance_m(
                origin_coords[0],
                origin_coords[1],
                destination_coords[0],
                destination_coords[1],
            )
            return estimate_active_minutes(dist_m, self.mode)

        return 10  # Fallback commuter default

    def plan_leg_backward(
        self,
        origin_name: str,
        destination_name: str,
        arrive_by: time,
        origin_id: str | None = None,
        destination_id: str | None = None,
        origin_coords: tuple[float, float] | None = None,
        destination_coords: tuple[float, float] | None = None,
        user_override_minutes: int | None = None,
    ) -> Leg:
        """Plan a leg starting from a desired arrival time, working backward."""
        duration_min = self.calculate_minutes(
            origin_id=origin_id,
            destination_id=destination_id,
            origin_coords=origin_coords,
            destination_coords=destination_coords,
            user_override_minutes=user_override_minutes,
        )
        arr_total = time_to_minutes(arrive_by)
        dep_total = (arr_total - duration_min) % (24 * 60)
        dep_time = minutes_to_time(dep_total)

        return Leg(
            leg_type=self.mode,
            origin=origin_name,
            destination=destination_name,
            depart=format_time(dep_time),
            arrive=format_time(arrive_by),
            minutes=duration_min,
        )

    def plan_leg_forward(
        self,
        origin_name: str,
        destination_name: str,
        depart_at: time,
        origin_id: str | None = None,
        destination_id: str | None = None,
        origin_coords: tuple[float, float] | None = None,
        destination_coords: tuple[float, float] | None = None,
        user_override_minutes: int | None = None,
    ) -> Leg:
        """Plan a leg starting from a departure time, working forward."""
        duration_min = self.calculate_minutes(
            origin_id=origin_id,
            destination_id=destination_id,
            origin_coords=origin_coords,
            destination_coords=destination_coords,
            user_override_minutes=user_override_minutes,
        )
        dep_total = time_to_minutes(depart_at)
        arr_total = (dep_total + duration_min) % (24 * 60)
        arr_time = minutes_to_time(arr_total)

        return Leg(
            leg_type=self.mode,
            origin=origin_name,
            destination=destination_name,
            depart=format_time(depart_at),
            arrive=format_time(arr_time),
            minutes=duration_min,
        )


class WalkLegPlanner(ActiveLegPlanner):
    """Walking leg planner strategy."""

    @property
    def mode(self) -> str:
        return "walk"


class BikeLegPlanner(ActiveLegPlanner):
    """Bicycle leg planner strategy."""

    @property
    def mode(self) -> str:
        return "bike"


class TrainLegPlanner:
    """Strategy for selecting train runs and building train legs.

    With a :class:`ServiceCalendar` the PDF calendar notes and holidays are
    applied; without it only ``valid_from``/``valid_to`` and ``days`` are used.
    """

    DAY_MAP = dict(enumerate(DAY_KEYS))

    def __init__(self, calendar: ServiceCalendar | None = None) -> None:
        self.calendar = calendar

    def runs_on(self, train: TrainRun, day: date) -> bool:
        if self.calendar is not None:
            return self.calendar.runs_on(train, day)
        if not (parse_date_str(train.valid_from) <= day <= parse_date_str(train.valid_to)):
            return False
        return self.DAY_MAP[day.weekday()] in train.days

    def running_trains(
        self,
        trains: list[TrainRun],
        target_date: date | str,
        categories: frozenset[str] | None = None,
    ) -> list[TrainRun]:
        """Runs operating on ``target_date`` in the allowed category groups, by departure."""
        day = parse_date_str(target_date)
        selected = [t for t in trains if allowed(t.category, categories) and self.runs_on(t, day)]
        selected.sort(key=lambda t: time_to_minutes(t.depart_time))
        return self._one_per_slot(selected)

    def _one_per_slot(self, trains: list[TrainRun]) -> list[TrainRun]:
        """Keep one run per (departure, arrival) slot.

        The PDF prints the same slot in separate columns with different train
        numbers (e.g. weekday/Friday variants); the user needs it once. Runs
        whose calendar note was interpreted win over ambiguous ones.
        """
        best: dict[tuple[str, str], TrainRun] = {}
        for train in trains:
            slot = (train.depart, train.arrive)
            current = best.get(slot)
            if current is None or (self._has_warning(current) and not self._has_warning(train)):
                best[slot] = train
        return [t for t in trains if best[(t.depart, t.arrive)] is t]

    def _has_warning(self, train: TrainRun) -> bool:
        return self.calendar is not None and self.calendar.warning_for(train) is not None

    def filter_trains(
        self,
        trains: list[TrainRun],
        target_date: date | str,
        latest_arrival: time,
        categories: frozenset[str] | None = None,
    ) -> list[TrainRun]:
        """Runs operating on the date that arrive by ``latest_arrival`` (latest departure first)."""
        deadline_min = time_to_minutes(latest_arrival)
        qualified = [
            t
            for t in self.running_trains(trains, target_date, categories)
            if time_to_minutes(t.arrive_time) <= deadline_min
        ]
        qualified.sort(key=lambda t: time_to_minutes(t.depart_time), reverse=True)
        return qualified

    def build_train_leg(self, train: TrainRun) -> Leg:
        """Construct an immutable Leg from a TrainRun, with calendar-note warnings."""
        warning = self.calendar.warning_for(train) if self.calendar else None
        return Leg(
            leg_type="train",
            origin=train.from_station,
            destination=train.to_station,
            depart=train.depart,
            arrive=train.arrive,
            minutes=train.duration_minutes,
            train=train,
            notes=(warning,) if warning else (),
        )
