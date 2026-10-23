"""Browser end-to-end check: the UI shows the leave-at time returned by the API.

Drives the real web app (default http://localhost:3000) against the real API,
captures every POST /api/plan the browser makes and asserts that the big
"Esci alle HH:MM" heading equals itineraries[0].leave_at of that response.
Independently replays the same request body with urllib on the same API URL.

Requires: pip install playwright && python -m playwright install chromium
Usage:    python scripts/e2e_ui.py [WEB_URL] [--screenshot PATH]
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from dataclasses import dataclass, field

from playwright.sync_api import Page, Response, expect, sync_playwright


@dataclass
class Case:
    label: str
    campus_query: str | None = None
    station: str | None = None
    date: str | None = None
    time: str | None = None
    mode: str | None = None  # "A piedi" | "In bici"
    origin: str | None = None  # "station" | "home"
    home_minutes: int | None = None
    margin_delta: int = 0  # arrow presses on the margin slider (+/-)
    captured: dict = field(default_factory=dict)


CASES = [
    Case("Reggio Emilia FS -> DIEF, lun 26/10/2026 08:30, bici, margine 10 (default)"),
    Case(
        "Modena FS -> Palazzo Dossetti, mar 27/10/2026 14:00, a piedi, margine 10",
        campus_query="Dossetti",
        station="modena_fs",
        date="2026-10-27",
        time="14:00",
        mode="A piedi",
    ),
    Case(
        "Reggio Emilia FS -> Giurisprudenza, mer 28/10/2026 10:15, a piedi, margine 5",
        campus_query="Giurisprudenza",
        station="reggio_fs",
        date="2026-10-28",
        time="10:15",
        mode="A piedi",
        margin_delta=-5,
    ),
    Case(
        "Casa (12 min) + Modena FS -> Campus San Lazzaro, gio 29/10/2026 09:00, bici",
        campus_query="San Lazzaro",
        station="modena_fs",
        date="2026-10-29",
        time="09:00",
        mode="In bici",
        origin="home",
        home_minutes=12,
    ),
    Case(
        "Reggio Emilia FS -> Economia Marco Biagi, ven 30/10/2026 16:45, bici, margine 15",
        campus_query="Marco Biagi",
        station="reggio_fs",
        date="2026-10-30",
        time="16:45",
        mode="In bici",
        margin_delta=5,
    ),
]


def replay(url: str, body: str) -> dict:
    req = urllib.request.Request(
        url, data=body.encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.load(resp)


def fill_form(page: Page, case: Case) -> None:
    if case.campus_query:
        combo = page.get_by_role("combobox", name=re.compile("Sede UNIMORE"))
        combo.click()
        combo.fill(case.campus_query)
        page.get_by_role("button", name=re.compile(case.campus_query)).first.click()
    if case.date:
        page.locator("#lesson-date").fill(case.date)
    if case.time:
        page.locator("#lesson-time").fill(case.time)
    if case.mode:
        page.get_by_role("button", name=case.mode, exact=True).click()
    if case.origin == "home":
        page.get_by_role("button", name="Da casa, fino alla stazione").click()
    elif case.origin == "station":
        page.get_by_role("button", name="Parto dalla stazione").click()
    if case.station:
        page.locator("#origin-station").select_option(case.station)
    if case.home_minutes is not None:
        page.locator("#home-minutes").fill(str(case.home_minutes))
    if case.margin_delta:
        slider = page.locator("#margin")
        slider.focus()
        key = "ArrowRight" if case.margin_delta > 0 else "ArrowLeft"
        for _ in range(abs(case.margin_delta)):
            slider.press(key)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("web_url", nargs="?", default="http://localhost:3000")
    parser.add_argument("--screenshot", default=None)
    args = parser.parse_args()

    failures = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1366, "height": 1800}, locale="it-IT")
        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        last: dict = {}

        def on_response(resp: Response) -> None:
            if resp.url.endswith("/api/plan") and resp.request.method == "POST":
                last.update(
                    url=resp.url,
                    status=resp.status,
                    body=resp.request.post_data,
                    json=resp.json(),
                    cors=resp.headers.get("access-control-allow-origin"),
                )

        page.on("response", on_response)
        page.goto(args.web_url, wait_until="networkidle")

        for index, case in enumerate(CASES):
            if index > 0:
                # Fresh page per case so no form state leaks between cases.
                last.clear()
                page.goto(args.web_url, wait_until="networkidle")
                fill_form(page, case)
                with page.expect_response(lambda r: r.url.endswith("/api/plan")):
                    page.get_by_role("button", name="Calcola quando uscire").click()
            heading = page.get_by_role("heading", name=re.compile(r"^Esci alle \d{2}:\d{2}$"))
            expect(heading).to_be_visible(timeout=15000)
            page.wait_for_timeout(200)
            data = last["json"]
            api_leave = data["itineraries"][0]["leave_at"] if data["itineraries"] else None
            ui_text = heading.inner_text().replace("\n", " ")
            replayed = replay(last["url"], last["body"])
            ok = (
                last["status"] == 200
                and ui_text == f"Esci alle {api_leave}"
                and replayed["itineraries"][0]["leave_at"] == api_leave
            )
            failures += 0 if ok else 1
            first = data["itineraries"][0]
            trains = [
                f"{leg['train']['category']} {leg['train']['number']} {leg['depart']}-{leg['arrive']}"
                for leg in first["legs"]
                if leg["train"]
            ]
            print(f"[{'OK' if ok else 'FAIL'}] {case.label}")
            print(f"     request  {last['url']}  {last['body']}")
            print(
                f"     API      leave_at={api_leave} arrive_at={first['arrive_at']} "
                f"slack={first['slack_min']} trains={trains} "
                f"(options: {[i['leave_at'] for i in data['itineraries']]})"
            )
            print(f"     UI       '{ui_text}'   CORS allow-origin={last['cors']}")
            if index == 0 and args.screenshot:
                page.screenshot(path=args.screenshot, full_page=False)

        if console_errors:
            print("Console errors:", *console_errors, sep="\n  ")
        browser.close()
    print("E2E UI:", "PASSED" if failures == 0 else f"{failures} FAILED")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
