"""Journey planner strategy interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import ClassVar

from engine.journeys.context import PlanningContext
from engine.models import PlanRequest, PlanResult
from engine.train_categories import GROUPS, REGIONAL


class JourneyPlanner(ABC):
    """A way of answering a commuter question (e.g. 'when do I leave?').

    Implementations are stateless and registered by ``name``; they reuse the
    leg strategies exposed by :class:`PlanningContext` (Open/Closed).
    """

    name: ClassVar[str]

    @abstractmethod
    def plan(self, request: PlanRequest, ctx: PlanningContext) -> PlanResult:
        """Compute itineraries, warnings and nearby alternatives."""


def category_hint(request: PlanRequest) -> str:
    """Suggest enabling more categories when the user restricted them."""
    groups = request.train_categories
    if groups is None or set(groups) >= set(GROUPS):
        return ""
    if groups == frozenset({REGIONAL}):
        return (
            " Stai cercando solo treni regionali (R/RV): puoi includere Intercity e Frecciarossa."
        )
    return " Il filtro sul tipo di treno è attivo: puoi includere altre categorie."
