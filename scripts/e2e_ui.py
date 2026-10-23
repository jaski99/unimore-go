"""Browser end-to-end check: the UI shows the time returned by the API (v0.4).

Drives the real web app (default http://localhost:3000) against the real API,
captures every POST /api/plan the browser makes and asserts that the big
"Esci alle HH:MM" / "Parti alle HH:MM" heading equals itineraries[0].leave_at
of that response. Independently replays the same request body with urllib on
the same API URL. Each case uses a fresh browser context (empty localStorage).

Requires: pip install playwright && python -m playwright install chromium
Usage:    python scripts/e2e_ui.py [WEB_URL] [--screenshot PATH]
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from dataclasses import dataclass

from playwright.sync_api import Browser, Page, Response, expect, sync_playwright


@dataclass
class Case:
    label: str
    date: str
    time: str = "08:30"
    campus_query: str | None = None
    station: str | None = None
    mode: str | None = None  # "A piedi" | "In bici"
    home_minutes: int | None = None  # switches origin to "Da casa"
    margin: int | None = None
    buffer: int | None = None
    all_trains: bool = False  # untick "Solo regionali (R/RV)"
    return_trip: bool = False
    expect_leave: str | None = None  # exact expected time, when known
    expect_ticket_badge: bool | None = None
    expect_no_train: bool = False


CASES = [
    Case(
        "Reggio Emilia FS -> DIEF, lun 26/10/2026 08:30, bici, margine 10, 5 min in stazione",
        date="2026-10-26",
        expect_leave="07:39",
        expect_ticket_badge=False,
    ),
    Case(
        "Come sopra con 15 min in stazione",
        date="2026-10-26",
        buffer=15,
    ),
    Case(
        "Modena FS -> Palazzo Dossetti, mar 27/10/2026 14:00, a piedi",
        date="2026-10-27",
        time="14:00",
        campus_query="Dossetti",
        station="modena_fs",
        mode="A piedi",
    ),
    Case(
        "Casa (12 min) + Modena FS -> Campus San Lazzaro, gio 29/10/2026 09:00, bici",
        date="2026-10-29",
        time="09:00",
        campus_query="San Lazzaro",
        station="modena_fs",
        mode="In bici",
        home_minutes=12,
    ),
    Case(
        "Reggio Emilia FS -> Economia Marco Biagi, ven 30/10/2026 16:45, margine 15",
        date="2026-10-30",
        time="16:45",
        campus_query="Marco Biagi",
        margin=15,
    ),
    Case(
        "Ritorno: DIEF -> Reggio Emilia FS dopo lezione fino alle 13:00, lun 26/10/2026",
        date="2026-10-26",
        time="13:00",
        return_trip=True,
    ),
    Case(
        "Tutti i treni (anche IC/FR) Reggio Emilia FS -> DIEF, lun 26/10/2026 08:30",
        date="2026-10-26",
        all_trains=True,
    ),
    Case(
        "Stessa citta': Modena FS -> DIEF (Modena), solo bici, nessun treno",
        date="2026-10-26",
        station="modena_fs",
        expect_no_train=True,
    ),
]


def replay(url: str, body: str) -> dict:
    req = urllib.request.Request(
        url, data=body.encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.load(resp)


def fill_form(page: Page, case: Case) -> None:
    if case.return_trip:
        page.get_by_role("button", name=re.compile("^Ritorno")).click()
    if case.campus_query:
        combo = page.get_by_role("combobox", name=re.compile("Sede UNIMORE"))
        combo.click()
        combo.fill(case.campus_query)
        page.get_by_role("button", name=re.compile(case.campus_query)).first.click()
    page.locator("#lesson-date").fill(case.date)
    page.locator("#lesson-time").fill(case.time)
    if case.mode:
        page.get_by_role("button", name=case.mode, exact=True).click()
    if case.home_minutes is not None:
        page.get_by_role("button", name=re.compile("^(Da|A) casa$")).click()
        page.locator("#home-minutes").fill(str(case.home_minutes))
    if case.station:
        page.locator("#origin-station").select_option(case.station)
    if case.margin is not None:
        page.locator("#margin").fill(str(case.margin))
    if case.buffer is not None:
        page.locator("#station-buffer").fill(str(case.buffer))
    if case.all_trains:
        page.get_by_role("checkbox", name="Solo regionali (R/RV)").uncheck()


def run_case(browser: Browser, url: str, case: Case, screenshot: str | None) -> bool:
    context = browser.new_context(viewport={"width": 1366, "height": 1800}, locale="it-IT")
    page = context.new_page()
    errors: list[str] = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    last: dict = {}

    def on_response(resp: Response) -> None:
        if resp.url.endswith("/api/plan") and resp.request.method == "POST":
            last.update(
                url=resp.url, status=resp.status, body=resp.request.post_data, json=resp.json()
            )

    page.on("response", on_response)
    page.goto(url, wait_until="networkidle")
    fill_form(page, case)
    button = "Calcola quando partire" if case.return_trip else "Calcola quando uscire"
    last.clear()
    with page.expect_response(lambda r: r.url.endswith("/api/plan")):
        page.get_by_role("button", name=button).click()
    verb = "Parti" if case.return_trip else "Esci"
    heading = page.get_by_role("heading", name=re.compile(rf"^{verb} alle \d{{2}}:\d{{2}}$"))
    expect(heading).to_be_visible(timeout=15000)
    page.wait_for_timeout(200)

    data = last["json"]
    first = data["itineraries"][0]
    api_leave = first["leave_at"]
    ui_text = heading.inner_text().replace("\n", " ")
    replayed = replay(last["url"], last["body"])
    request = json.loads(last["body"])
    legs = first["legs"]
    trains = [leg for leg in legs if leg["train"]]
    # Headline badge refers to the first itinerary; alternatives carry their own flag.
    badge_visible = page.locator(".result-banner .ticket-badge").count() > 0
    alternatives_text = " ".join(page.locator(".result-card details summary").all_inner_texts())
    alt_different = any(
        leg["train"] and leg["train"]["different_ticket"]
        for option in data["itineraries"][1:]
        for leg in option["legs"]
    )
    checks = {
        "status 200": last["status"] == 200,
        "UI == API": ui_text == f"{verb} alle {api_leave}",
        "replay == API": replayed["itineraries"][0]["leave_at"] == api_leave,
        "no 0-min legs": all(leg["minutes"] > 0 for leg in legs),
        "leave != train departure": not trains or trains[0]["depart"] != api_leave,
        "planner": data["planner"] == ("depart_after" if case.return_trip else "arrive_by"),
        "categories": request["train_categories"]
        == (["regional", "intercity", "high_speed"] if case.all_trains else ["regional"]),
        "badge matches API": badge_visible
        == any(leg["train"]["different_ticket"] for leg in trains),
        "alternatives flag matches API": ("biglietto diverso" in alternatives_text)
        == alt_different,
    }
    if case.expect_leave:
        checks[f"leave {case.expect_leave}"] = api_leave == case.expect_leave
    if case.expect_ticket_badge is not None:
        checks["ticket badge"] = badge_visible == case.expect_ticket_badge
    if case.expect_no_train:
        checks["no train"] = not trains
    if case.buffer is not None:
        checks[f"buffer {case.buffer}"] = request["station_buffer_min"] == case.buffer
    if errors:
        checks["no console errors"] = False

    ok = all(checks.values())
    summary = [
        f"{leg['train'].get('code') or leg['train']['category']} {leg['train']['number']} "
        f"{leg['depart']}-{leg['arrive']}"
        for leg in trains
    ]
    print(f"[{'OK' if ok else 'FAIL'}] {case.label}")
    print(f"     request  {last['body']}")
    print(
        f"     API      leave_at={api_leave} arrive_at={first['arrive_at']} "
        f"slack={first['slack_min']} legs={[leg['type'] for leg in legs]} trains={summary}"
    )
    print(f"     UI       '{ui_text}'  badge={badge_visible} alt_different_ticket={alt_different}")
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        print(f"     failed checks: {failed}  console errors: {errors}")
    if screenshot:
        page.screenshot(path=screenshot, full_page=False)
    context.close()
    return ok


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("web_url", nargs="?", default="http://localhost:3000")
    parser.add_argument("--screenshot", default=None)
    args = parser.parse_args()

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        results = [
            run_case(browser, args.web_url, case, args.screenshot if index == 0 else None)
            for index, case in enumerate(CASES)
        ]
        browser.close()
    failures = results.count(False)
    print(
        f"E2E UI: {len(results) - failures}/{len(results)}", "PASSED" if not failures else "FAILED"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
