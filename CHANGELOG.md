# Changelog

All notable changes to UnimoreGo. Format inspired by [Keep a Changelog](https://keepachangelog.com/);
versions follow the API version reported by `GET /api/health`.

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
