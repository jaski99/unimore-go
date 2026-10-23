"""FastAPI dependency injection providers for repositories and planner.

Adheres to Dependency Inversion (SOLID): routers depend exclusively on these
providers, enabling effortless mock injection in unit and contract tests.
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from engine.planner import Planner
from engine.repositories import (
    JsonLocationRepository,
    JsonSegmentRepository,
    JsonTrainRepository,
    LocationRepository,
    SegmentRepository,
    TrainRepository,
)


@lru_cache
def get_train_repository() -> TrainRepository:
    """Provide singleton instance of TrainRepository."""
    return JsonTrainRepository()


@lru_cache
def get_location_repository() -> LocationRepository:
    """Provide singleton instance of LocationRepository."""
    return JsonLocationRepository()


@lru_cache
def get_segment_repository() -> SegmentRepository:
    """Provide singleton instance of SegmentRepository."""
    return JsonSegmentRepository()


def get_planner(
    train_repo: TrainRepository = Depends(get_train_repository),
    location_repo: LocationRepository = Depends(get_location_repository),
    segment_repo: SegmentRepository = Depends(get_segment_repository),
) -> Planner:
    """Provide Planner instance wired with injected repositories."""
    return Planner(
        train_repo=train_repo,
        location_repo=location_repo,
        segment_repo=segment_repo,
    )
