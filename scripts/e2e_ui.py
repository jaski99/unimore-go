"""Browser end-to-end checks for the web app against the real API (v0.5).

1. Cases: the big "Esci alle HH:MM" / "Parti alle HH:MM" heading equals
   itineraries[0].leave_at of the POST /api/plan the browser made, and a
   replay of the same body with urllib gives the same answer.
2. Flows: no plan before "Calcola", search in the URL (reload, Back/Forward,
   shared link, Copia link), return trip, campus combobox, .ics download,
   labelled map, merged notices.
3. Mobile 375x667 and 414x896: result and map right under the button, no
   horizontal scroll (also with help bubbles open).
4. axe-core (web/node_modules/axe-core) on several states: 0 violations.

Each check uses a fresh browser context (empty localStorage).

Requires: pip install playwright && python -m playwright install chromium
Usage:    python scripts/e2e_ui.py [WEB_URL] [--screenshot PATH] [--only cases|flows|mobile|axe]
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import Browser, BrowserContext, Page, Response, expect, sync_playwright

AXE_JS = Path(__file__).resolve().parent.parent / "web/node_modules/axe-core/axe.min.js"
AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]
SHARED_QUERY = (
    "?sede=palazzo_dossetti&stazione=modena_fs&data=2026-10-25&ora=09%3A00&mezzo=piedi&verso=andata"
)


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


def set_lesson_time(page: Page, time: str) -> None:
    """The lesson time is a 24-hour pair of selects (hours #lesson-time, then minutes)."""
    hour, minute = time.split(":")
    page.locator("#lesson-time").select_option(hour)
    page.locator("#lesson-time ~ select").select_option(minute)


def fill_form(page: Page, case: Case) -> None:
    if case.return_trip:
        page.get_by_role("button", name=re.compile("^Ritorno")).click()
    if case.campus_query:
        combo = page.get_by_role("combobox", name=re.compile("Sede UNIMORE"))
        combo.click()
        combo.fill(case.campus_query)
        page.get_by_role("option", name=re.compile(case.campus_query)).first.click()
    page.locator("#lesson-date").fill(case.date)
    set_lesson_time(page, case.time)
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

    plans_before: list[str] = []
    page.on(
        "request", lambda r: plans_before.append(r.url) if r.url.endswith("/api/plan") else None
    )
    page.on("response", on_response)
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(300)
    no_plan_on_open = not plans_before
    fill_form(page, case)
    button = "Calcola quando partire" if case.return_trip else "Calcola quando uscire"
    last.clear()
    with page.expect_response(lambda r: r.url.endswith("/api/plan")):
        page.get_by_role("button", name=button).click()
    verb = "Parti" if case.return_trip else "Esci"
    heading = page.get_by_role(
        "heading", level=2, name=re.compile(rf"^{verb} alle \d{{2}}:\d{{2}}$")
    )
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
    alternatives_text = " ".join(
        page.locator("#result .result-card details summary").all_inner_texts()
    )
    alt_different = any(
        leg["train"] and leg["train"]["different_ticket"]
        for option in data["itineraries"][1:]
        for leg in option["legs"]
    )
    checks = {
        "no plan before Calcola": no_plan_on_open,
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


# ---------------------------------------------------------------- flows


def new_page(browser: Browser, **options) -> tuple[BrowserContext, Page, list[str]]:
    context = browser.new_context(
        locale="it-IT", viewport=options.pop("viewport", {"width": 1366, "height": 1000}), **options
    )
    page = context.new_page()
    errors: list[str] = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    return context, page, errors


def calculate(page: Page, verb: str = "Esci") -> str:
    """Click the main button and return the leave time of the level-2 heading."""
    button = "Calcola quando partire" if verb == "Parti" else "Calcola quando uscire"
    with page.expect_response(lambda r: r.url.endswith("/api/plan")):
        page.get_by_role("button", name=button).click()
    heading = page.get_by_role("heading", level=2, name=re.compile(rf"^{verb} alle \d\d:\d\d$"))
    expect(heading).to_be_visible(timeout=15000)
    return heading.inner_text().split()[-1]


def map_labels(page: Page) -> list[str]:
    """Permanent marker labels currently on the map (sorted)."""
    page.locator("#map").scroll_into_view_if_needed()
    page.wait_for_selector(".leaflet-tooltip.map-label", timeout=15000)
    page.wait_for_timeout(800)
    return sorted(page.locator(".leaflet-tooltip.map-label").all_inner_texts())


def labels_overlap(page: Page) -> bool:
    boxes = [tip.bounding_box() for tip in page.locator(".leaflet-tooltip.map-label").all()]
    boxes = [box for box in boxes if box]
    for index, a in enumerate(boxes):
        for b in boxes[index + 1 :]:
            if (
                a["x"] < b["x"] + b["width"]
                and b["x"] < a["x"] + a["width"]
                and a["y"] < b["y"] + b["height"]
                and b["y"] < a["y"] + a["height"]
            ):
                return True
    return False


def plan_requests(page: Page) -> list[dict]:
    seen: list[dict] = []
    page.on(
        "request",
        lambda r: (
            seen.append(json.loads(r.post_data or "{}"))
            if r.url.endswith("/api/plan") and r.method == "POST"
            else None
        ),
    )
    return seen


def flow_on_demand_and_history(browser: Browser, url: str) -> dict[str, bool]:
    """B2 + B3: nothing until Calcola; URL search survives reload and Back/Forward."""
    context, page, errors = new_page(browser)
    plans = plan_requests(page)
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1500)
    checks = {
        "no plan on open": not plans,
        "placeholder on open": page.get_by_text("Il tuo tragitto, senza corse").is_visible(),
        "date says Oggi": page.locator(".today-badge").inner_text().strip().lower() == "oggi",
    }
    page.locator("#lesson-date").fill("2026-10-26")
    first = calculate(page)
    checks["URL has the search"] = "sede=dief" in page.url and "data=2026-10-26" in page.url
    first_url = page.url
    page.reload(wait_until="networkidle")
    heading = page.get_by_role("heading", level=2, name=f"Esci alle {first}")
    expect(heading).to_be_visible(timeout=15000)
    checks["reload re-plans the same search"] = page.url == first_url
    page.get_by_role("button", name="A piedi", exact=True).click()
    walk = calculate(page)
    checks["new search pushed"] = "mezzo=piedi" in page.url
    page.go_back()
    expect(page.get_by_role("heading", level=2, name=f"Esci alle {first}")).to_be_visible()
    checks["Back restores bike search"] = (
        "mezzo=bici" in page.url
        and page.get_by_role("button", name="In bici", exact=True).get_attribute("aria-pressed")
        == "true"
    )
    page.go_forward()
    expect(page.get_by_role("heading", level=2, name=f"Esci alle {walk}")).to_be_visible()
    checks["Forward restores walk search"] = "mezzo=piedi" in page.url
    checks["no console errors"] = not errors
    context.close()
    return checks


def flow_shared_link_b1(browser: Browser, url: str) -> dict[str, bool]:
    """B1 + B3: a shared link plans at once; Sunday 25/10 shows the arithmetic; Copia link."""
    context, page, errors = new_page(browser, permissions=["clipboard-read", "clipboard-write"])
    page.goto(url + SHARED_QUERY, wait_until="networkidle")
    heading = page.get_by_role("heading", level=2, name=re.compile(r"^Esci alle \d\d:\d\d$"))
    expect(heading).to_be_visible(timeout=15000)
    note = page.get_by_role("note", name=re.compile("Come abbiamo calcolato")).inner_text()
    checks = {
        "link plans at once": heading.inner_text() == "Esci alle 07:55",
        "station deadline 08:31": "entro le 08:31" in note,
        "arithmetic shown": "lezione alle 09:00 − 10 min di anticipo − 19 min a piedi" in note,
        "train RV 3902": "RV 3902" in page.locator(".result-banner").inner_text(),
        "link does not overwrite preferences": page.evaluate(
            "localStorage.getItem('unimorego.planner.v1')"
        )
        is None,
    }
    page.get_by_role("button", name="Copia link").click()
    expect(page.get_by_text("Link copiato negli appunti.")).to_be_visible()
    checks["clipboard == page URL"] = page.evaluate("navigator.clipboard.readText()") == page.url
    checks["realtime link"] = (
        page.get_by_role("link", name=re.compile("ViaggiaTreno")).get_attribute("href")
        == "http://www.viaggiatreno.it/infomobilita/index.jsp"
    )
    checks["no console errors"] = not errors
    context.close()
    return checks


def flow_return_trip_and_ics(browser: Browser, url: str) -> dict[str, bool]:
    """C3 + C6: return with the same settings; .ics for "Esci alle"."""
    context, page, errors = new_page(browser)
    plans = plan_requests(page)
    page.goto(url, wait_until="networkidle")
    page.locator("#lesson-date").fill("2026-10-26")
    calculate(page)
    box = page.get_by_role("region", name="E per tornare?")
    box.get_by_role("combobox", name="Ore").select_option("13")
    box.get_by_role("combobox", name="Minuti").select_option("00")
    box.get_by_role("button", name="Calcola il ritorno").click()
    back = box.get_by_role("heading", level=3, name=re.compile(r"^Parti alle"))
    expect(back).to_be_visible(timeout=15000)
    checks = {
        "return leave 13:33": back.inner_text() == "Parti alle 13:33",
        "return request same settings": plans[-1]
        .get("depart_after", "")
        .startswith("2026-10-26T13:00")
        and plans[-1]["campus_id"] == plans[0]["campus_id"]
        and plans[-1]["origin"] == plans[0]["origin"]
        and plans[-1]["mode"] == plans[0]["mode"],
        "URL has ritorno": "ritorno=13%3A00" in page.url,
        "outbound still shown": page.get_by_role(
            "heading", level=2, name="Esci alle 07:39"
        ).is_visible(),
    }
    # Round 3, B1: the map draws the return, and follows the Andata/Ritorno switch.
    checks["map shows the return"] = map_labels(page) == [
        "Sede · DIEF",
        "Stazione arrivo · Reggio Emilia FS",
        "Stazione partenza · Modena FS",
    ]
    switch = page.get_by_role("group", name="Percorso sulla mappa")
    switch.get_by_role("button", name="Andata").click()
    checks["switch to outbound"] = map_labels(page) == [
        "Sede · DIEF",
        "Stazione arrivo · Modena FS",
        "Stazione partenza · Reggio Emilia FS",
    ]
    switch.get_by_role("button", name="Ritorno").click()
    checks["switch back to return"] = "Stazione partenza · Modena FS" in map_labels(page)
    with page.expect_download() as download_info:
        page.locator("#result .result-actions").first.get_by_role(
            "button", name="Aggiungi al calendario"
        ).click()
    download = download_info.value
    text = Path(download.path()).read_bytes().decode("utf-8")  # keep CRLF
    checks["ics name"] = download.suggested_filename == "unimorego-2026-10-26-0739.ics"
    checks["ics times UTC"] = (
        "DTSTART:20261026T063900Z" in text and "DTEND:20261026T071800Z" in text
    )
    checks["ics summary"] = "SUMMARY:Esci alle 07:39 · RV 3907 → DIEF" in text
    checks["ics CRLF + alarm"] = "\r\n" in text and "TRIGGER:-PT10M" in text
    page.reload(wait_until="networkidle")
    expect(page.get_by_role("heading", level=3, name="Parti alle 13:33")).to_be_visible(
        timeout=15000
    )
    checks["reload restores outbound+return"] = page.get_by_role(
        "heading", level=2, name="Esci alle 07:39"
    ).is_visible()
    checks["no console errors"] = not errors
    context.close()
    return checks


def flow_combobox_map_notices(browser: Browser, url: str) -> dict[str, bool]:
    """B5 combobox, B6 labelled map, B4 one merged notice on 20/12."""
    context, page, errors = new_page(browser)
    page.goto(url, wait_until="networkidle")
    combo = page.get_by_role("combobox", name="Sede UNIMORE")
    label = combo.input_value()
    combo.click()
    listbox = page.get_by_role("listbox", name="Sedi UNIMORE")
    campuses = json.load(urllib.request.urlopen(url.rstrip("/") + "/api/campuses", timeout=10))
    checks = {
        "combobox shows all on focus": listbox.get_by_role("option").count() == len(campuses),
        "combobox keeps the value": combo.input_value() == label and bool(label),
    }
    page.keyboard.type("Biagi")
    checks["typing filters"] = listbox.get_by_role("option").count() == 1
    page.keyboard.press("Escape")
    checks["Esc restores label"] = combo.input_value() == label

    page.locator("#lesson-date").fill("2026-10-26")
    calculate(page)
    labels = map_labels(page)
    checks["map labels"] = labels == [
        "Sede · DIEF",
        "Stazione arrivo · Modena FS",
        "Stazione partenza · Reggio Emilia FS",
    ]
    map_box = page.locator(".map-frame").bounding_box()
    checks["map labels not clipped"] = all(
        box
        and box["x"] >= map_box["x"]
        and box["x"] + box["width"] <= map_box["x"] + map_box["width"]
        for box in (tip.bounding_box() for tip in page.locator(".leaflet-tooltip.map-label").all())
    )
    # Round 3, B5: legend only for what is drawn; labels never cover each other.
    legend = page.get_by_role("list", name="Legenda della mappa").inner_text()
    checks["legend without Casa (from station)"] = "Casa" not in legend and "Sede" in legend
    checks["map labels do not overlap"] = not labels_overlap(page)
    checks["train solid + walk/bike dashed"] = (
        page.locator('path[stroke="#126e5b"][stroke-width="5"]:not([stroke-dasharray])').count()
        == 1
        and page.locator("path[stroke-dasharray]").count() == 1
    )
    frame = page.locator(".map-frame").bounding_box()
    inside = True
    for marker in page.locator("path.leaflet-interactive[fill-opacity]").all():
        box = marker.bounding_box()
        inside &= bool(
            box
            and box["x"] >= frame["x"]
            and box["y"] >= frame["y"]
            and box["x"] + box["width"] <= frame["x"] + frame["width"]
            and box["y"] + box["height"] <= frame["y"] + frame["height"]
        )
    checks["auto-zoom keeps markers in view"] = inside
    checks["map beside result (desktop)"] = (
        page.locator("#map").bounding_box()["x"] == page.locator("#result").bounding_box()["x"]
    )

    page.locator("#lesson-date").fill("2026-12-20")
    page.get_by_role("button", name="Calcola quando uscire").click()
    expect(page.get_by_role("heading", level=2, name="Nessun treno utile")).to_be_visible(
        timeout=15000
    )
    alerts = page.locator("#result [role=alert]").all_inner_texts()
    checks["20/12: one merged alert"] = len(alerts) == 1 and "validità" in alerts[0]
    result_text = page.locator("#result").inner_text()
    checks["20/12: Saturday 12/12 proposed"] = "sab 12 dic 2026" in result_text.lower()
    # Round 3, B2: no calculation box without a result for that date.
    checks["20/12: no calculation box"] = (
        page.locator("#result [role=note]", has_text="Come abbiamo calcolato").count() == 0
        and "entro le" not in result_text
    )
    checks["no console errors"] = not errors
    context.close()
    return checks


def flow_round3_texts(browser: Browser, url: str) -> dict[str, bool]:
    """Round 3: B3 formula once, B4 one late text, point 9 festive note, B6 origin name."""
    context, page, errors = new_page(browser)
    base = url.rstrip("/")

    def open_link(query: str, heading: re.Pattern[str] | str) -> str:
        page.goto(f"{base}/?{query}", wait_until="networkidle")
        expect(page.get_by_role("heading", level=2, name=heading)).to_be_visible(timeout=15000)
        return page.locator("#result").inner_text()

    sunday_dawn = open_link(
        "sede=palazzo_dossetti&stazione=modena_fs&data=2026-10-25&ora=06%3A00&mezzo=piedi&verso=andata",
        "Nessun treno utile",
    )
    checks = {
        "Sun 06:00: formula once": sunday_dawn.count("lezione alle 06:00 − 10 min di anticipo")
        == 1,
        "Sun 06:00: no calculation box": page.locator(
            "#result [role=note]", has_text="Come abbiamo calcolato"
        ).count()
        == 0,
        "Sun 06:00: coherent late text": "arrivi in sede 4 min prima dell’inizio"
        in sunday_dawn.replace("'", "’")
        and "meno dei 10 min di anticipo che hai scelto" in sunday_dawn
        and "ritardo" not in sunday_dawn,
    }
    sunday = open_link(
        "sede=dief&stazione=reggio_fs&data=2026-10-25&ora=08%3A30&mezzo=bici&verso=andata",
        re.compile(r"^Esci alle"),
    )
    checks["Sun 25/10 with result: festive note"] = (
        "orario festivo, servizio ridotto" in sunday and "Verifica su Trenitalia" in sunday
    )
    monday = open_link(
        "sede=dief&stazione=reggio_fs&data=2026-10-26&ora=08%3A30&mezzo=bici&verso=andata",
        re.compile(r"^Esci alle"),
    )
    checks["Mon 26/10: no festive note"] = "orario festivo" not in monday
    same_city = open_link(
        "sede=economia_biagi&stazione=modena_fs&data=2026-10-26&ora=09%3A00&mezzo=piedi&verso=andata",
        re.compile(r"^Esci alle"),
    )
    checks["same city names the station"] = (
        "Stazione di Modena FS e sede" in same_city and "Casa e sede" not in same_city
    )
    checks["no console errors"] = not errors
    context.close()
    return checks


FLOWS: list[Callable[[Browser, str], dict[str, bool]]] = [
    flow_on_demand_and_history,
    flow_shared_link_b1,
    flow_return_trip_and_ics,
    flow_combobox_map_notices,
    flow_round3_texts,
]

# ---------------------------------------------------------------- mobile

MOBILE_VIEWPORTS = [(375, 667), (414, 896)]


def no_horizontal_scroll(page: Page) -> bool:
    return page.evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth"
        " && document.body.scrollWidth <= window.innerWidth"
    )


