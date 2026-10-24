"""Round 3 regressions on the real dataset (items 2, 3, 4, 6, 9 and 13).

Cases reproduced with the API before the fix:

* 20/12 and 01/10 (outside the timetable) still returned ``calculation``, so the
  UI showed "arrivo in stazione entro le …" next to the validity notice (item 2);
* Sun 25/10 06:00, Modena FS -> Palazzo Dossetti on foot: no itinerary, the
  formula was both in the no-service notice and in ``calculation`` (item 3),
  and the next train arriving 4 min *before* the lesson was labelled
  "arrivi in sede con -4 min di ritardo" (item 4);
* same city from the station said "Casa e sede" (item 6);
* Sunday 25/10 had results and no festive note (item 9).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def plan(
    when: str, *, origin=None, campus: str = "dief", mode: str = "bike", margin: int = 10
) -> dict:
    payload = {
        "origin": origin or {"station_id": "reggio_fs"},
        "campus_id": campus,
        "arrive_by": when,
        "mode": mode,
        "margin_min": margin,
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def codes(data: dict) -> list[str]:
    return [n["code"] for n in data["notices"]]


@pytest.mark.parametrize("when", ["2026-12-20T09:00:00", "2026-10-01T09:00:00"])
def test_out_of_validity_has_one_notice_a_nearby_day_and_no_calculation(when: str) -> None:
    data = plan(when)
    assert data["itineraries"] == []
    assert data["calculation"] is None
    assert codes(data) == ["out_of_validity", "not_realtime"]
    assert len(data["nearby"]) == 1
    assert "giorno feriale" in data["nearby"][0]["label"]


SUNDAY_6 = dict(when="2026-10-25T06:00:00", mode="walk", campus="palazzo_dossetti")
MODENA = {"station_id": "modena_fs"}


def test_no_service_explains_the_formula_once() -> None:
    data = plan(SUNDAY_6["when"], origin=MODENA, campus="palazzo_dossetti", mode="walk")
    assert data["itineraries"] == []
    assert data["calculation"] is None
    texts = [n["message"] for n in data["notices"]] + [n["label"] for n in data["nearby"]]
    assert sum(text.count("Calcolo:") for text in texts) == 1
    no_service = next(n for n in data["notices"] if n["code"] == "no_service")
    assert "lezione alle 06:00 − 10 min di anticipo − 19 min a piedi" in no_service["message"]


def test_first_train_after_that_still_beats_the_lesson_has_one_coherent_text() -> None:
    data = plan(SUNDAY_6["when"], origin=MODENA, campus="palazzo_dossetti", mode="walk")
    after = next(n for n in data["nearby"] if n["kind"] == "next")
    assert after["itinerary"]["slack_min"] == 4
    assert after["label"] == (
        "Primo treno dopo: arrivi in sede 4 min prima dell'inizio della lezione, "
        "meno dei 10 min di anticipo che hai scelto."
    )
    assert "-" not in after["label"]


def test_results_on_a_sunday_carry_a_festive_note() -> None:
    data = plan("2026-10-25T08:30:00")
    assert data["itineraries"]
    festive = next(n for n in data["notices"] if n["code"] == "festive_day")
    assert festive["level"] == "info"
    assert festive["message"] == (
        "Dom 25 ott 2026: orario festivo, servizio ridotto. Valgono solo le corse che il "
        "PDF Trenitalia indica per i festivi (non quelle con ⚒, solo giorni lavorativi). "
        "Verifica su Trenitalia prima di partire."
    )
    assert data["calculation"] is not None


def test_weekday_holiday_is_festive_and_named() -> None:
    data = plan("2026-12-08T08:30:00")
    festive = next(n for n in data["notices"] if n["code"] == "festive_day")
    assert festive["message"].startswith(
        "Mar 8 dic 2026 è festivo (Immacolata Concezione): orario festivo, servizio ridotto."
    )


def test_working_day_has_no_festive_note() -> None:
    assert "festive_day" not in codes(plan("2026-10-26T08:30:00"))


def test_same_city_from_the_station_names_the_station() -> None:
    data = plan("2026-10-26T09:00:00", origin=MODENA)
    same_city = next(n for n in data["notices"] if n["code"] == "same_city")
    assert same_city["message"].startswith(
        "Stazione di Modena FS e sede sono nella stessa città (Modena)"
    )


def test_same_city_from_home_still_says_home() -> None:
    data = plan("2026-10-26T09:00:00", origin={"lat": 44.6440, "lon": 10.9300})
    same_city = next(n for n in data["notices"] if n["code"] == "same_city")
    assert same_city["message"].startswith("Casa e sede sono nella stessa città (Modena)")


def test_dates_in_messages_use_the_short_italian_format() -> None:
    data = plan("2026-12-20T09:00:00")
    validity = data["notices"][0]["message"]
    assert validity.startswith("Dom 20 dic 2026 è dopo la fine di validità")
    assert "dal sab 17 ott 2026 al sab 12 dic 2026" in validity
    assert data["nearby"][0]["label"] == (
        "Stessa ora di lezione, sab 12 dic 2026 (giorno feriale precedente)."
    )
