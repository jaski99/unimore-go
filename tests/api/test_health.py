"""Test suite for /api/health endpoint."""

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    """Verify /api/health returns operational status and timetable expiration."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["data_valid_to"] == "2026-12-12"
    assert data["version"] == "0.2.0"
