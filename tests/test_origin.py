"""Tests for engine/origin.py."""

import pytest

from engine.legs import BikeLegPlanner, WalkLegPlanner
from engine.models import PlanRequest
from engine.origin import HOME_LABEL, OriginResolver
from engine.repositories import JsonLocationRepository, JsonSegmentRepository

segments = JsonSegmentRepository()
planners = {"walk": WalkLegPlanner(segments), "bike": BikeLegPlanner(segments)}
resolver = OriginResolver(JsonLocationRepository(), lambda m: planners.get(m, planners["walk"]))


def request(**kwargs) -> PlanRequest:
    return PlanRequest(
        target_date="2026-10-26", target_time="08:30", destination_campus_id="dief", **kwargs
    )


def test_station_origin_has_no_station_leg() -> None:
    home = resolver.resolve(request(origin_station_id="reggio_fs"), "Modena")
    assert home.is_station and home.station_leg_minutes == 0
    assert home.label == "Reggio Emilia FS" and home.city == "Reggio Emilia"
    assert home.estimate_note is None


def test_station_with_explicit_home_minutes() -> None:
    home = resolver.resolve(request(origin_station_id="modena_fs", first_mile_minutes=12), "Modena")
    assert not home.is_station
    assert home.label == HOME_LABEL
    assert home.station_leg_minutes == 12
    assert home.coords is None
    assert home.point == (home.station.lat, home.station.lon)


def test_coords_pick_nearest_station_and_estimate() -> None:
    home = resolver.resolve(
        request(origin_coords=(44.698, 10.635), first_mile_mode="walk"), "Modena"
    )
    assert home.station.id == "reggio_fs" and home.city == "Reggio Emilia"
    assert home.station_leg_minutes == 11
    assert home.estimate_note is not None and "stimato" in home.estimate_note
    assert home.warnings == ()


def test_far_from_station_warning() -> None:
    home = resolver.resolve(request(origin_coords=(44.85, 10.30), first_mile_minutes=30), "Modena")
    assert any("10 km" in w for w in home.warnings)
    assert home.estimate_note is None


def test_city_hint_and_default_commuter() -> None:
    hinted = resolver.resolve(request(origin_city="Reggio Emilia", first_mile_minutes=10), "Modena")
    assert hinted.station.id == "reggio_fs" and hinted.station_leg_minutes == 10
    default = resolver.resolve(request(), "Reggio Emilia")
    assert default.station.id == "modena_fs" and default.is_station


def test_unknown_station_and_city() -> None:
    with pytest.raises(ValueError, match="Unknown station"):
        resolver.resolve(request(origin_station_id="bologna_fs"), "Modena")
    with pytest.raises(ValueError, match="No station configured"):
        resolver.resolve(request(origin_city="Parma"), "Modena")


def test_nearest_station_requires_stations() -> None:
    class Empty(JsonLocationRepository):
        def all_stations(self):  # type: ignore[override]
            return []

    with pytest.raises(ValueError):
        OriginResolver(Empty(), lambda m: planners["walk"]).nearest_station((44.0, 10.0))
