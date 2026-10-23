"""Test suite for /api/campuses endpoint."""

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_list_campuses_success() -> None:
    """Verify /api/campuses returns all UNIMORE university campuses."""
    response = client.get("/api/campuses")
    assert response.status_code == 200
    campuses = response.json()
    assert isinstance(campuses, list)
    assert len(campuses) >= 5

    campus_ids = {c["id"] for c in campuses}
    assert "dief" in campus_ids
    assert "economia_biagi" in campus_ids
    assert "giurisprudenza" in campus_ids
    assert "palazzo_dossetti" in campus_ids
    assert "campus_san_lazzaro" in campus_ids

    # Validate schema of each campus
    for c in campuses:
        assert isinstance(c["id"], str)
        assert isinstance(c["name"], str)
        assert c["city"] in {"Modena", "Reggio Emilia"}
        assert isinstance(c["lat"], float)
        assert isinstance(c["lon"], float)
        assert 44.0 < c["lat"] < 45.0
        assert 10.0 < c["lon"] < 11.5
