"""Door-to-door itinerary planner for UNIMORE commuter students.

Calculates exact departure times, required train runs, and slack margins
for journeys between Modena and Reggio Emilia or intra-city journeys.
Respects Europe/Rome timezone, SOLID principles, and clean strategy decoupling.
"""

from __future__ import annotations

import zoneinfo
from datetime import date

from engine.legs import (
    ActiveLegPlanner,
    BikeLegPlanner,
    TrainLegPlanner,
    WalkLegPlanner,
)
from engine.models import (
    Itinerary,
    Leg,
    PlanRequest,
    Station,
    format_time,
    minutes_to_time,
    time_to_minutes,
)
from engine.repositories import LocationRepository, SegmentRepository, TrainRepository

ROME_TZ = zoneinfo.ZoneInfo("Europe/Rome")

TIMETABLE_VALID_FROM = date(2026, 10, 17)
TIMETABLE_VALID_TO = date(2026, 12, 12)

# Approximate central coordinates for city disambiguation
MODENA_CENTER = (44.646192, 10.926072)
REGGIO_CENTER = (44.697309, 10.642577)


class Planner:
    """Core door-to-door itinerary planner."""

    def __init__(
        self,
        train_repo: TrainRepository,
        location_repo: LocationRepository,
        segment_repo: SegmentRepository,
        walk_planner: ActiveLegPlanner | None = None,
        bike_planner: ActiveLegPlanner | None = None,
        train_leg_planner: TrainLegPlanner | None = None,
    ) -> None:
        self.train_repo = train_repo
        self.location_repo = location_repo
        self.segment_repo = segment_repo
        self.walk_planner = walk_planner or WalkLegPlanner(segment_repo)
        self.bike_planner = bike_planner or BikeLegPlanner(segment_repo)
        self.train_leg_planner = train_leg_planner or TrainLegPlanner()

    def _resolve_origin_city(
        self,
        request: PlanRequest,
        campus_city: str,
    ) -> str:
        """Deduce origin city from request parameters."""
        if request.origin_city:
            return request.origin_city.strip()

        if request.origin_station_id:
            st = self.location_repo.get_station(request.origin_station_id)
            if st:
                return st.city

        if request.origin_coords:
            lat, lon = request.origin_coords
            dist_mo = (lat - MODENA_CENTER[0]) ** 2 + (lon - MODENA_CENTER[1]) ** 2
            dist_re = (lat - REGGIO_CENTER[0]) ** 2 + (lon - REGGIO_CENTER[1]) ** 2
            return "Modena" if dist_mo < dist_re else "Reggio Emilia"

        # Default: commuter from the other city
        return "Reggio Emilia" if campus_city.lower() == "modena" else "Modena"

    def _get_active_planner(self, mode: str) -> ActiveLegPlanner:
        return self.bike_planner if mode.lower() == "bike" else self.walk_planner

    def arrive_by(self, request: PlanRequest) -> list[Itinerary]:
        """Calculate the best commuter itineraries arriving before class time.

        Rules:
        - Same city: direct walk or bike only (NEVER train within the same city).
        - Different city: first mile + train + last mile.
        - Train discarded if it arrives after (target_time - margin - last_mile).
        - Returned itineraries ordered from latest useful departure (leave as late as possible).
        - Up to 3 best options returned.
        - Warnings attached if date is outside bulletin validity or no trains match.
        """
        target_date = request.parsed_date
        target_time = request.parsed_time

        campus = self.location_repo.get_campus(request.destination_campus_id)
        if not campus:
            raise ValueError(f"Unknown campus id: {request.destination_campus_id!r}")

        origin_city = self._resolve_origin_city(request, campus.city)
        is_same_city = origin_city.lower().strip() == campus.city.lower().strip()

        warnings: list[str] = []
        if not (TIMETABLE_VALID_FROM <= target_date <= TIMETABLE_VALID_TO):
            warnings.append(
                f"Data {target_date.isoformat()} fuori dal periodo di validità dell'orario ufficiale "
                f"({TIMETABLE_VALID_FROM.isoformat()} - {TIMETABLE_VALID_TO.isoformat()})."
            )

        # -------------------------------------------------------------
        # CASE 1: Intra-city journey (SAME CITY)
        # -------------------------------------------------------------
        if is_same_city:
            mode = request.last_mile_mode or request.first_mile_mode or "walk"
            active_planner = self._get_active_planner(mode)

            # Destination
            dest_name = campus.name
            dest_id = campus.id
            dest_coords = (campus.lat, campus.lon)

            # Origin
            origin_name = "Punto di partenza"
            origin_id: str | None = None
            origin_coords = request.origin_coords

            if request.origin_station_id:
                st = self.location_repo.get_station(request.origin_station_id)
                if st:
                    origin_name = st.name
                    origin_id = st.id
                    origin_coords = origin_coords or (st.lat, st.lon)

            # Arrive at campus target_time minus margin
            target_min = time_to_minutes(target_time)
            effective_arrival_min = (target_min - request.margin_minutes) % (24 * 60)
            effective_arrival_time = minutes_to_time(effective_arrival_min)

            leg = active_planner.plan_leg_backward(
                origin_name=origin_name,
                destination_name=dest_name,
                arrive_by=effective_arrival_time,
                origin_id=origin_id,
                destination_id=dest_id,
                origin_coords=origin_coords,
                destination_coords=dest_coords,
                user_override_minutes=request.first_mile_minutes,
            )

            itinerary = Itinerary(
                leave_at=leg.depart,
                legs=(leg,),
                arrive_at=leg.arrive,
                slack_min=request.margin_minutes,
                warnings=tuple(warnings),
            )
            return [itinerary]

        # -------------------------------------------------------------
        # CASE 2: Inter-city commuter journey (DIFFERENT CITY)
        # -------------------------------------------------------------
        # Destination station for campus
        dest_station_name = campus.reference_station
        dest_station = self.location_repo.get_station_by_name(dest_station_name)
        if not dest_station:
            # Fallback to campus city reference station
            default_st_id = "modena_fs" if campus.city.lower() == "modena" else "reggio_fs"
            dest_station = self.location_repo.get_station(default_st_id)
            if not dest_station:
                raise ValueError(f"Could not resolve destination station for campus {campus.id}")

        # Origin station in origin city
        origin_station: Station | None = None
        if request.origin_station_id:
            origin_station = self.location_repo.get_station(request.origin_station_id)

        if not origin_station:
            default_orig_id = "reggio_fs" if origin_city.lower() == "reggio emilia" else "modena_fs"
            origin_station = self.location_repo.get_station(default_orig_id)
            if not origin_station:
                raise ValueError(f"Could not resolve origin station in {origin_city}")

        # Plan last-mile leg from destination station to campus
        last_mile_planner = self._get_active_planner(request.last_mile_mode)
        last_mile_minutes = last_mile_planner.calculate_minutes(
            origin_id=dest_station.id,
            destination_id=campus.id,
            origin_coords=(dest_station.lat, dest_station.lon),
            destination_coords=(campus.lat, campus.lon),
        )

        # Calculate deadline for train arrival at destination station
        target_min = time_to_minutes(target_time)
        deadline_min = target_min - last_mile_minutes - request.margin_minutes
        if deadline_min < 0:
            deadline_min += 24 * 60
        latest_train_arrival = minutes_to_time(deadline_min)

        # Query and filter candidate train runs
        all_trains = self.train_repo.get_trains(origin_station.name, dest_station.name)
        qualifying_trains = self.train_leg_planner.filter_trains(
            trains=all_trains,
            target_date=target_date,
            latest_arrival=latest_train_arrival,
        )

        if not qualifying_trains:
            warn_msg = (
                f"Nessun treno disponibile da {origin_station.name} a {dest_station.name} "
                f"con arrivo entro le {format_time(latest_train_arrival)} il {target_date.isoformat()}."
            )
            warnings.append(warn_msg)
            return []

        # First-mile planner from origin to origin station
        first_mile_planner = self._get_active_planner(request.first_mile_mode)
        origin_name = "Punto di partenza"
        first_mile_minutes = request.first_mile_minutes
        if first_mile_minutes is None:
            if request.origin_station_id == origin_station.id:
                first_mile_minutes = 0  # Already at the station
            elif request.origin_coords:
                first_mile_minutes = first_mile_planner.calculate_minutes(
                    origin_coords=request.origin_coords,
                    destination_coords=(origin_station.lat, origin_station.lon),
                )
            else:
                first_mile_minutes = 10  # Commuter default walking time to station

        itineraries: list[Itinerary] = []

        for train in qualifying_trains:
            # 1. First-mile leg
            dep_train_min = time_to_minutes(train.depart_time)
            dep_home_min = (dep_train_min - first_mile_minutes) % (24 * 60)
            dep_home_time = minutes_to_time(dep_home_min)

            first_leg = Leg(
                leg_type=request.first_mile_mode,
                origin=origin_name,
                destination=origin_station.name,
                depart=format_time(dep_home_time),
                arrive=train.depart,
                minutes=first_mile_minutes,
            )

            # 2. Train leg
            train_leg = self.train_leg_planner.build_train_leg(train)

            # 3. Last-mile leg
            arr_train_min = time_to_minutes(train.arrive_time)
            arr_campus_min = (arr_train_min + last_mile_minutes) % (24 * 60)
            arr_campus_time = minutes_to_time(arr_campus_min)

            last_leg = Leg(
                leg_type=request.last_mile_mode,
                origin=dest_station.name,
                destination=campus.name,
                depart=train.arrive,
                arrive=format_time(arr_campus_time),
                minutes=last_mile_minutes,
            )

            # Calculate actual slack at campus
            slack_min = target_min - arr_campus_min
            if slack_min < 0:
                slack_min += 24 * 60

            it = Itinerary(
                leave_at=first_leg.depart,
                legs=(first_leg, train_leg, last_leg),
                arrive_at=last_leg.arrive,
                slack_min=slack_min,
                warnings=tuple(warnings),
            )
            itineraries.append(it)

        # Sort from latest useful departure (leave home as late as possible)
        itineraries.sort(key=lambda it: time_to_minutes(it.leave_time), reverse=True)

        return itineraries[:3]
