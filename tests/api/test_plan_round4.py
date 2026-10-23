"""Round 4 behaviour on the real dataset (points 1, 2 and 4).

Cases reproduced with the API before the change:

* Sun 25/10 04:00, Modena FS -> Palazzo Dossetti on foot: "Ultimo treno utile
  del giorno: arrivi in sede 152 min prima…" (point 1);
* Modena FS -> DIEF on foot: 53 min with no hint that the bike is faster (point 2);
* Sun 25/10, Reggio Emilia -> DIEF: unmarked runs (no † / Ⓑ / Ⓒ symbol) were
  shown like the festive ones, with no per-train caution (point 4).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def plan(when: str, *, station: str = "reggio_fs", campus: str = "dief", mode: str = "bike"):
    response = client.post(
        "/api/plan",
        json={
            "origin": {"station_id": station},
            "campus_id": campus,
            "arrive_by": when,
            "mode": mode,
            "margin_min": 10,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def train_legs(itinerary: dict) -> list[dict]:
    return [leg["train"] for leg in itinerary["legs"] if leg["train"]]


def test_long_slack_is_written_in_hours_and_minutes() -> None:
    data = plan("2026-10-25T04:00:00", station="modena_fs", campus="palazzo_dossetti", mode="walk")
    labels = [n["label"] for n in data["nearby"]]
    assert (
        "Ultimo treno utile del giorno: arrivi in sede 2 h 32 min prima dell'inizio della lezione."
    ) in labels
    assert not any("152 min" in label for label in labels)


def test_long_same_city_walk_suggests_the_bike() -> None:
    walk = plan("2026-10-26T09:00:00", station="modena_fs", mode="walk")
    assert walk["itineraries"][0]["duration_min"] == 53
    bike = plan("2026-10-26T09:00:00", station="modena_fs", mode="bike")
    bike_minutes = bike["itineraries"][0]["duration_min"]
    assert walk["suggestion"] == {
        "mode": "bike",
        "minutes": bike_minutes,
        "message": f"In bici circa {bike_minutes} min (a piedi 53 min).",
    }
    assert bike["suggestion"] is None


def test_suggestion_only_for_same_city_walks() -> None:
    assert plan("2026-10-26T09:00:00", mode="walk")["suggestion"] is None  # train trip


def test_unmarked_runs_on_sundays_are_flagged() -> None:
    sunday = plan("2026-10-25T08:30:00")
    flags = [t["festive_unverified"] for it in sunday["itineraries"] for t in train_legs(it)]
    assert flags and all(flags)  # 3907 / 2451 / 3905 carry no day symbol
    monday = plan("2026-10-26T08:30:00")
    assert not any(t["festive_unverified"] for it in monday["itineraries"] for t in train_legs(it))


def test_holiday_8_december_is_treated_like_a_sunday() -> None:
    holiday = plan("2026-12-08T08:30:00")
    assert any(t["festive_unverified"] for it in holiday["itineraries"] for t in train_legs(it))


def test_festive_symbol_runs_are_verified() -> None:
    # R 3953 12:44 Reggio Emilia -> Modena carries † (PDF file page 92).
    data = plan("2026-10-25T13:30:00")
    first = train_legs(data["itineraries"][0])[0]
    assert first["number"] == "3953"
    assert first["festive_unverified"] is False