def mobile_check(
    browser: Browser, url: str, width: int, height: int, shot: str | None
) -> dict[str, bool]:
    context, page, errors = new_page(
        browser,
        viewport={"width": width, "height": height},
        is_mobile=True,
        has_touch=True,
        device_scale_factor=2,
    )
    page.goto(url, wait_until="networkidle")
    checks = {"no h-scroll on open": no_horizontal_scroll(page)}
    page.locator("#lesson-date").fill("2026-10-26")
    page.get_by_role("button", name="Anticipo a lezione".join(["Che cos’è: ", ""])).tap()
    bubble = page.locator(".help-tip-bubble:not([hidden])").bounding_box()
    checks["form help bubble on screen"] = (
        bool(bubble) and bubble["x"] >= 0 and (bubble["x"] + bubble["width"] <= width)
    )
    checks["no h-scroll with form help"] = no_horizontal_scroll(page)
    page.keyboard.press("Escape")
    button = page.get_by_role("button", name="Calcola quando uscire")
    # Point 11: with the form in view, Calcola is on screen without scrolling to its end.
    page.evaluate("window.scrollTo(0, 0)")
    page.locator("#plan-form").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    box = button.bounding_box()
    checks["Calcola sticky on screen"] = (
        bool(box) and 0 <= box["y"] and (box["y"] + box["height"] <= height)
    )
    with page.expect_response(lambda r: r.url.endswith("/api/plan")):
        button.tap()
    heading = page.get_by_role("heading", level=2, name=re.compile(r"^Esci alle"))
    expect(heading).to_be_visible(timeout=15000)
    page.wait_for_timeout(1300)  # smooth scroll to the result
    head_box = heading.bounding_box()
    form_box = page.locator("#plan-form").bounding_box()
    result_box = page.locator("#result").bounding_box()
    map_box = page.locator("#map").bounding_box()
    checks["result scrolled into view"] = 0 <= head_box["y"] < height * 0.5
    checks["focus on result title"] = page.evaluate("document.activeElement?.id") == "result-title"
    checks["result right under the form"] = (
        0 <= result_box["y"] - (form_box["y"] + form_box["height"]) <= 40
    )
    checks["map right under the result"] = (
        0 <= map_box["y"] - (result_box["y"] + result_box["height"]) <= 40
    )
    checks["no h-scroll with result"] = no_horizontal_scroll(page)
    page.get_by_role("button", name="Che cos’è: Anticipo", exact=True).tap()
    bubble = page.locator(".help-tip-bubble:not([hidden])").bounding_box()
    checks["result help bubble on screen"] = (
        bool(bubble) and bubble["x"] >= 0 and (bubble["x"] + bubble["width"] <= width)
    )
    checks["no h-scroll with result help"] = no_horizontal_scroll(page)
    page.keyboard.press("Escape")
    page.locator("#map").scroll_into_view_if_needed()
    page.wait_for_selector(".leaflet-tooltip.map-label", timeout=15000)
    checks["no h-scroll with map"] = no_horizontal_scroll(page)
    if shot:
        page.evaluate("document.getElementById('result').scrollIntoView()")
        page.wait_for_timeout(300)
        page.screenshot(path=shot.replace(".png", f"-{width}x{height}.png"))
    checks["no console errors"] = not errors
    context.close()
    return checks


