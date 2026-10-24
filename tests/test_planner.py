"""Unit tests for engine/planner.py covering all required edge cases."""

from datetime import date

import pytest

from engine.legs import ActiveLegPlanner
from engine.models import Itinerary, Leg, PlanRequest
from engine.planner import Planner
from engine.repositories import (
    JsonLocationRepository,
    JsonSegmentRepository,
    JsonTrainRepository,
)


def train_leg(itinerary: Itinerary) -> Leg:
    return next(leg for leg in itinerary.legs if leg.leg_type == "train")


@pytest.fixture
def planner() -> Planner:
    return Planner(
        train_repo=JsonTrainRepository(),
        location_repo=JsonLocationRepository(),
        segment_repo=JsonSegmentRepository(),
    )


def test_edge_case_dief_830_from_reggio_walk(planner: Planner):
    """Case: Class at 8:30 at DIEF from Reggio Emilia with walking last mile."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="08:30",
        destination_campus_id="dief",
        origin_city="Reggio Emilia",
        last_mile_mode="walk",
        first_mile_minutes=10,
        margin_minutes=10,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) > 0
    assert len(itineraries) <= 3

    # Option 1 should be the latest useful departure
    best = itineraries[0]
    # Check that arrival at campus is at or before target_time
    assert best.arrive_time <= req.parsed_time
    assert best.slack_min >= req.margin_minutes
    assert [leg.leg_type for leg in best.legs] == ["walk", "wait", "train", "walk"]
    assert best.legs[1].minutes == 5  # default station buffer
    assert best.legs[2].origin == "Reggio Emilia"
    assert best.legs[2].destination == "Modena"
    assert best.leave_time < best.legs[2].depart_time


def test_edge_case_dief_830_from_reggio_bike(planner: Planner):
    """Case: Class at 8:30 at DIEF from Reggio Emilia with bike last mile."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="08:30",
        destination_campus_id="dief",
        origin_city="Reggio Emilia",
        last_mile_mode="bike",
        first_mile_minutes=10,
        margin_minutes=10,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) == 3

    best = itineraries[0]
    assert best.legs[3].leg_type == "bike"
    assert best.legs[3].minutes == 22
    assert best.slack_min >= 10
    # With bike (22m), train arrives later than with walk (53m), so leave home later
    assert best.leave_at >= "07:00"


def test_edge_case_palazzo_dossetti_from_modena(planner: Planner):
    """Case: Class at Palazzo Dossetti (Reggio Emilia) from Modena."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="09:00",
        destination_campus_id="palazzo_dossetti",
        origin_city="Modena",
        last_mile_mode="walk",
        first_mile_minutes=10,
        margin_minutes=10,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) > 0

    best = itineraries[0]
    assert best.arrive_time <= req.parsed_time
    assert best.slack_min >= 10
    assert train_leg(best).origin == "Modena"
    assert train_leg(best).destination == "Reggio Emilia"
    # Destination campus is Palazzo Dossetti
    assert (
        best.legs[-1].destination == "Dipartimento di Comunicazione ed Economia - Palazzo Dossetti"
    )
    assert best.legs[-1].minutes == 19


def test_edge_case_same_city_no_trains(planner: Planner):
    """Case: Same city (Modena to DIEF) must NEVER use a train."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="09:00",
        destination_campus_id="dief",
        origin_city="Modena",
        origin_coords=(44.646192, 10.926072),  # Piazza Grande
        last_mile_mode="walk",
        margin_minutes=10,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) == 1

    it = itineraries[0]
    # Exactly one leg: direct walk (NO train)
    assert len(it.legs) == 1
    assert it.legs[0].leg_type == "walk"
    assert it.slack_min == 10
    assert it.arrive_time <= req.parsed_time


def test_edge_case_same_city_station_origin(planner: Planner):
    """Case: Intra-city starting from local station (Modena FS to DIEF)."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="10:00",
        destination_campus_id="dief",
        origin_station_id="modena_fs",
        origin_city="Modena",
        last_mile_mode="bike",
        margin_minutes=10,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) == 1
    it = itineraries[0]
    assert len(it.legs) == 1
    assert it.legs[0].leg_type == "bike"
    assert it.legs[0].minutes == 22


def test_edge_case_no_trains_available(planner: Planner):
    """Case: Class at 04:00 AM when no train runs early enough."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="04:00",
        destination_campus_id="dief",
        origin_city="Reggio Emilia",
        last_mile_mode="walk",
        margin_minutes=10,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) == 0


