"""'A che ora esco?': latest departure that reaches the lesson in time."""

from __future__ import annotations

from datetime import date

from engine.itinerary_builder import assemble, clock, station_wait_leg, timed_leg
from engine.journeys.base import JourneyPlanner, category_hint
from engine.journeys.context import Journey, PlanningContext, is_working_day, run_minutes
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
# A same-day train arriving after the lesson start is proposed only if the
# delay is small; otherwise the same lesson time on another working day is
# more useful (no "22:43 train" for a 09:00 lesson).
MAX_LATE_MIN = 60
# A train arriving at the campus more than this before the lesson is not a
# sensible main answer (e.g. the 00:53 night train for a 05:30 lesson): it is
# offered as a labelled alternative instead.
MAX_EARLY_MIN = 120


def late_train_label(slack_min: int, margin_min: int) -> str:
    """One coherent text for the first train after the deadline.

    That train misses the chosen margin, but may still arrive before the lesson
    (``slack_min`` >= 0) or after it (``slack_min`` < 0, a real delay).
    """
    if slack_min < 0:
        return (
            f"Primo treno dopo: arrivi in sede {-slack_min} min in ritardo sull'inizio della "
            "lezione."
        )
    when = (
        "all'inizio della lezione"
        if slack_min == 0
        else f"{slack_min} min prima dell'inizio della lezione"
    )
    return (
        f"Primo treno dopo: arrivi in sede {when}, meno dei {margin_min} min di anticipo che "
        "hai scelto."
    )


class ArriveByPlanner(JourneyPlanner):
    """Backward planning from the lesson start (minus the safety margin)."""

    name = "arrive_by"

    def plan(self, request: PlanRequest, ctx: PlanningContext) -> PlanResult:
        journey = ctx.prepare(request)
        if journey.same_city:
            return self._direct(journey, ctx)

        deadline = journey.target_min - request.margin_minutes - journey.campus_leg_minutes
        calculation = self.calculation(journey, deadline)
        runs = self._runs(journey, ctx, journey.day)
        useful = sorted(
            (r for r in runs if run_minutes(r)[1] <= deadline),
            key=lambda r: run_minutes(r)[0],
            reverse=True,
        )
        earliest = deadline - MAX_EARLY_MIN
        chosen = [r for r in useful if run_minutes(r)[1] >= earliest][:MAX_RESULTS]
        itineraries = tuple(self.itinerary(journey, ctx, r, journey.day) for r in chosen)

        notices = list(journey.notices)
        nearby: tuple[NearbySolution, ...] = ()
        if not itineraries:
            window = (
                f"tra le {clock(earliest)} e le {clock(deadline)}"
                if useful
                else f"entro le {clock(deadline)}"
            )
            notices.append(
                notice(
                    NO_SERVICE,
                    f"Nessun treno da {journey.home.station.name} arriva a "
                    f"{journey.campus_station.name} {window} di "
                    f"{format_it_day(journey.day)}. {calculation.summary}"
                    f"{category_hint(request)}",
                )
            )
            too_early = useful[0] if useful else None
            nearby = self._nearby(journey, ctx, runs, deadline, too_early)
        # The formula is shown once: in the result box when there is a result for
        # this date, otherwise inside the no-service notice (dropped out of validity).
        shown = calculation if itineraries else None
        return PlanResult(self.name, itineraries, ctx.compose(notices), nearby, shown)

    @staticmethod
    def calculation(journey: Journey, deadline: int) -> Calculation:
        """ "Lezione 09:00 − 10 min di anticipo − 19 min a piedi = in stazione entro 08:31"."""
        request = journey.request
        terms = [f"lezione alle {clock(journey.target_min)}"]
        if request.margin_minutes:
            terms.append(f"{request.margin_minutes} min di anticipo")
        if journey.campus_leg_minutes:
            terms.append(
                f"{journey.campus_leg_minutes} min {journey.campus_mode_label} dalla stazione "
                "alla sede"
            )
        summary = (
            f"Calcolo: {' − '.join(terms)} = arrivo a {journey.campus_station.name} entro le "
            f"{clock(deadline)}."
        )
        return Calculation(journey.campus_station.name, clock(deadline), summary)

    @staticmethod
    def _runs(journey: Journey, ctx: PlanningContext, day: date) -> list[TrainRun]:
        return ctx.runs_between(
            journey.home.station, journey.campus_station, day, journey.request.train_categories
        )

    def itinerary(
        self,
        journey: Journey,
        ctx: PlanningContext,
        run: TrainRun,
        day: date,
        same_lesson_time: bool = False,
    ) -> Itinerary:
        """Door-to-door itinerary for ``run`` on ``day``.

        ``slack_min`` is measured against the lesson on the request day, or,
        with ``same_lesson_time``, against the same lesson time on ``day``.
        """
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
        offset = 0 if same_lesson_time else journey.offset_min(day)
        arrival = offset + arr + journey.campus_leg_minutes
        return assemble(legs, journey.target_min - arrival, day)

    def _nearby(
        self,
        journey: Journey,
        ctx: PlanningContext,
        runs: list[TrainRun],
        deadline: int,
        too_early: TrainRun | None = None,
    ) -> tuple[NearbySolution, ...]:
        found: list[NearbySolution] = []
        if too_early is not None:
            itinerary = self.itinerary(journey, ctx, too_early, journey.day)
            found.append(
                NearbySolution(
                    "previous",
                    itinerary,
                    f"Ultimo treno utile del giorno: arrivi in sede {itinerary.slack_min} min "
                    "prima dell'inizio della lezione.",
                )
            )
        else:
            previous = self._same_time_on_working_day(journey, ctx, deadline, -1)
            if previous:
                found.append(previous)
        late = [r for r in runs if run_minutes(r)[1] > deadline]
        if late:
            itinerary = self.itinerary(journey, ctx, late[0], journey.day)
            if -itinerary.slack_min <= MAX_LATE_MIN:
                found.append(
                    NearbySolution(
                        "next",
                        itinerary,
                        late_train_label(itinerary.slack_min, journey.request.margin_minutes),
                    )
                )
                return tuple(found)
        following = self._same_time_on_working_day(journey, ctx, deadline, 1)
        if following:
            found.append(following)
        return tuple(found)

    def _same_time_on_working_day(
        self, journey: Journey, ctx: PlanningContext, deadline: int, direction: int
    ) -> NearbySolution | None:
        """Best solution for the same lesson time on the nearest working day."""
        for day in ctx.search_days(journey.day, direction):
            if not is_working_day(day):
                continue
            useful = [r for r in self._runs(journey, ctx, day) if run_minutes(r)[1] <= deadline]
            if not useful:
                continue
            best = max(useful, key=lambda r: run_minutes(r)[0])
            which = "precedente" if direction < 0 else "successivo"
            return NearbySolution(
                "previous" if direction < 0 else "next",
                self.itinerary(journey, ctx, best, day, same_lesson_time=True),
                f"Stessa ora di lezione, {format_it_day(day)} (giorno feriale {which}).",
            )
        return None

    def _direct(self, journey: Journey, ctx: PlanningContext) -> PlanResult:
        minutes, label, extra = ctx.direct_minutes(journey)
        margin = journey.request.margin_minutes
        arrive = journey.target_min - margin
        leg = timed_leg(journey.campus_mode, label, journey.campus.name, arrive - minutes, minutes)
        itinerary = assemble((leg,), margin, journey.day)
        return PlanResult(self.name, (itinerary,), ctx.compose([*journey.notices, *extra]))
