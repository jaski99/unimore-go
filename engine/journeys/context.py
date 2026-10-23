"""Shared services and per-request preparation for journey planners."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, timedelta

from engine.holidays import holiday_name, is_festive
from engine.legs import ActiveLegPlanner, TrainLegPlanner
from engine.models import Campus, PlanRequest, Station, TrainRun, time_to_minutes
from engine.notices import (
    ESTIMATE,
    FESTIVE_DAY,
    HOME_UNKNOWN,
    OUT_OF_VALIDITY,
    SAME_CITY,
    Notice,
    NoticeComposer,
    notice,
)
from engine.origin import MODE_LABELS, HomeEndpoint, OriginResolver
from engine.repositories import LocationRepository, TrainRepository
from engine.validity import TimetableValidity, format_it_day

SEARCH_DAYS = 7  # how far previous/next solutions are searched

FESTIVE_TEXT = (
    "orario festivo, servizio ridotto. Valgono solo le corse che il PDF Trenitalia indica "
    "per i festivi (non quelle con ⚒, solo giorni lavorativi). Verifica su Trenitalia prima "
    "di partire."
)


def festive_notice(day: date) -> Notice | None:
    """Info note for Sundays and national holidays, also when trains are found.

    On festive days the dataset keeps only runs marked for them (PDF day
    symbols and notes); e.g. 142 R/RV on Sun 25/10 against 156 on Mon 26/10.
    """
    if not is_festive(day):
        return None
    holiday = holiday_name(day)
    when = format_it_day(day).capitalize()
    prefix = f"{when} è festivo ({holiday})" if holiday else when
    return notice(FESTIVE_DAY, f"{prefix}: {FESTIVE_TEXT}")


def origin_name(home: HomeEndpoint) -> str:
    """How the start point is called in messages: the station by name, or "Casa"."""
    return f"Stazione di {home.station.name}" if home.is_station else "Casa"


def is_working_day(day: date) -> bool:
    """Trenitalia "giorno lavorativo": Monday to Saturday, national holidays excluded."""
    return not is_festive(day)


def run_minutes(train: TrainRun) -> tuple[int, int]:
    """Departure and arrival in minutes from midnight (arrival may exceed 24h)."""
    dep = time_to_minutes(train.depart_time)
    return dep, dep + train.duration_minutes


@dataclass(frozen=True)
class Journey:
    """Everything a planner needs about one request, resolved once."""

    request: PlanRequest
    day: date
    target_min: int
    campus: Campus
    campus_station: Station
    home: HomeEndpoint
    same_city: bool
    home_mode: str
    campus_mode: str
    campus_leg_minutes: int  # campus station <-> campus
    notices: tuple[Notice, ...]

    @property
    def campus_mode_label(self) -> str:
        return MODE_LABELS.get(self.campus_mode, self.campus_mode)

    def offset_min(self, day: date) -> int:
        """Minutes between the start of ``day`` and the start of the request day."""
        return (day - self.day).days * 24 * 60


class PlanningContext:
    """Repositories, leg strategies and data-derived settings shared by planners."""

    def __init__(
        self,
        train_repo: TrainRepository,
        location_repo: LocationRepository,
        active_planners: Mapping[str, ActiveLegPlanner],
        default_active: ActiveLegPlanner,
        train_leg_planner: TrainLegPlanner,
        validity: TimetableValidity | None,
        composer: NoticeComposer | None = None,
    ) -> None:
        self.composer = composer or NoticeComposer()
        self.train_repo = train_repo
        self.location_repo = location_repo
        self.active_planners = dict(active_planners)
        self.default_active = default_active
        self.train_leg_planner = train_leg_planner
        self.validity = validity
        self.origin_resolver = OriginResolver(location_repo, self.active_planner)

    def active_planner(self, mode: str) -> ActiveLegPlanner:
        """Strategy for an active mode; unknown modes fall back to walking."""
        return self.active_planners.get((mode or "").lower(), self.default_active)

    def runs_between(
        self,
        origin: Station,
        destination: Station,
        day: date,
        categories: frozenset[str] | None,
    ) -> list[TrainRun]:
        """Runs operating on ``day`` between two stations, by departure time."""
        trains = self.train_repo.get_trains(origin.name, destination.name)
        return self.train_leg_planner.running_trains(trains, day, categories)

    def search_days(self, day: date, direction: int) -> list[date]:
        """Days before (direction=-1) or after (+1) ``day`` within the search horizon.

        Outside the timetable validity the search starts from its nearest edge,
        so a date after ``valid_to`` still finds the last covered days.
        """
        start = day
        if self.validity is not None:
            if direction < 0 and day > self.validity.valid_to:
                start = self.validity.valid_to + timedelta(days=1)
            elif direction > 0 and day < self.validity.valid_from:
                start = self.validity.valid_from - timedelta(days=1)
        return [start + timedelta(days=direction * i) for i in range(1, SEARCH_DAYS + 1)]

    def compose(self, notices: list[Notice]) -> tuple[Notice, ...]:
        return self.composer.compose(notices)

    def campus_station(self, campus: Campus) -> Station:
        station = self.location_repo.get_station_by_name(campus.reference_station)
        return station or self.origin_resolver.station_in_city(campus.city)

    def prepare(self, request: PlanRequest) -> Journey:
        campus = self.location_repo.get_campus(request.destination_campus_id)
        if campus is None:
            raise ValueError(f"Unknown campus id: {request.destination_campus_id!r}")
        day = request.parsed_date
        home = self.origin_resolver.resolve(request, campus.city)
        same_city = home.city.lower().strip() == campus.city.lower().strip()
        campus_station = self.campus_station(campus)
        campus_mode = self.active_planner(request.last_mile_mode).mode
        campus_leg_minutes = self.active_planner(campus_mode).calculate_minutes(
            origin_id=campus_station.id,
            destination_id=campus.id,
            origin_coords=(campus_station.lat, campus_station.lon),
            destination_coords=(campus.lat, campus.lon),
        )

        notices = list(home.notices)
        if self.validity is not None:
            out_of_range = self.validity.warning_for(day)
            if out_of_range:
                notices.append(notice(OUT_OF_VALIDITY, out_of_range))
        if not same_city:
            if home.estimate_note:
                notices.append(notice(ESTIMATE, home.estimate_note))
            festive = festive_notice(day)
            if festive:
                notices.append(festive)
        else:
            mode_label = MODE_LABELS.get(campus_mode, campus_mode)
            notices.append(
                notice(
                    SAME_CITY,
                    f"{origin_name(home)} e sede sono nella stessa città ({campus.city}): "
                    f"percorso diretto {mode_label}, nessun treno.",
                )
            )

        return Journey(
            request=request,
            day=day,
            target_min=time_to_minutes(request.parsed_time),
            campus=campus,
            campus_station=campus_station,
            home=home,
            same_city=same_city,
            home_mode=self.active_planner(request.first_mile_mode).mode,
            campus_mode=campus_mode,
            campus_leg_minutes=campus_leg_minutes,
            notices=tuple(notices),
        )

    def direct_minutes(self, journey: Journey) -> tuple[int, str, list[Notice]]:
        """Same-city direct leg: minutes, home-side label and extra notices."""
        home = journey.home
        notices: list[Notice] = []
        label = home.label
        if not home.is_station and home.coords is None:
            label = home.station.name
            notices.append(
                notice(
                    HOME_UNKNOWN,
                    "Posizione di casa non indicata: il percorso è calcolato dalla stazione "
                    f"{home.station.name}. Inserisci l'indirizzo o tocca la mappa per un tempo "
                    "preciso.",
                )
            )
        minutes = self.active_planner(journey.campus_mode).calculate_minutes(
            origin_id=home.station.id if home.is_station or home.coords is None else None,
            destination_id=journey.campus.id,
            origin_coords=home.point,
            destination_coords=(journey.campus.lat, journey.campus.lon),
        )
        return minutes, label, notices
