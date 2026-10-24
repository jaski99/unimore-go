"""Comprehensive test suite for /api/plan endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.deps import get_planner
from api.main import app
from engine.models import Itinerary, Leg, PlanRequest, PlanResult

client = TestClient(app)


def test_plan_intercity_station_origin_bike() -> None:
    """Test standard intercity commute from Reggio Emilia FS to DIEF (Modena) by bike."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "mode": "bike",
        "margin_min": 10,
        "home_to_station_min": 10,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "itineraries" in data
    assert "warnings" in data
    itineraries = data["itineraries"]
    assert 1 <= len(itineraries) <= 3

    # Check order: descending by leave_at (latest first)
    leave_times = [it["leave_at"] for it in itineraries]
    assert leave_times == sorted(leave_times, reverse=True)

    # Inspect first itinerary
    first = itineraries[0]
    # 07:44 RV 3907 - 5 min station buffer - 10 min home->station
    assert first["leave_at"] == "07:29"
    assert first["arrive_at"] == "08:18"
    assert first["slack_min"] >= 10
    assert first["date"] == "2026-10-26"
    assert [leg["type"] for leg in first["legs"]] == ["bike", "wait", "train", "bike"]
    assert first["legs"][1]["minutes"] == 5

    # Leg 1: bike home -> reggio_fs
    leg1 = first["legs"][0]
    assert leg1["type"] == "bike"
    assert leg1["to"] == "Reggio Emilia FS"
    assert leg1["minutes"] == 10

    # Leg 3: train reggio_fs -> modena_fs
    leg2 = first["legs"][2]
    assert leg2["type"] == "train"
    assert leg2["from"] == "Reggio Emilia"
    assert leg2["to"] == "Modena"
    assert leg2["train"] is not None
    assert leg2["train"]["number"] == "3907"
    assert leg2["train"]["category"] == "Regionale Veloce"
    assert leg2["train"]["code"] == "RV"
    assert leg2["train"]["different_ticket"] is False
    assert "pag. 75" in leg2["train"]["source"]

    # Leg 4: bike modena_fs -> DIEF
    leg3 = first["legs"][3]
    assert leg3["type"] == "bike"
    assert leg3["from"] == "Modena FS"
    assert "DIEF" in leg3["to"] or "Ingegneria" in leg3["to"]

    # Warning presence
    assert any("non in tempo reale" in w for w in data["warnings"])


def test_plan_intercity_walk_mode() -> None:
    """Test intercity commute with walking mode."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "economia_biagi",
        "arrive_by": "2026-10-26T09:00:00",
        "mode": "walk",
        "margin_min": 10,
        "home_to_station_min": 5,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["itineraries"]) >= 1
    first = data["itineraries"][0]
    assert [leg["type"] for leg in first["legs"]] == ["walk", "wait", "train", "walk"]


def test_plan_coords_origin_missing_home_to_station() -> None:
    """Test coordinates origin without home_to_station_min creates estimate and warning."""
    payload = {
        "origin": {"lat": 44.7000, "lon": 10.6400},  # ~500m from Reggio Emilia FS
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "mode": "bike",
        "margin_min": 10,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["itineraries"]) >= 1

    # Warning must explain the estimated hypothesis
    warnings = data["warnings"]
    assert any("Tempo casa → Reggio Emilia FS stimato" in w for w in warnings)
    assert any("in bici" in w for w in warnings)


def test_plan_coords_origin_with_home_to_station_override() -> None:
    """Test coordinates origin with user-specified home_to_station_min."""
    payload = {
        "origin": {"lat": 44.7000, "lon": 10.6400},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "mode": "bike",
        "margin_min": 10,
        "home_to_station_min": 15,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["itineraries"]) >= 1
    first = data["itineraries"][0]
    assert first["legs"][0]["minutes"] == 15


def test_plan_same_city_coords_modena_to_dief() -> None:
    """Intra-city rule: Modena coords to Modena DIEF must NEVER take a train."""
    payload = {
        "origin": {"lat": 44.6500, "lon": 10.9300},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "mode": "bike",
        "margin_min": 10,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["itineraries"]) == 1
    it = data["itineraries"][0]

    # Exactly 1 active leg, NO train
    assert len(it["legs"]) == 1
    assert it["legs"][0]["type"] == "bike"
    assert it["legs"][0]["train"] is None

    # Clear warning about same city direct active route
    assert any("stessa città" in w for w in data["warnings"])


def test_plan_same_city_station_reggio_to_buccola() -> None:
    """Intra-city rule: Reggio station to Campus San Lazzaro (Reggio) must NOT take a train."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "campus_san_lazzaro",
        "arrive_by": "2026-10-26T09:00:00",
        "mode": "bike",
        "margin_min": 5,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["itineraries"]) == 1
    it = data["itineraries"][0]
    assert len(it["legs"]) == 1
    assert it["legs"][0]["type"] == "bike"
    assert it["legs"][0]["train"] is None
    assert any("stessa città" in w for w in data["warnings"])


