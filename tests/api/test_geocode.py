"""Tests for the geocoding adapter and /api/geocode (no real network calls)."""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from api.deps import get_geocoder
from api.geocoding import USER_AGENT, Geocoder, GeocodingError, NominatimGeocoder, Place
from api.main import app

client = TestClient(app)


class FakeGeocoder(Geocoder):
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.queries: list[str] = []

    def search(self, query: str, limit: int = 5) -> list[Place]:
        self.queries.append(query)
        if self.fail:
            raise GeocodingError("down")
        return [Place("Via Emilia Centro, Modena", 44.6466, 10.9253)]


@pytest.fixture
def fake() -> FakeGeocoder:
    geocoder = FakeGeocoder()
    app.dependency_overrides[get_geocoder] = lambda: geocoder
    yield geocoder
    app.dependency_overrides.clear()


def test_geocode_endpoint(fake: FakeGeocoder) -> None:
    response = client.get("/api/geocode", params={"q": "via emilia modena"})
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == [
        {"label": "Via Emilia Centro, Modena", "lat": 44.6466, "lon": 10.9253}
    ]
    assert "OpenStreetMap" in data["attribution"]
    assert fake.queries == ["via emilia modena"]


def test_geocode_query_validation(fake: FakeGeocoder) -> None:
    assert client.get("/api/geocode", params={"q": "ab"}).status_code == 422


def test_geocode_upstream_failure() -> None:
    app.dependency_overrides[get_geocoder] = lambda: FakeGeocoder(fail=True)
    try:
        response = client.get("/api/geocode", params={"q": "via emilia"})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503
    assert response.json()["code"] == "UPSTREAM"


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_nominatim_request_cache_and_throttle() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json=[
                {"display_name": "Piazza Grande, Modena", "lat": "44.6463", "lon": "10.9255"},
                {"display_name": "incomplete"},
            ],
        )

    now = [100.0]
    sleeps: list[float] = []
    geocoder = NominatimGeocoder(
        client=_client(handler), clock=lambda: now[0], sleep=lambda s: sleeps.append(s)
    )
    first = geocoder.search("Piazza Grande Modena")
    assert first == [Place("Piazza Grande, Modena", 44.6463, 10.9255)]
    assert geocoder.search("  piazza   grande modena ") is first  # cached, normalised
    assert len(seen) == 1
    params = seen[0].url.params
    assert params["bounded"] == "1" and params["countrycodes"] == "it"
    assert seen[0].headers["User-Agent"] == USER_AGENT

    now[0] += 0.25
    geocoder.search("Via Emilia")
    assert sleeps == [pytest.approx(0.75)]


def test_nominatim_cache_eviction() -> None:
    from api import geocoding

    geocoder = NominatimGeocoder(
        client=_client(lambda r: httpx.Response(200, json=[])),
        clock=lambda: 0.0,
        sleep=lambda s: None,
    )
    original = geocoding.CACHE_SIZE
    geocoding.CACHE_SIZE = 2
    try:
        for q in ("aaa", "bbb", "ccc"):
            geocoder.search(q)
        assert len(geocoder._cache) == 2
    finally:
        geocoding.CACHE_SIZE = original


@pytest.mark.parametrize(
    "response",
    [httpx.Response(500), httpx.Response(200, content=b"not json")],
)
def test_nominatim_errors(response: httpx.Response) -> None:
    geocoder = NominatimGeocoder(
        client=_client(lambda r: response), clock=lambda: 0.0, sleep=lambda s: None
    )
    with pytest.raises(GeocodingError):
        geocoder.search("via emilia")


def test_default_geocoder_provider() -> None:
    assert isinstance(get_geocoder(), NominatimGeocoder)
