"""UnimoreGo Engine Package.

Modular, SOLID-compliant itinerary planning engine for UNIMORE commuter students.
"""

from engine.models import Campus, Itinerary, Leg, PlanRequest, Station, TrainRun
from engine.planner import Planner
from engine.repositories import (
    JsonLocationRepository,
    JsonSegmentRepository,
    JsonTrainRepository,
    LocationRepository,
    SegmentRepository,
    TrainRepository,
)

__all__ = [
    "Campus",
    "Itinerary",
    "Leg",
    "PlanRequest",
    "Planner",
    "Station",
    "TrainRun",
    "TrainRepository",
    "LocationRepository",
    "SegmentRepository",
    "JsonTrainRepository",
    "JsonLocationRepository",
    "JsonSegmentRepository",
]