# ---------------------------------------------------------------- axe


def axe(page: Page) -> list[dict]:
    page.add_script_tag(path=str(AXE_JS))
    result = page.evaluate(
        "tags => axe.run(document, { runOnly: { type: 'tag', values: tags } })", AXE_TAGS
    )
    return result["violations"]


def axe_states(browser: Browser, url: str) -> dict[str, bool]:
    checks: dict[str, bool] = {}

    def record(name: str, page: Page) -> None:
        violations = axe(page)
        checks[name] = not violations
        for violation in violations:
            nodes = [node["target"] for node in violation["nodes"]][:3]
            print(f"     axe {name}: {violation['id']} ({violation['impact']}) {nodes}")

    for label, viewport in (
        ("desktop", {"width": 1366, "height": 1000}),
        ("mobile", {"width": 375, "height": 667}),
    ):
        context, page, _ = new_page(browser, viewport=viewport)
        page.goto(url, wait_until="networkidle")
        record(f"{label} open", page)
        page.get_by_role("combobox", name="Sede UNIMORE").click()
        record(f"{label} combobox open", page)
        page.keyboard.press("Escape")
        page.locator("#lesson-date").fill("2026-10-26")
        calculate(page)
        page.get_by_role("region", name="E per tornare?").get_by_role(
            "button", name="Calcola il ritorno"
        ).click()
        expect(page.get_by_role("heading", level=3, name=re.compile("^Parti alle"))).to_be_visible(
            timeout=15000
        )
        for summary in page.locator("#result details summary").all():
            summary.click()
        page.get_by_role("button", name="Che cos’è: Anticipo", exact=True).first.click()
        page.locator("#map").scroll_into_view_if_needed()
        page.wait_for_timeout(800)
        record(f"{label} outbound+return, details and help open", page)
        context.close()

    context, page, _ = new_page(browser)
    page.goto(url, wait_until="networkidle")
    page.get_by_role("button", name="Da casa").click()
    page.locator("#lesson-date").fill("2026-12-20")
    page.locator("#home-minutes").fill("10")
    page.get_by_role("button", name="Calcola quando uscire").click()
    expect(page.get_by_role("heading", level=2, name="Nessun treno utile")).to_be_visible(
        timeout=15000
    )
    record("home origin, no train, out of validity", page)
    context.close()
    return checks


