"""Export real API responses as offline fixtures for the web mock.

The web app falls back to these fixtures only when NEXT_PUBLIC_USE_MOCK=1.
They are produced by calling the actual FastAPI app in-process, so the mock
never contains hand-written timetable data. Re-run after changing data/:

    python tools/export_mock_fixtures.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.main import create_app  # noqa: E402
from api.settings import Settings  # noqa: E402

OUTPUT = ROOT / "web" / "src" / "lib" / "api" / "mock-fixtures.json"

# The single demo case covered by the mock: Reggio Emilia FS -> DIEF,
# Monday 26/10/2026, lesson at 08:30, bike, 10 min margin, UI defaults
# (5 min in station, regional trains only).
DEMO_REQUEST = {
    "origin": {"station_id": "reggio_fs"},
    "campus_id": "dief",
    "arrive_by": "2026-10-26T08:30:00+01:00",
    "mode": "bike",
    "margin_min": 10,
    "station_buffer_min": 5,
    "train_categories": ["regional"],
}


def build_fixtures(client: TestClient) -> dict:
    """Collect health, catalog and demo plan responses from the API."""

    def ok(response):
        response.raise_for_status()
        return response.json()

    return {
        "generated_by": "tools/export_mock_fixtures.py",
        "health": ok(client.get("/api/health")),
        "campuses": ok(client.get("/api/campuses")),
        "stations": ok(client.get("/api/stations")),
        "demo": {
            "request": DEMO_REQUEST,
            "response": ok(client.post("/api/plan", json=DEMO_REQUEST)),
        },
    }


def main() -> None:  # pragma: no cover - CLI wrapper
    fixtures = build_fixtures(TestClient(create_app(Settings())))
    OUTPUT.write_text(json.dumps(fixtures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":  # pragma: no cover
    main()
