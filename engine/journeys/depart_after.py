"""'A che ora parto per tornare?': first solution home after the lesson ends."""

from __future__ import annotations

from datetime import date

from engine.durations import format_minutes
from engine.itinerary_builder import assemble, clock, station_wait_leg, timed_leg
from engine.journeys.base import JourneyPlanner, category_hint
from engine.journeys.context import Journey, PlanningContext, run_minutes
from engine.models import (
    Calculation,
    Itinerary,
    NearbySolution,
    PlanRequest,
    PlanResult,
    TrainRun,
)
from engine.notices import NO_SERVICE, notice
from engine.validity import format_it_day

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
        calculation = self.calculation(journey, ready)
        runs = self._runs(journey, ctx, journey.day)
        chosen = [r for r in runs if run_minutes(r)[0] >= ready][:MAX_RESULTS]
        itineraries = tuple(self.itinerary(journey, ctx, r, journey.day) for r in chosen)

        notices = list(journey.notices)
        nearby: tuple[NearbySolution, ...] = ()
        if not itineraries:
            notices.append(
                notice(
                    NO_SERVICE,
                    f"Nessun treno da {journey.campus_station.name} a "
                    f"{journey.home.station.name} parte dopo le {clock(ready)} di "
                    f"{format_it_day(journey.day)}. {calculation.summary}"
                    f"{category_hint(request)}",
                )
            )
            nearby = self._nearby(journey, ctx, runs, ready)
        # The formula is shown once: in the result box when there is a result for
        # this date, otherwise inside the no-service notice (dropped out of validity).
        shown = calculation if itineraries else None
        return PlanResult(self.name, itineraries, ctx.compose(notices), nearby, shown)

    @staticmethod
    def calculation(journey: Journey, ready: int) -> Calculation:
        """ "Fine lezione 13:00 + 19 min a piedi + 5 min in stazione = treni dalle 13:24"."""
        request = journey.request
        terms = [f"fine lezione alle {clock(journey.target_min)}"]
        if journey.campus_leg_minutes:
            terms.append(
                f"{format_minutes(journey.campus_leg_minutes)} {journey.campus_mode_label} "
                "fino alla stazione"
            )
        if request.station_buffer_minutes:
            terms.append(f"{format_minutes(request.station_buffer_minutes)} in stazione")
        summary = (
            f"Calcolo: {' + '.join(terms)} = treni da {journey.campus_station.name} dalle "
            f"{clock(ready)}."
        )
        return Calculation(journey.campus_station.name, clock(ready), summary)

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
            ctx.train_leg_planner.build_train_leg(run, day),
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
            itinerary = self.itinerary(journey, ctx, early[-1], journey.day)
            found.append(
                NearbySolution(
                    "previous",
                    itinerary,
                    f"Ultimo treno prima: dovresti lasciare la sede alle {itinerary.leave_at}, "
                    "prima della fine della lezione.",
                )
            )
        else:
            for day in ctx.search_days(journey.day, -1):
                previous = self._runs(journey, ctx, day)
                if previous:
                    found.append(
                        NearbySolution(
                            "previous",
                            self.itinerary(journey, ctx, previous[-1], day),
                            f"Ultimo treno di {format_it_day(day)}.",
                        )
                    )
                    break
        for day in ctx.search_days(journey.day, 1):
            following = self._runs(journey, ctx, day)
            if following:
                found.append(
                    NearbySolution(
                        "next",
                        self.itinerary(journey, ctx, following[0], day),
                        f"Primo treno di {format_it_day(day)}.",
                    )
                )
                break
        return tuple(found)

    def _direct(self, journey: Journey, ctx: PlanningContext) -> PlanResult:
        minutes, label, extra = ctx.direct_minutes(journey)
        leg = timed_leg(
            journey.campus_mode, journey.campus.name, label, journey.target_min, minutes
        )
        itinerary = assemble((leg,), 0, journey.day)
        return PlanResult(
            self.name,
            (itinerary,),
            ctx.compose([*journey.notices, *extra]),
            suggestion=ctx.direct_suggestion(journey, minutes),
        )
