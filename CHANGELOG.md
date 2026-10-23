# Changelog

All notable changes to UnimoreGo. Format inspired by [Keep a Changelog](https://keepachangelog.com/);
versions follow the API version reported by `GET /api/health`.

## [0.5.0] — 2026-10-23 · tag `v0.5-review`

Commuter review, round 2 (`P6_followup.txt`). The per-item status (done / partial / not done, with reasons) and the measurements are in [`docs/review-phase5.md`](docs/review-phase5.md#round-2--v05-v05-review).

### Fixed
- **Sundays and holidays (A1, B1).** Quadri 1–2 of the PDF have no day symbols, so the Phase 1 "Mon–Fri" default dropped every Sunday/holiday train. Runs are now extracted for every day, with their calendar notes. Sun 25/10, Modena FS → Palazzo Dossetti, 09:00 now gets RV 3902 (leave at 07:55).
- **Arrive-by alternatives (A1, C4).** There are no more evening trains for a morning lesson. Alternatives are the same lesson time on the previous/next working day, or a same-day train at most 60 min late; itineraries arrive at most 120 min before the lesson.
- **Duplicate warnings (B4).** `engine/notices.py` gives every notice a priority and merges related ones: out of validity > no service > calendar note > home far/unknown > festive > same city > estimate > not real time. The UI shows one primary alert.
- **Nominatim ranking (A4).** Results are re-ranked by the typed street words.
- **`scripts/smoke.sh` (A6).** Sends the v0.5 body, asserts the answers and exits non-zero on the first mismatch.
- **Campus combobox (B5).** Shows all campuses on focus, even with a value selected.
- **Accessibility.** The brand link's accessible name now contains its visible text; there is no duplicate real-time landmark when the outbound and return results are both shown.
- **Lighthouse CLS 0.289 → 0.** The loading skeleton now reserves the form height, so the result no longer jumps; Performance went from 75–79 to 93–95.

### Added
- **Data.** 402 runs extracted from the Trenitalia PDF by `tools/trenitalia_pdf.py`, plus **Rubiera** (OSM node 13769327683), all cited in `data/SOURCES.md`. All 400 calendar notes are interpretable, and `validate_data` rejects uninterpretable ones.
- **API.**
  - The response adds `notices[]` (code, level, message), `calculation` (station, time, summary) and itinerary `duration_min` / `changes`.
  - `nearby[]` entries carry a `label`.
  - `warnings` is kept for v0.4 clients.
- **Web:**
  - Plans on demand only (Calcola, or a complete shared link). Campus, station, mode and margin are remembered; the date is today, labelled "Oggi" (B2).
  - Search state in the URL (`sede`, `stazione` / `partenza=casa`, `data`, `ora`, `mezzo`, `verso`, `ritorno`), with Back/Forward/Reload, "Copia link" and "Condividi" (Web Share with a copy fallback) (B3).
  - Shows the deadline arithmetic: "lezione − anticipo − ultimo tratto = arrivo in stazione entro HH:MM" (B1).
  - Map under the result with auto-zoom, labelled markers, a solid train line, dashed walk/bike legs and a legend (B6).
  - Lists the covered stations on the home page (C1).
  - Real-time box with the train number, "Copia numero", and ViaggiaTreno / Trenitalia infomobilità links, plus a "non in tempo reale" note (C2).
  - "Calcola il ritorno" for an outbound + return view (C3).
  - Door-to-door duration and changes, with accessible "?" toggletips (C5).
  - "Aggiungi al calendario" (.ics) (C6).
  - A 24-hour time select (A3).
- **E2E.** `scripts/e2e_ui.py` adds 4 flows (39 checks), mobile 375×667 / 414×896 (22 checks) and axe-core on 7 states; options `--only` and `--screenshot`.

### Changed
- Layout order is form → result → map → schedule; on mobile the page scrolls to the result after Calcola.
- API, package and fixtures are at version 0.5.0.

### Verified
- pytest: 249 passed, 99 % coverage.
- vitest: 159 tests.
- E2E: 8/8 cases, 4/4 flows, 2/2 mobile, axe 0 violations.
- Lighthouse mobile: 93/95/94 · 100 · 100.
- Docker compose: healthy, smoke test passed against the container (A7).

### Not done
- Street-routed map lines (A5): this would need an external routing service called from the browser.
- A per-train ViaggiaTreno deep link: the URL format is not officially documented.
- `npm ci` in a second fresh clone ran out of sandbox memory (A8, partial).

## [0.4.0] — 2026-10-23 · tag `v0.4-review`

Commuter review (Phase 5). Details and measurements: [`docs/review-phase5.md`](docs/review-phase5.md).

### Added
- **Station time:** `station_buffer_min` (default 5, range 1–30) adds a `wait` leg before every train, so "Esci alle" never equals the train departure. UI field: "Tempo in stazione".
- **Train categories:** optional `train_categories` request field (`regional`, `intercity`, `high_speed`). Omitting it keeps the old behaviour (all categories). The UI defaults to "Solo regionali (R/RV)". Train details now carry `code`, `category_group`, `different_ticket` and `source` (PDF page), and IC/FR show the badge "Biglietto diverso / supplemento".
- **Calendar notes:** `engine/calendar_rules.py` interprets the common PDF notes (solo/escluso giorni, periodi, sospensioni, date, feriali, festivi). Italian national holidays live in `engine/holidays.py` and are combined in `engine/service_calendar.py`. Notes that cannot be interpreted add a warning that cites the PDF page.
- **Home origin:** home from an address (`GET /api/geocode`, OpenStreetMap Nominatim, 1 req/s, cached) or a map tap, plus optional home→station minutes. A home in the same city as the campus means walk/bike only.
- **Return trip:** `depart_after` mode ("Ritorno · a che ora parto?"), a planner registered by name next to `arrive_by` and reusing the same leg strategies.
- **Robustness:** when no train is useful, the response has a clear Italian message plus `nearby` previous/next solutions. Dates after `data_valid_to` get an explicit warning (also shown in the form).
- **Web:**
  - Answer-first layout (result before the form on mobile).
  - Today as the default date.
  - Preferences saved in `localStorage` (`unimorego.planner.v1`).
  - Today's lesson prefilled from the weekly schedule; the schedule preview uses the user's own settings.
  - Route map with home picking; Leaflet loads lazily.
  - Compact alternatives, and cards for nearby solutions.
- `engine/validity.py` derives the timetable validity window from the data.
- `scripts/e2e_ui.py`: 8 browser cases for v0.4 (return trip, buffer, categories, same city).

### Changed
- `POST /api/plan` requires exactly one of `arrive_by` / `depart_after`. The response adds `planner`, `nearby`, the legs' `notes`, and the itineraries' `date`.
- No walk/bike/wait leg of 0 minutes is ever generated (and the UI filters them defensively).
- Home origin resolution was extracted into `OriginResolver`; itinerary assembly into `ItineraryBuilder`.
- Contrast fixes (no `text-slate-400` text), combobox keyboard behaviour, `fieldset` overflow fix, SVG app icon.
- Lighthouse mobile (production build): Performance 89 → 91–98 (6 runs, first-run variance), Accessibility 96 → 100, Best Practices 96 → 100.

### Fixed
- Map tiles rendered only in the centre (missing `invalidateSize`).
- Stale itinerary paired with new form values on the map while loading (duplicate React key).
- The weekly schedule preview was hard-coded to bike / 10 min margin.

## [0.3.0] — tag `v0.3-integration`

- Integrated `feat/api` (FastAPI) and `feat/web` (Next.js) on `main`. The web app uses the real API by default, with an explicit mock (`NEXT_PUBLIC_USE_MOCK=1`) generated from the API.
- `scripts/dev.sh`, `scripts/smoke.sh`, `scripts/e2e_ui.py`, Makefile, Docker files, CI.
