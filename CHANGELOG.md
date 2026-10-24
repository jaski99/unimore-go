# Changelog

All notable changes to UnimoreGo. Format inspired by [Keep a Changelog](https://keepachangelog.com/);
versions follow the API version reported by `GET /api/health`.

## [0.7.0] — 2026-10-24 · tag `v0.7-final`

Final polish, round 4 (`P8_followup.txt`). Per-point status and measurements: [`docs/review-phase5.md`](docs/review-phase5.md#round-4--v07-v07-final).

### Changed
- **Durations (point 1).** Over 59 minutes every duration reads "4 h 32 min" (exactly 60: "1 h"), in API texts (`engine/durations.py`, `format_minutes`) and in the web app (`formatDuration`), with the same test table (0, 59, 60, 61, 272). The "late" wording follows suit: "meno dei 10 min" under an hour, "meno di 1 h" from 60.
- **Campus field (point 6).** Once chosen it shows the short name, "DIEF · Modena"; the full name stays in the list, the `title` tooltip and the screen-reader description.
- **Return label (point 7).** "Tempo per uscire dall'aula" is now "Minuti per lasciare la sede dopo la lezione", with a one-line toggletip.
- **Return links (point 5).** `verso=ritorno` without `ritorno=` proposes the lesson end (start + 2 h), plans at once and shows "Proposta: inizio lezione + 2 ore (HH:MM)…". `ora` is always the lesson start and `ritorno` always the lesson end; return searches are written `verso=ritorno&ritorno=HH:MM`. **Behaviour change:** an old v0.6 `verso=ritorno&ora=13:00` link now reads 13:00 as the lesson start and proposes 15:00.
- **Map labels (point 8).** Labels are placed in screen pixels after every zoom/move (`lib/label-layout.ts`): each takes the first free side (above, below, right, left) that covers no other label or marker, otherwise it becomes a hover/tap tooltip. Markers are painted largest first, so a station marker is never hidden under the campus or home marker (Reggio: Palazzo Dossetti and Reggio Emilia FS are about 600 m apart, about 4 px at low mobile zoom).

### Added
- **Bike suggestion (point 2).** In the same city, a walk over 20 min adds `suggestion` to the answer, e.g. Modena FS → DIEF "In bici circa 22 min (a piedi 53 min)." (OSRM distance at 15 km/h), with a "Usa la bici" button that re-plans by bike.
- **Festive label (point 4).** On Sundays and holidays, a train run whose festive service is not verified in the data (no †/Ⓑ/Ⓒ day symbol and no note naming the day) has `train.festive_unverified = true` and the label "Circolazione nei festivi da verificare" next to it, on top of the general notice. Tested on the engine rule and on the API mapper.
- **Mobile auto-scroll (point 9).** After Calcola the page scrolls to the result: smooth, or instant with `prefers-reduced-motion` (the CSS `scroll-behavior: smooth` on `<html>` is also turned off then).
- **E2E.** A round-4 flow (16 checks), an iPhone 12 and Pixel 7 matrix (outbound, return, no train, out of validity: 22 checks per device, including reduced motion and no horizontal scroll, with `--shots-dir` screenshots), and three new axe states (bike suggestion, festive label, proposed end).

### Fixed
- **"E per tornare?" (point 3)** appears only under an outbound result with an itinerary, never with "Nessun treno utile" or out of validity.
- **Reduced motion.** `scrollIntoView({behavior: 'auto'})` still scrolled smoothly because of the CSS default; it now uses `'instant'`. Found by the new E2E check.

### Verified
- **Docker (point 10).** In the sandbox (Docker 26.1.5): `docker build -f Dockerfile.api` succeeds and the container's `/api/health` answers `"version":"0.7.0"`; `docker-compose up -d --build` brings the API to healthy and the web app answers 200.
- pytest 307 (coverage 99%), vitest 200, ruff, tsc, eslint, prettier, `next build`, smoke test, E2E (cases 8/8, flows 6/6, mobile 4/4, axe 10 states with 0 violations), Lighthouse mobile 96 / 100 / 100 (first attempt).

## [0.6.0] — 2026-10-24 · tag `v0.6-review`

Commuter review, round 3 (`P7_followup.txt`). Per-point status, reasons and measurements: [`docs/review-phase5.md`](docs/review-phase5.md#round-3--v06-v06-review).

### Fixed
- **Sunday/holiday timetable (point 9).** The extractor ignored the day symbols that the PDF prints next to the times (LogoFS font; legend on file page 6), so every run ran daily and Sun 25/10 gave the same trains as Mon 26/10. Now 30 of 402 runs are day-restricted (19 ⚒ working days, 6 † holidays, 3 Ⓑ, 1 Ⓐ, 1 Ⓒ). The other 372 have no symbol and run daily per the PDF. Example: R 17405 07:33 Reggio Emilia → Modena no longer runs on Sundays.
- **Map after "Calcola il ritorno" (B1).** The map draws the return (sede → station → train → arrival station), and an Andata/Ritorno switch follows every change.
- **Calculation box without a result (B2, B3).** `calculation` is `null` when there is no itinerary for the date. The formula is written once, inside the no-service notice; out of validity, only that notice and the nearby-day solution remain.
- **"Primo treno dopo" (B4).** One coherent sentence: "arrivi in sede 4 min prima dell'inizio della lezione, meno dei 10 min di anticipo che hai scelto", or "arrivi in sede 7 min in ritardo". The slack is no longer repeated next to it.
- **Map legend and labels (B5).** The legend lists only the markers and line kinds drawn, so there is no "Casa" from a station. Labels sit above or below their marker, away from the nearest one, so Modena FS and DIEF never overlap.
- **Same city from a station (B6).** "Stazione di Modena FS e sede sono nella stessa città…" instead of "Casa e sede".
- **Return lesson end (B7).** The proposed end (start + 2 h) is announced as a proposal until the user changes it.
- **"Tempo dopo la lezione" (B8).** Renamed "Tempo per uscire dall'aula", with a toggletip.

### Added
- **Festive notice (point 9).** On every Sunday and national holiday, also with a result: "orario festivo, servizio ridotto … verifica su Trenitalia".
- **Campus field (point 10).** Selects all the text on focus (also on iOS) and shows the full campus name under the input.
- **Mobile (point 11).**
  - Sticky Calcola button while the form is in view.
  - After Calcola, scroll to the result and move focus to its title.
  - New E2E mobile checks for both.
- **Italian dates (point 13).** A single format, "lun 26 ott 2026": Intl it-IT in the web app and `format_it_day` in the API, tested against the same strings.
- **E2E.** A new round-3 flow (formula once, late text, festive note, origin name), plus checks on the return map, the legend, label overlap and the 20/12 case.

### Docs
- README IT/EN:
  - festive data (30/372);
  - straight-line map as a known limit (A5, point 14);
  - minimum memory from a single fresh clone (A8, point 15): `npm ci` peak 816 MB, `next build` 1340 MB, about 1.5 GB free RAM.
- No per-train ViaggiaTreno link (C2, point 12): there is no public, documented, stable URL, so the generic link stays.

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
