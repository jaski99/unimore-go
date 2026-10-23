"""Resolution of the home side of a journey.

Turns the loose origin fields of a :class:`PlanRequest` (station id, home
coordinates, explicit home->station minutes, city hint) into a single
:class:`HomeEndpoint`: which city the user lives in, which station they use,
and how long the home<->station leg takes. Shared by every journey planner
and by the API, so the rules live in one place.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from engine.legs import ActiveLegPlanner, haversine_distance_m
from engine.models import PlanRequest, Station
from engine.notices import HOME_FAR, Notice, notice
from engine.repositories import LocationRepository

FAR_FROM_STATION_M = 10_000.0
HOME_LABEL = "Casa"

MODE_LABELS = {"walk": "a piedi", "bike": "in bici"}


@dataclass(frozen=True)
class HomeEndpoint:
    """Where the user lives and how they reach their station."""

    label: str
    city: str
    station: Station
    coords: tuple[float, float] | None
    is_station: bool  # the user starts/ends at the station itself
    station_leg_minutes: int  # home<->station minutes (0 when is_station)
    notices: tuple[Notice, ...] = ()
    # Set when station_leg_minutes was estimated (only relevant if a train is used).
    estimate_note: str | None = None

    @property
    def warnings(self) -> tuple[str, ...]:
        return tuple(n.message for n in self.notices)

    @property
    def point(self) -> tuple[float, float]:
        """Best known coordinates of home (the station when unknown)."""
        return self.coords or (self.station.lat, self.station.lon)


class OriginResolver:
    """Resolve a request's origin fields into a :class:`HomeEndpoint`."""

    def __init__(
        self,
        location_repo: LocationRepository,
        active_planner_for: Callable[[str], ActiveLegPlanner],
    ) -> None:
        self.location_repo = location_repo
        self.active_planner_for = active_planner_for

    def nearest_station(self, coords: tuple[float, float]) -> tuple[Station, float]:
        stations = self.location_repo.all_stations()
        if not stations:
            raise ValueError("No stations configured")
        distances = [(haversine_distance_m(*coords, s.lat, s.lon), s) for s in stations]
        distance, station = min(distances, key=lambda pair: pair[0])
        return station, distance

    def station_in_city(self, city: str) -> Station:
        for station in self.location_repo.all_stations():
            if station.city.lower().strip() == city.lower().strip():
                return station
        raise ValueError(f"No station configured in city {city!r}")

    def resolve(self, request: PlanRequest, campus_city: str) -> HomeEndpoint:
        explicit = request.first_mile_minutes
        has_explicit = explicit is not None and explicit > 0

        if request.origin_station_id:
            station = self.location_repo.get_station(request.origin_station_id)
            if station is None:
                raise ValueError(f"Unknown station id: {request.origin_station_id!r}")
            if not has_explicit and request.origin_coords is None:
                return HomeEndpoint(
                    label=station.name,
                    city=request.origin_city or station.city,
                    station=station,
                    coords=(station.lat, station.lon),
                    is_station=True,
                    station_leg_minutes=0,
                )
            return self._home(request, station, request.origin_city or station.city, [])

        if request.origin_coords is not None:
            station, distance = self.nearest_station(request.origin_coords)
            notices: list[Notice] = []
            if distance > FAR_FROM_STATION_M:
                notices.append(
                    notice(
                        HOME_FAR,
                        "Casa si trova a oltre 10 km dalla stazione coperta più vicina "
                        f"({station.name}); i tempi stimati potrebbero essere poco affidabili.",
                    )
                )
            return self._home(request, station, request.origin_city or station.city, notices)

        # No origin given: city hint or the classic commuter from the other city.
        city = request.origin_city or (
            "Reggio Emilia" if campus_city.lower().strip() == "modena" else "Modena"
        )
        station = self.station_in_city(city)
        if has_explicit:
            return self._home(request, station, city, [])
        return HomeEndpoint(
            label=station.name,
            city=city,
            station=station,
            coords=(station.lat, station.lon),
            is_station=True,
            station_leg_minutes=0,
        )

    def _home(
        self,
        request: PlanRequest,
        station: Station,
        city: str,
        notices: list[Notice],
    ) -> HomeEndpoint:
        minutes = request.first_mile_minutes
        estimate_note = None
        if minutes is None or minutes <= 0:
            planner = self.active_planner_for(request.first_mile_mode)
            minutes = planner.calculate_minutes(
                origin_coords=request.origin_coords,
                destination_coords=(station.lat, station.lon),
            )
            mode_label = MODE_LABELS.get(planner.mode, planner.mode)
            estimate_note = (
                f"Tempo casa → {station.name} stimato: {minutes} min {mode_label} "
                "(distanza in linea d'aria × 1,3). Inserisci i tuoi minuti per un calcolo preciso."
            )
        return HomeEndpoint(
            label=HOME_LABEL,
            city=city,
            station=station,
            coords=request.origin_coords,
            is_station=False,
            station_leg_minutes=minutes,
            notices=tuple(notices),
            estimate_note=estimate_note,
        )
