"""Door-to-door planner facade for UNIMORE commuter students.

Wires repositories, leg strategies and data-derived services (timetable
validity, PDF calendar notes) and dispatches requests to *journey planners*
registered by name:

* ``"arrive_by"``    - "A che ora esco?" (lesson start, backward planning)
* ``"depart_after"`` - "A che ora parto per tornare?" (lesson end, forward)

New questions are added by registering another :class:`JourneyPlanner`; new
first/last-mile modes by registering another ``ActiveLegPlanner``. Neither
requires changes to this class (Open/Closed).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from engine.calendar_rules import CalendarNoteParser
from engine.journeys import DEFAULT_JOURNEY_PLANNERS, JourneyPlanner, PlanningContext
from engine.legs import ActiveLegPlanner, BikeLegPlanner, TrainLegPlanner, WalkLegPlanner
from engine.models import Itinerary, PlanRequest, PlanResult
from engine.repositories import LocationRepository, SegmentRepository, TrainRepository
from engine.service_calendar import ServiceCalendar
from engine.validity import TimetableValidity

DEFAULT_PLANNER = "arrive_by"


class Planner:
    """Core planner facade with a registry of journey planners."""

    def __init__(
        self,
        train_repo: TrainRepository,
        location_repo: LocationRepository,
        segment_repo: SegmentRepository,
        walk_planner: ActiveLegPlanner | None = None,
        bike_planner: ActiveLegPlanner | None = None,
        train_leg_planner: TrainLegPlanner | None = None,
        active_planners: Mapping[str, ActiveLegPlanner] | None = None,
        journey_planners: Iterable[JourneyPlanner] | None = None,
    ) -> None:
        """Wire repositories and strategies.

        ``active_planners`` maps extra mode names to ActiveLegPlanner
        strategies (unknown modes fall back to walking). ``journey_planners``
        replaces the default registry (``arrive_by``, ``depart_after``).
        """
        self.train_repo = train_repo
        self.location_repo = location_repo
        self.segment_repo = segment_repo
        self.walk_planner = walk_planner or WalkLegPlanner(segment_repo)
        self.bike_planner = bike_planner or BikeLegPlanner(segment_repo)
        self.active_planners: dict[str, ActiveLegPlanner] = {
            self.walk_planner.mode: self.walk_planner,
            self.bike_planner.mode: self.bike_planner,
            **{key.lower(): value for key, value in (active_planners or {}).items()},
        }

        trains = train_repo.all_trains()
        self.validity = TimetableValidity.from_trains(trains) if trains else None
        if train_leg_planner is None:
            calendar = (
                ServiceCalendar(CalendarNoteParser(edition_start=self.validity.valid_from))
                if self.validity
                else None
            )
            train_leg_planner = TrainLegPlanner(calendar)
        self.train_leg_planner = train_leg_planner

        self.context = PlanningContext(
            train_repo=train_repo,
            location_repo=location_repo,
            active_planners=self.active_planners,
            default_active=self.walk_planner,
            train_leg_planner=self.train_leg_planner,
            validity=self.validity,
        )
        self.journey_planners: dict[str, JourneyPlanner] = {}
        for journey_planner in journey_planners or DEFAULT_JOURNEY_PLANNERS:
            self.register(journey_planner)

    def register(self, journey_planner: JourneyPlanner) -> None:
        """Register (or replace) a journey planner under its ``name``."""
        self.journey_planners[journey_planner.name] = journey_planner

    @property
    def available_planners(self) -> tuple[str, ...]:
        return tuple(sorted(self.journey_planners))

    def plan(self, request: PlanRequest, planner: str = DEFAULT_PLANNER) -> PlanResult:
        """Run the journey planner registered as ``planner``."""
        try:
            journey_planner = self.journey_planners[planner]
        except KeyError as exc:
            raise ValueError(
                f"Unknown planner {planner!r}; available: {', '.join(self.available_planners)}"
            ) from exc
        return journey_planner.plan(request, self.context)

    def arrive_by(self, request: PlanRequest) -> list[Itinerary]:
        """Itineraries reaching the lesson in time (latest departure first)."""
        return list(self.plan(request, "arrive_by").itineraries)

    def depart_after(self, request: PlanRequest) -> list[Itinerary]:
        """Itineraries home after the lesson ends (earliest departure first)."""
        return list(self.plan(request, "depart_after").itineraries)

    def _get_active_planner(self, mode: str) -> ActiveLegPlanner:
        return self.context.active_planner(mode)
