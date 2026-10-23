"""API tests for the v0.4 options: return trip, station buffer, train categories,
calendar notes, nearby solutions and validity warnings."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

BASE = {
    "origin": {"station_id": "reggio_fs"},
    "campus_id": "dief",
    "mode": "bike",
    "margin_min": 10,
}


def post(**overrides):
    payload = {**BASE, "arrive_by": "2026-10-26T08:30:00", **overrides}
    payload = {k: v for k, v in payload.items() if v is not None}
    return client.post("/api/plan", json=payload)


def trains(data: dict) -> list[dict]:
    return [leg["train"] for it in data["itineraries"] for leg in it["legs"] if leg["train"]]


def test_station_origin_has_buffer_and_no_zero_minute_leg() -> None:
    data = post(train_categories=["regional"]).json()
    first = data["itineraries"][0]
    assert [leg["type"] for leg in first["legs"]] == ["wait", "train", "bike"]
    assert first["leave_at"] == "07:39"
    assert first["legs"][1]["depart"] == "07:44"


def test_custom_station_buffer() -> None:
    first = post(station_buffer_min=15, train_categories=["regional"]).json()["itineraries"][0]
    wait = first["legs"][0]
    assert (wait["type"], wait["minutes"], wait["arrive"]) == ("wait", 15, "07:44")


@pytest.mark.parametrize("value", [0, 31, -1])
def test_station_buffer_bounds(value: int) -> None:
    response = post(station_buffer_min=value)
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_train_categories_backward_compatible_default_includes_fr() -> None:
    data = post().json()
    fr = [t for t in trains(data) if t["code"] == "FR"]
    assert fr and all(t["different_ticket"] for t in fr)
    assert all(t["category_group"] == "high_speed" for t in fr)


def test_regional_only_filter() -> None:
    data = post(train_categories=["regional"]).json()
    assert {t["code"] for t in trains(data)} <= {"R", "RV"}
    assert not any(t["different_ticket"] for t in trains(data))


def test_unknown_category_rejected() -> None:
    assert post(train_categories=["bus"]).status_code == 422
    assert post(train_categories=[]).status_code == 422


def test_uninterpretable_calendar_note_on_leg() -> None:
    data = post().json()
    fr_leg = next(
        leg
        for it in data["itineraries"]
        for leg in it["legs"]
        if leg["train"] and leg["train"]["code"] == "FR"
    )
    assert any("non interpretata" in n and "pag. 74" in n for n in fr_leg["notes"])


def test_return_trip_depart_after() -> None:
    response = post(
        arrive_by=None, depart_after="2026-10-26T13:00:00", train_categories=["regional"]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["planner"] == "depart_after"
    first = data["itineraries"][0]
    assert [leg["type"] for leg in first["legs"]] == ["bike", "wait", "train"]
    assert (first["leave_at"], first["arrive_at"], first["slack_min"]) == ("13:33", "14:17", 33)
    assert first["legs"][-1]["to"] == "Reggio Emilia"


def test_return_trip_same_city_never_train() -> None:
    data = post(
        origin={"lat": 44.6500, "lon": 10.9300}, arrive_by=None, depart_after="2026-10-26T17:00:00"
    ).json()
    (it,) = data["itineraries"]
    assert [leg["type"] for leg in it["legs"]] == ["bike"]
    assert it["legs"][0]["to"] == "Casa"


@pytest.mark.parametrize(
    "times",
    [
        {"arrive_by": None},
        {"depart_after": "2026-10-26T13:00:00"},
    ],
)
def test_exactly_one_of_arrive_by_and_depart_after(times: dict) -> None:
    response = post(**times)
    assert response.status_code == 422
    assert "esattamente uno" in response.json()["detail"]


def test_invalid_depart_after_format() -> None:
    response = post(arrive_by=None, depart_after="domani")
    assert response.status_code == 422
    assert "depart_after" in response.json()["detail"]


def test_after_validity_explicit_warning_with_previous_solution() -> None:
    data = post(arrive_by="2026-12-14T08:30:00").json()
    assert data["itineraries"] == []
    assert any("dopo la fine di validità" in w for w in data["warnings"])
    assert data["nearby"][0]["kind"] == "previous"
    assert data["nearby"][0]["itinerary"]["date"] == "2026-12-12"


def test_holiday_warning() -> None:
    data = post(arrive_by="2026-12-08T08:30:00").json()
    assert any("Immacolata" in w for w in data["warnings"])


def test_openapi_documents_new_fields() -> None:
    spec = client.get("/openapi.json").json()
    props = spec["components"]["schemas"]["PlanRequestSchema"]["properties"]
    assert {"depart_after", "station_buffer_min", "train_categories"} <= set(props)
    assert "/api/geocode" in spec["paths"]
