"""Journey planners (strategies) registered by name in :class:`engine.planner.Planner`."""

from engine.journeys.arrive_by import ArriveByPlanner
from engine.journeys.base import JourneyPlanner
from engine.journeys.context import Journey, PlanningContext
from engine.journeys.depart_after import DepartAfterPlanner

DEFAULT_JOURNEY_PLANNERS: tuple[JourneyPlanner, ...] = (ArriveByPlanner(), DepartAfterPlanner())

__all__ = [
    "DEFAULT_JOURNEY_PLANNERS",
    "ArriveByPlanner",
    "DepartAfterPlanner",
    "Journey",
    "JourneyPlanner",
    "PlanningContext",
]
