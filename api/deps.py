"""FastAPI dependency injection providers for repositories, planner and services.

Adheres to Dependency Inversion (SOLID): routers depend exclusively on these
providers, enabling effortless mock injection in unit and contract tests.
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from api.geocoding import Geocoder, NominatimGeocoder
from engine.planner import Planner
from engine.repositories import (
    JsonLocationRepository,
    JsonSegmentRepository,
    JsonTrainRepository,
    LocationRepository,
    SegmentRepository,
    TrainRepository,
)
from engine.validity import TimetableValidity


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


@lru_cache
def _build_planner(
    train_repo: TrainRepository,
    location_repo: LocationRepository,
    segment_repo: SegmentRepository,
) -> Planner:
    return Planner(train_repo=train_repo, location_repo=location_repo, segment_repo=segment_repo)


def get_planner(
    train_repo: TrainRepository = Depends(get_train_repository),
    location_repo: LocationRepository = Depends(get_location_repository),
    segment_repo: SegmentRepository = Depends(get_segment_repository),
) -> Planner:
    """Provide a Planner wired with injected repositories (cached per repository set)."""
    return _build_planner(train_repo, location_repo, segment_repo)


def get_validity(
    train_repo: TrainRepository = Depends(get_train_repository),
) -> TimetableValidity:
    """Timetable validity window derived from the loaded train data."""
    return TimetableValidity.from_trains(train_repo.all_trains())


@lru_cache
def get_geocoder() -> Geocoder:
    """Provide the address geocoder (OpenStreetMap Nominatim)."""
    return NominatimGeocoder()