def report(label: str, checks: dict[str, bool]) -> bool:
    ok = all(checks.values())
    print(f"[{'OK' if ok else 'FAIL'}] {label}: {sum(checks.values())}/{len(checks)} checks")
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        print(f"     failed checks: {failed}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("web_url", nargs="?", default="http://localhost:3000")
    parser.add_argument("--screenshot", default=None)
    parser.add_argument("--only", choices=["cases", "flows", "mobile", "axe"], default=None)
    args = parser.parse_args()
    url = args.web_url

    def want(part: str) -> bool:
        return args.only in (None, part)

    totals: dict[str, list[bool]] = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        if want("cases"):
            totals["cases"] = [
                run_case(browser, url, case, args.screenshot if index == 0 else None)
                for index, case in enumerate(CASES)
            ]
        if want("flows"):
            totals["flows"] = [
                report(flow.__doc__.split(":")[0].strip(), flow(browser, url)) for flow in FLOWS
            ]
        if want("mobile"):
            totals["mobile"] = [
                report(f"mobile {w}x{h}", mobile_check(browser, url, w, h, args.screenshot))
                for w, h in MOBILE_VIEWPORTS
            ]
        if want("axe"):
            totals["axe"] = [report("axe-core", axe_states(browser, url))]
        browser.close()
    failures = 0
    for part, results in totals.items():
        failed = results.count(False)
        failures += failed
        print(
            f"E2E {part}: {len(results) - failed}/{len(results)}",
            "PASSED" if not failed else "FAILED",
        )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
