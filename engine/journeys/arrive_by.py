"""'A che ora esco?': latest departure that reaches the lesson in time."""

from __future__ import annotations

from datetime import date

from engine.itinerary_builder import assemble, clock, station_wait_leg, timed_leg
from engine.journeys.base import JourneyPlanner, category_hint
from engine.journeys.context import Journey, PlanningContext, run_minutes
from engine.models import Itinerary, NearbySolution, PlanRequest, PlanResult, TrainRun
from engine.validity import format_it_date

MAX_RESULTS = 3


class ArriveByPlanner(JourneyPlanner):
    """Backward planning from the lesson start (minus the safety margin)."""

    name = "arrive_by"

    def plan(self, request: PlanRequest, ctx: PlanningContext) -> PlanResult:
        journey = ctx.prepare(request)
        if journey.same_city:
            return self._direct(journey, ctx)

        deadline = journey.target_min - request.margin_minutes - journey.campus_leg_minutes
        runs = self._runs(journey, ctx, journey.day)
        useful = [r for r in runs if run_minutes(r)[1] <= deadline]
        chosen = sorted(useful, key=lambda r: run_minutes(r)[0], reverse=True)[:MAX_RESULTS]
        itineraries = tuple(self.itinerary(journey, ctx, r, journey.day) for r in chosen)

        warnings = list(journey.warnings)
        nearby: tuple[NearbySolution, ...] = ()
        if not itineraries:
            warnings.append(
                f"Nessun treno utile da {journey.home.station.name} a "
                f"{journey.campus_station.name} per arrivare entro le {clock(deadline)} del "
                f"{format_it_date(journey.day)}.{category_hint(request)}"
            )
            nearby = self._nearby(journey, ctx, runs, deadline)
        return PlanResult(self.name, itineraries, tuple(warnings), nearby)

    @staticmethod
    def _runs(journey: Journey, ctx: PlanningContext, day: date) -> list[TrainRun]:
        return ctx.runs_between(
            journey.home.station, journey.campus_station, day, journey.request.train_categories
        )

    def itinerary(
        self, journey: Journey, ctx: PlanningContext, run: TrainRun, day: date
    ) -> Itinerary:
        home, request = journey.home, journey.request
        dep, arr = run_minutes(run)
        buffer = request.station_buffer_minutes
        legs = (
            timed_leg(
                journey.home_mode,
                home.label,
                home.station.name,
                dep - buffer - home.station_leg_minutes,
                home.station_leg_minutes,
            ),
            station_wait_leg(home.station.name, dep - buffer, buffer),
            ctx.train_leg_planner.build_train_leg(run),
            timed_leg(
                journey.campus_mode,
                journey.campus_station.name,
                journey.campus.name,
                arr,
                journey.campus_leg_minutes,
            ),
        )
        arrival = journey.offset_min(day) + arr + journey.campus_leg_minutes
        return assemble(legs, journey.target_min - arrival, day)

    def _nearby(
        self, journey: Journey, ctx: PlanningContext, runs: list[TrainRun], deadline: int
    ) -> tuple[NearbySolution, ...]:
        found: list[NearbySolution] = []
        for day in ctx.search_days(journey.day, -1):
            previous = self._runs(journey, ctx, day)
            if previous:
                found.append(
                    NearbySolution("previous", self.itinerary(journey, ctx, previous[-1], day))
                )
                break
        late = [r for r in runs if run_minutes(r)[1] > deadline]
        if late:
            found.append(NearbySolution("next", self.itinerary(journey, ctx, late[0], journey.day)))
        else:
            for day in ctx.search_days(journey.day, 1):
                following = self._runs(journey, ctx, day)
                if following:
                    found.append(
                        NearbySolution("next", self.itinerary(journey, ctx, following[0], day))
                    )
                    break
        return tuple(found)

    def _direct(self, journey: Journey, ctx: PlanningContext) -> PlanResult:
        minutes, label, extra = ctx.direct_minutes(journey)
        margin = journey.request.margin_minutes
        arrive = journey.target_min - margin
        leg = timed_leg(journey.campus_mode, label, journey.campus.name, arrive - minutes, minutes)
        itinerary = assemble((leg,), margin, journey.day)
        return PlanResult(self.name, (itinerary,), (*journey.warnings, *extra))