def test_plan_out_of_validity_date_warning() -> None:
    """Test date outside bulletin validity window (expires 12/12/2026) triggers warning."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "dief",
        "arrive_by": "2027-01-15T08:30:00",
        "mode": "bike",
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    warnings = data["warnings"]
    assert any("12 dic 2026" in w for w in warnings)


def test_plan_origin_far_from_station_warning() -> None:
    """Test origin coords > 10 km from station triggers distance warning."""
    payload = {
        "origin": {"lat": 44.4500, "lon": 10.7000},  # ~27km from Reggio Emilia FS
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "mode": "bike",
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    warnings = data["warnings"]
    assert any("oltre 10 km" in w for w in warnings)


def test_plan_no_trains_available_warning() -> None:
    """Test that when no train can arrive before class time, warning is emitted."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T05:00:00",  # Extremely early, before first train
        "mode": "walk",
        "margin_min": 10,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["itineraries"]) == 0
    warnings = data["warnings"]
    assert any("Nessun treno da Reggio Emilia FS" in w for w in warnings)
    # 05:00 - 10 - 53 (walk Modena FS -> DIEF); no result, so only inside the notice.
    assert data["calculation"] is None
    assert any("entro le 03:57" in w and "Calcolo:" in w for w in warnings)
    # No evening train of the day before: the first train of the day (R 17401
    # 04:43, page 74) reaches the campus 50 min late, which is proposed as "next".
    (following,) = data["nearby"]
    assert following["kind"] == "next"
    assert following["itinerary"]["date"] == "2026-10-26"
    assert following["itinerary"]["slack_min"] == -50
    assert "arrivi in sede 50 min in ritardo" in following["label"]


def test_plan_dependency_override() -> None:
    """Demonstrate FastAPI dependency injection substitution in test environment."""

    class MockPlanner:
        def plan(self, req: PlanRequest, planner: str = "arrive_by") -> PlanResult:
            mock_leg = Leg(
                leg_type="walk",
                origin="Mock Origin",
                destination="Mock DIEF",
                depart="08:00",
                arrive="08:20",
                minutes=20,
            )
            itinerary = Itinerary(
                leave_at="08:00",
                legs=(mock_leg,),
                arrive_at="08:20",
                slack_min=10,
                warnings=("Mock warning",),
            )
            return PlanResult(planner, (itinerary,))

    app.dependency_overrides[get_planner] = lambda: MockPlanner()  # type: ignore[assignment]
    try:
        response = client.post(
            "/api/plan",
            json={
                "origin": {"station_id": "reggio_fs"},
                "campus_id": "dief",
                "arrive_by": "2026-10-26T08:30:00",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["itineraries"]) == 1
        assert data["itineraries"][0]["leave_at"] == "08:00"
        assert data["itineraries"][0]["legs"][0]["from"] == "Mock Origin"
        assert "Mock warning" in data["warnings"]
    finally:
        app.dependency_overrides.clear()
