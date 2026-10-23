"""'A che ora parto per tornare?': first solution home after the lesson ends."""

from __future__ import annotations

from datetime import date

from engine.itinerary_builder import assemble, clock, station_wait_leg, timed_leg
from engine.journeys.base import JourneyPlanner, category_hint
from engine.journeys.context import Journey, PlanningContext, run_minutes
from engine.models import Itinerary, NearbySolution, PlanRequest, PlanResult, TrainRun
from engine.validity import format_it_date

MAX_RESULTS = 3


class DepartAfterPlanner(JourneyPlanner):
    """Forward planning from the lesson end towards the home station.

    Segment durations are looked up symmetrically (station->campus equals
    campus->station). ``slack_min`` is the free time between the end of the
    lesson and the moment you must leave the campus. The safety margin is not
    applied: it protects lesson starts, not departures.
    """

    name = "depart_after"

    def plan(self, request: PlanRequest, ctx: PlanningContext) -> PlanResult:
        journey = ctx.prepare(request)
        if journey.same_city:
            return self._direct(journey, ctx)

        ready = journey.target_min + journey.campus_leg_minutes + request.station_buffer_minutes
        runs = self._runs(journey, ctx, journey.day)
        chosen = [r for r in runs if run_minutes(r)[0] >= ready][:MAX_RESULTS]
        itineraries = tuple(self.itinerary(journey, ctx, r, journey.day) for r in chosen)

        warnings = list(journey.warnings)
        nearby: tuple[NearbySolution, ...] = ()
        if not itineraries:
            warnings.append(
                f"Nessun treno utile da {journey.campus_station.name} a "
                f"{journey.home.station.name} in partenza dopo le {clock(ready)} del "
                f"{format_it_date(journey.day)}.{category_hint(request)}"
            )
            nearby = self._nearby(journey, ctx, runs, ready)
        return PlanResult(self.name, itineraries, tuple(warnings), nearby)

    @staticmethod
    def _runs(journey: Journey, ctx: PlanningContext, day: date) -> list[TrainRun]:
        return ctx.runs_between(
            journey.campus_station, journey.home.station, day, journey.request.train_categories
        )

    def itinerary(
        self, journey: Journey, ctx: PlanningContext, run: TrainRun, day: date
    ) -> Itinerary:
        home, request = journey.home, journey.request
        dep, arr = run_minutes(run)
        buffer = request.station_buffer_minutes
        leave_campus = dep - buffer - journey.campus_leg_minutes
        legs = (
            timed_leg(
                journey.campus_mode,
                journey.campus.name,
                journey.campus_station.name,
                leave_campus,
                journey.campus_leg_minutes,
            ),
            station_wait_leg(journey.campus_station.name, dep - buffer, buffer),
            ctx.train_leg_planner.build_train_leg(run),
            timed_leg(
                journey.home_mode, home.station.name, home.label, arr, home.station_leg_minutes
            ),
        )
        slack = journey.offset_min(day) + leave_campus - journey.target_min
        return assemble(legs, slack, day)

    def _nearby(
        self, journey: Journey, ctx: PlanningContext, runs: list[TrainRun], ready: int
    ) -> tuple[NearbySolution, ...]:
        found: list[NearbySolution] = []
        early = [r for r in runs if run_minutes(r)[0] < ready]
        if early:
            found.append(
                NearbySolution("previous", self.itinerary(journey, ctx, early[-1], journey.day))
            )
        else:
            for day in ctx.search_days(journey.day, -1):
                previous = self._runs(journey, ctx, day)
                if previous:
                    found.append(
                        NearbySolution("previous", self.itinerary(journey, ctx, previous[-1], day))
                    )
                    break
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
        leg = timed_leg(
            journey.campus_mode, journey.campus.name, label, journey.target_min, minutes
        )
        itinerary = assemble((leg,), 0, journey.day)
        return PlanResult(self.name, (itinerary,), (*journey.warnings, *extra))
