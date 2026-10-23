"""Unit tests for engine/legs.py."""

from datetime import date, time

from engine.legs import (
    BikeLegPlanner,
    TrainLegPlanner,
    WalkLegPlanner,
    estimate_active_minutes,
    haversine_distance_m,
)
from engine.models import TrainRun
from engine.repositories import JsonSegmentRepository


def test_haversine_distance():
    # Coords for Modena FS and DIEF (~3118m straight line)
    d = haversine_distance_m(44.653998, 10.930751, 44.629227, 10.949232)
    assert 3100 < d < 3150

    # Same point
    assert haversine_distance_m(44.0, 10.0, 44.0, 10.0) == 0.0


def test_estimate_active_minutes():
    # 1000m straight line:
    # Walk: 1.0 km * 1.3 / 4.5 * 60 = 17.33 min -> ceil 18 min
    walk_m = estimate_active_minutes(1000.0, "walk")
    assert walk_m == 18

    # Bike: 1.0 km * 1.3 / 15.0 * 60 = 5.2 min -> ceil 6 min
    bike_m = estimate_active_minutes(1000.0, "bike")
    assert bike_m == 6


def test_walk_and_bike_leg_planners():
    seg_repo = JsonSegmentRepository()
    walk_planner = WalkLegPlanner(seg_repo)
    bike_planner = BikeLegPlanner(seg_repo)

    assert walk_planner.mode == "walk"
    assert bike_planner.mode == "bike"

    # User override priority
    assert (
        walk_planner.calculate_minutes(
            origin_id="modena_fs", destination_id="dief", user_override_minutes=25
        )
        == 25
    )

    # Segment repository lookup
    assert walk_planner.calculate_minutes(origin_id="modena_fs", destination_id="dief") == 53
    assert bike_planner.calculate_minutes(origin_id="modena_fs", destination_id="dief") == 22

    # Coords-based calculation when IDs unknown
    coords_orig = (44.653998, 10.930751)
    coords_dest = (44.629227, 10.949232)
    min_walk_est = walk_planner.calculate_minutes(
        origin_coords=coords_orig, destination_coords=coords_dest
    )
    assert 50 <= min_walk_est <= 60

    # Backward leg planning
    leg_back = walk_planner.plan_leg_backward(
        origin_name="Origine",
        destination_name="DIEF",
        arrive_by=time(8, 20),
        origin_id="modena_fs",
        destination_id="dief",
    )
    assert leg_back.arrive == "08:20"
    assert leg_back.minutes == 53
    assert leg_back.depart == "07:27"

    # Forward leg planning
    leg_fwd = bike_planner.plan_leg_forward(
        origin_name="Modena FS",
        destination_name="DIEF",
        depart_at=time(7, 40),
        origin_id="modena_fs",
        destination_id="dief",
    )
    assert leg_fwd.depart == "07:40"
    assert leg_fwd.minutes == 22
    assert leg_fwd.arrive == "08:02"

    # Default fallback minutes
    empty_planner = WalkLegPlanner(None)
    assert empty_planner.calculate_minutes() == 10


def test_train_leg_planner():
    planner = TrainLegPlanner()

    train_mon = TrainRun(
        from_station="Reggio Emilia",
        to_station="Modena",
        depart="07:04",
        arrive="07:20",
        train="2451",
        category="Regionale Veloce",
        operator="Trenitalia Tper",
        days=("mon", "tue", "wed", "thu", "fri"),
        valid_from="2026-10-17",
        valid_to="2026-12-12",
        calendar_note="Nessuna limitazione",
        source="",
    )

    train_sat_only = TrainRun(
        from_station="Reggio Emilia",
        to_station="Modena",
        depart="07:10",
        arrive="07:26",
        train="9999",
        category="Regionale",
        operator="Trenitalia Tper",
        days=("sat",),
        valid_from="2026-10-17",
        valid_to="2026-12-12",
        calendar_note="",
        source="",
    )

    trains = [train_mon, train_sat_only]

    # Monday 2026-10-26 with deadline 07:30
    res = planner.filter_trains(trains, target_date=date(2026, 10, 26), latest_arrival=time(7, 30))
    assert len(res) == 1
    assert res[0].train == "2451"

    # Deadline too early (07:15)
    res_early = planner.filter_trains(
        trains, target_date=date(2026, 10, 26), latest_arrival=time(7, 15)
    )
    assert len(res_early) == 0

    # Date outside validity range (e.g. 2027-01-10)
    res_out = planner.filter_trains(
        trains, target_date=date(2027, 1, 10), latest_arrival=time(8, 0)
    )
    assert len(res_out) == 0

    # Build leg
    leg = planner.build_train_leg(train_mon)
    assert leg.leg_type == "train"
    assert leg.depart == "07:04"
    assert leg.arrive == "07:20"
    assert leg.minutes == 16
    assert leg.train == train_mon
