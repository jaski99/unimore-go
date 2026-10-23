"""The web mock fixtures must match what the real API returns today."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from api.main import create_app
from api.settings import Settings
from tools.export_mock_fixtures import DEMO_REQUEST, OUTPUT, build_fixtures


def test_build_fixtures_uses_real_api_responses() -> None:
    fixtures = build_fixtures(TestClient(create_app(Settings())))
    assert fixtures["demo"]["request"] == DEMO_REQUEST
    assert fixtures["health"]["status"] == "ok"
    assert {c["id"] for c in fixtures["campuses"]} >= {"dief", "palazzo_dossetti"}
    assert fixtures["demo"]["response"]["itineraries"], "demo case must yield itineraries"


def test_committed_fixtures_are_up_to_date() -> None:
    committed = json.loads(Path(OUTPUT).read_text(encoding="utf-8"))
    assert committed == build_fixtures(TestClient(create_app(Settings())))
