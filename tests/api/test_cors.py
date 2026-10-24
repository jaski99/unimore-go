"""CORS behaviour of the API: origins are configurable via CORS_ORIGINS."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.settings import DEFAULT_CORS_ORIGINS, Settings, parse_cors_origins

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Content-Type",
}


def _preflight(client: TestClient, origin: str):
    return client.options("/api/plan", headers={"Origin": origin, **PREFLIGHT_HEADERS})


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, DEFAULT_CORS_ORIGINS),
        ("", DEFAULT_CORS_ORIGINS),
        (" , ", DEFAULT_CORS_ORIGINS),
        ("https://a.example", ("https://a.example",)),
        (
            " https://a.example/ ,http://localhost:3000,, ",
            ("https://a.example", "http://localhost:3000"),
        ),
    ],
)
def test_parse_cors_origins(raw: str | None, expected: tuple[str, ...]) -> None:
    assert parse_cors_origins(raw) == expected


def test_settings_from_env_reads_cors_origins() -> None:
    settings = Settings.from_env({"CORS_ORIGINS": "https://web.example"})
    assert settings.cors_origins == ("https://web.example",)
    assert Settings.from_env({}).cors_origins == ("http://localhost:3000",)


def test_default_origin_is_localhost_3000(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    client = TestClient(create_app())
    response = _preflight(client, "http://localhost:3000")
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_origin_from_env_is_allowed_and_others_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://web.example,https://preview.example")
    client = TestClient(create_app())

    allowed = _preflight(client, "https://preview.example")
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://preview.example"

    rejected = _preflight(client, "http://localhost:3000")
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers


def test_simple_get_carries_cors_header_without_credentials() -> None:
    client = TestClient(create_app(Settings(cors_origins=("https://web.example",))))
    response = client.get("/api/health", headers={"Origin": "https://web.example"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://web.example"
    assert "access-control-allow-credentials" not in response.headers

    foreign = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in foreign.headers