def test_edge_case_date_outside_validity(planner: Planner):
    """Case: Target date outside the official timetable period."""
    req = PlanRequest(
        target_date=date(2027, 2, 15),
        target_time="08:30",
        destination_campus_id="dief",
        origin_city="Reggio Emilia",
    )
    # Outside validity period should return empty or have warnings
    itineraries = planner.arrive_by(req)
    # No trains match in 2027 validity
    assert len(itineraries) == 0


def test_edge_case_margin_zero(planner: Planner):
    """Case: Margin = 0 minutes."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="08:30",
        destination_campus_id="dief",
        origin_city="Reggio Emilia",
        last_mile_mode="bike",
        first_mile_minutes=10,
        margin_minutes=0,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) > 0
    best = itineraries[0]
    assert best.slack_min >= 0
    assert best.arrive_time <= req.parsed_time


def test_invalid_campus_id_raises_value_error(planner: Planner):
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="08:30",
        destination_campus_id="non_existent_campus",
    )
    with pytest.raises(ValueError, match="Unknown campus id"):
        planner.arrive_by(req)


def test_sorting_latest_departure_first(planner: Planner):
    """Verify itineraries are ordered from latest useful departure to earlier departures."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="11:00",
        destination_campus_id="dief",
        origin_city="Reggio Emilia",
        last_mile_mode="bike",
        first_mile_minutes=10,
        margin_minutes=10,
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) >= 2

    # Latest departure should be first
    for i in range(len(itineraries) - 1):
        assert itineraries[i].leave_time >= itineraries[i + 1].leave_time


def test_origin_coords_resolution(planner: Planner):
    """Verify coordinates near Reggio Emilia resolve to Reggio Emilia."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="09:00",
        destination_campus_id="dief",
        origin_coords=(44.698, 10.635),  # Reggio Emilia historic center
        last_mile_mode="bike",
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) > 0
    assert train_leg(itineraries[0]).origin == "Reggio Emilia"


def test_planner_origin_station_id_explicit(planner: Planner):
    """Test specifying origin_station_id explicitly."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="09:00",
        destination_campus_id="dief",
        origin_station_id="reggio_fs",
        last_mile_mode="bike",
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) > 0
    # Already at the station: no 0-minute walk, the trip starts with the station buffer
    assert itineraries[0].legs[0].leg_type == "wait"
    assert all(leg.minutes > 0 for it in itineraries for leg in it.legs)
    assert itineraries[0].leave_at != train_leg(itineraries[0]).depart


def test_planner_destination_in_reggio_default_origin_modena(planner: Planner):
    """Test campus in Reggio with default origin defaulting to Modena."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="10:00",
        destination_campus_id="campus_san_lazzaro",
        last_mile_mode="bike",
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) > 0
    assert train_leg(itineraries[0]).origin == "Modena"
    assert train_leg(itineraries[0]).destination == "Reggio Emilia"


def test_planner_first_mile_coords(planner: Planner):
    """Test first mile calculated from origin coordinates."""
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="09:30",
        destination_campus_id="economia_biagi",
        origin_coords=(44.697309, 10.642577),  # at Reggio station coords
        first_mile_mode="walk",
        last_mile_mode="walk",
    )
    itineraries = planner.arrive_by(req)
    assert len(itineraries) > 0
    assert itineraries[0].legs[0].leg_type == "walk"


class _FixedScooterPlanner(ActiveLegPlanner):
    """Test double: a new active mode registered without touching Planner."""

    @property
    def mode(self) -> str:
        return "scooter"

    def calculate_minutes(self, *args, **kwargs) -> int:
        return 7


def test_new_active_mode_can_be_registered_without_changing_planner() -> None:
    planner = Planner(
        train_repo=JsonTrainRepository(),
        location_repo=JsonLocationRepository(),
        segment_repo=JsonSegmentRepository(),
        active_planners={"scooter": _FixedScooterPlanner()},
    )
    req = PlanRequest(
        target_date="2026-10-26",
        target_time="08:30",
        destination_campus_id="dief",
        origin_city="Reggio Emilia",
        first_mile_mode="scooter",
        last_mile_mode="scooter",
        margin_minutes=10,
    )
    best = planner.arrive_by(req)[0]
    assert best.legs[-1].leg_type == "scooter"
    assert best.legs[-1].minutes == 7
    # Built-in modes stay available and unknown modes fall back to walking.
    assert planner._get_active_planner("BIKE").mode == "bike"
    assert planner._get_active_planner("hovercraft").mode == "walk"
