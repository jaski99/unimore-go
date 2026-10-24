"""Test suite for /api/stations endpoint."""

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_list_stations_success() -> None:
    """Verify /api/stations returns railway stations with proper coordinates."""
    response = client.get("/api/stations")
    assert response.status_code == 200
    stations = response.json()
    assert isinstance(stations, list)
    assert len(stations) >= 2

    ids = {s["id"] for s in stations}
    assert ids == {"modena_fs", "rubiera", "reggio_fs"}

    for s in stations:
        assert isinstance(s["id"], str)
        assert isinstance(s["name"], str)
        assert s["city"] in {"Modena", "Rubiera", "Reggio Emilia"}
        assert isinstance(s["lat"], float)
        assert isinstance(s["lon"], float)
