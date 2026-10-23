"""Strict JSON contract validation and error handling test suite."""

from __future__ import annotations

import re
from typing import Any

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

TIME_REGEX = re.compile(r"^\d{2}:\d{2}$")


def _validate_leg_contract(leg: dict[str, Any]) -> None:
    """Ensure leg strictly adheres to the API specification."""
    assert "type" in leg
    assert leg["type"] in {"walk", "bike", "train"}
    assert "from" in leg
    assert isinstance(leg["from"], str)
    assert "to" in leg
    assert isinstance(leg["to"], str)
    assert "depart" in leg
    assert TIME_REGEX.match(leg["depart"])
    assert "arrive" in leg
    assert TIME_REGEX.match(leg["arrive"])
    assert "minutes" in leg
    assert isinstance(leg["minutes"], int)
    assert leg["minutes"] >= 0

    if leg["type"] == "train":
        assert leg["train"] is not None
        train = leg["train"]
        assert "number" in train
        assert isinstance(train["number"], str)
        assert "category" in train
        assert isinstance(train["category"], str)
        assert "operator" in train
        assert isinstance(train["operator"], str)
    else:
        assert leg["train"] is None


def _validate_itinerary_contract(it: dict[str, Any]) -> None:
    """Ensure itinerary strictly adheres to the API specification."""
    assert "leave_at" in it
    assert TIME_REGEX.match(it["leave_at"])
    assert "arrive_at" in it
    assert TIME_REGEX.match(it["arrive_at"])
    assert "slack_min" in it
    assert isinstance(it["slack_min"], int)
    assert it["slack_min"] >= 0
    assert "legs" in it
    assert isinstance(it["legs"], list)
    assert len(it["legs"]) >= 1
    for leg in it["legs"]:
        _validate_leg_contract(leg)


def test_contract_plan_response() -> None:
    """Validate full response contract for /api/plan."""
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
    assert isinstance(data["itineraries"], list)
    assert len(data["itineraries"]) <= 3
    for it in data["itineraries"]:
        _validate_itinerary_contract(it)

    assert "warnings" in data
    assert isinstance(data["warnings"], list)
    for w in data["warnings"]:
        assert isinstance(w, str)


def test_contract_error_404_unknown_campus() -> None:
    """404 error must return uniform {detail, code: 'NOT_FOUND'}."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "non_existent_campus_123",
        "arrive_by": "2026-10-26T08:30:00",
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "NOT_FOUND"
    assert "detail" in data
    assert "non_existent_campus_123" in data["detail"]


def test_contract_error_404_unknown_station() -> None:
    """404 error for station must return uniform {detail, code: 'NOT_FOUND'}."""
    payload = {
        "origin": {"station_id": "station_does_not_exist"},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "NOT_FOUND"
    assert "station_does_not_exist" in data["detail"]


def test_contract_error_422_margin_out_of_bounds() -> None:
    """422 error must return uniform {detail, code: 'VALIDATION_ERROR'}."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "margin_min": 99,  # exceeds max 60
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "VALIDATION_ERROR"
    assert "margin_min" in data["detail"]


def test_contract_error_422_negative_margin() -> None:
    """422 error for negative margin."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "margin_min": -5,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "VALIDATION_ERROR"


def test_contract_error_422_invalid_mode() -> None:
    """422 error for invalid mode (only walk and bike supported)."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "dief",
        "arrive_by": "2026-10-26T08:30:00",
        "mode": "car",
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "VALIDATION_ERROR"


def test_contract_error_422_invalid_iso_datetime() -> None:
    """422 error when arrive_by is not a valid ISO 8601 string."""
    payload = {
        "origin": {"station_id": "reggio_fs"},
        "campus_id": "dief",
        "arrive_by": "invalid-datetime-format",
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "VALIDATION_ERROR"
    assert "ISO 8601" in data["detail"]


def test_contract_cors_headers() -> None:
    """Verify CORS middleware sets Access-Control-Allow-Origin headers."""
    response = client.options(
        "/api/plan",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_error_handlers_direct() -> None:
    """Directly test exception handlers for complete error handling coverage."""
    import asyncio

    from fastapi import HTTPException
    from starlette.requests import Request

    from api.errors import (
        error_response_docs,
        generic_exception_handler,
        http_exception_handler,
    )

    docs = error_response_docs()
    assert 404 in docs
    assert 422 in docs

    scope = {"type": "http", "method": "GET", "path": "/"}
    req = Request(scope)

    # 404 without code
    res_404 = asyncio.run(
        http_exception_handler(req, HTTPException(status_code=404, detail="Not found"))
    )
    assert res_404.status_code == 404
    assert b"NOT_FOUND" in res_404.body

    # 422 without code
    res_422 = asyncio.run(
        http_exception_handler(req, HTTPException(status_code=422, detail="Invalid"))
    )
    assert res_422.status_code == 422
    assert b"VALIDATION_ERROR" in res_422.body

    # 500 generic
    res_500 = asyncio.run(generic_exception_handler(req, RuntimeError("Crash")))
    assert res_500.status_code == 500
    assert b"INTERNAL_SERVER_ERROR" in res_500.body
