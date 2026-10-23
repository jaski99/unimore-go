# UnimoreGo

[![UnimoreGo CI](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml/badge.svg)](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 🇮🇹 [Italiano](#italiano) · 🇬🇧 [English](#english)

![UnimoreGo: risultato reale Reggio Emilia FS → DIEF, lunedì 26/10/2026, lezione 08:30, bici, margine 10, 5 min in stazione, solo regionali](docs/screenshot.png)

---

## Italiano

### Cos'è

**UnimoreGo** è una web app per studenti pendolari di **UNIMORE** che risponde a una domanda: *a che ora devo uscire di casa per arrivare a lezione?*
Scegli sede, giorno e ora della lezione, da dove parti e come ti muovi in città: l'app combina i treni **Modena FS ↔ Reggio Emilia FS** con il primo/ultimo tratto attivo e mostra **«Esci alle HH:MM»**, l'arrivo previsto, l'anticipo e fino a 3 alternative.

Opzioni (v0.4):

| Opzione | Default | Note |
|---|---|---|
| **Andata / Ritorno** | Andata | Andata: «a che ora esco?» (`arrive_by`, inizio lezione). Ritorno: «a che ora parto?» (`depart_after`, fine lezione → primo treno utile verso casa). |
| **Da dove parti** | Stazione | Stazione, oppure **casa** da indirizzo (ricerca OpenStreetMap/Nominatim), dalla tua posizione o da un tocco sulla mappa; minuti casa↔stazione facoltativi. |
| **A piedi / In bici** | In bici | Primo e ultimo tratto. |
| **Tempo in stazione** | 5 min | 1–30 min per biglietto e binario: «Esci alle» non coincide mai con la partenza del treno. |
| **Anticipo a lezione** | 10 min | 0–60 min (solo andata). |
| **Solo regionali (R/RV)** | attivo | Disattivandolo compaiono anche IC/FR con il badge **«Biglietto diverso / supplemento»**. |

Le scelte restano su questo dispositivo (`localStorage`, mai la data); l'orario settimanale precompila la lezione di oggi.

Regola di dominio: **mai il treno dentro la stessa città**. Casa (o stazione) e sede nella stessa città → solo piedi/bici.
Se non c'è un treno utile (notte, festivi, date fuori validità) l'app lo dice in italiano e propone la soluzione precedente/successiva.

Lo screenshot qui sopra mostra un risultato reale dell'API: Reggio Emilia FS → DIEF, lunedì 26/10/2026, lezione alle 08:30, bici, margine 10 min, 5 min in stazione, solo regionali. Esito: **esci alle 07:39**, 5 minuti in stazione, RV 3907 delle 07:44 → 07:56, bici fino al DIEF in 22 minuti, arrivo alle 08:18 con 12 minuti di anticipo. Alternative: 07:28 (R 17405) e 06:59 (RV 2451).

Revisione da pendolare (mobile 390×844 e desktop, Lighthouse, axe): [`docs/review-phase5.md`](docs/review-phase5.md). Novità: [`CHANGELOG.md`](CHANGELOG.md).

### Avvio rapido

Requisiti: Python ≥ 3.11, Node.js ≥ 20, npm, `make`.

```bash
make install   # .venv + pip install -e ".[dev]"  e  npm ci in web/
make dev       # API su http://localhost:8000 + web su http://localhost:3000
```

Con Docker:

```bash
docker compose up --build   # api :8000, web :3000
```

> I file Docker non sono stati provati nell'ambiente di sviluppo usato per v0.4 (Docker non disponibile). `make install && make dev` è stato verificato da un clone pulito.

Avvio manuale dei due processi:

```bash
CORS_ORIGINS=http://localhost:3000 uvicorn api.main:app --port 8000
cd web && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Documentazione OpenAPI: http://localhost:8000/docs

#### Variabili d'ambiente

| Variabile | Dove | Default | Significato |
|---|---|---|---|
| `CORS_ORIGINS` | API | `http://localhost:3000` | Origini ammesse, separate da virgola |
| `NEXT_PUBLIC_API_URL` | web (build) | `http://localhost:8000` | URL base dell'API usato dal browser; `/` = stessa origine (proxy) |
| `NEXT_PUBLIC_USE_MOCK` | web (build) | *(vuoto)* | `1` = usa il mock offline invece dell'API (fallback esplicito) |
| `API_PROXY_TARGET` | web (build/start) | *(vuoto)* | Se impostato, Next.js inoltra `/api/*` a questo URL (es. `http://127.0.0.1:8000`) |
| `API_PORT`, `WEB_PORT` | `scripts/dev.sh` | `8000`, `3000` | Porte di sviluppo |

Il mock (`NEXT_PUBLIC_USE_MOCK=1`) non contiene dati scritti a mano: `web/src/lib/api/mock-fixtures.json` è generato da `make fixtures` (`tools/export_mock_fixtures.py`) chiamando l'API reale e copre un solo caso, quello dello screenshot. Un test pytest fallisce se le fixture non corrispondono più all'API.

#### Test e qualità

```bash
make test    # pytest (copertura ≥ 90%) + vitest
make lint    # ruff, validazione dataset, eslint, tsc
make build   # build di produzione Next.js
make smoke   # curl end-to-end su un'API in esecuzione
python scripts/e2e_ui.py http://localhost:3000   # browser reale (Playwright): UI == API su 8 casi (andata, ritorno, buffer, categorie, stessa città)
```

La CI GitHub Actions (`.github/workflows/ci.yml`) ha due job: **Python** (ruff + validazione dati + pytest, Python 3.11–3.13) e **Web** (eslint + prettier + tsc, vitest, `next build`).

### Architettura

```
 Browser ──HTTP/JSON──▶ api/ (FastAPI) ──▶ engine/ (dominio) ──▶ repositories ──▶ data/*.json
   ▲                      │                                     (interfacce astratte)
 web/ (Next.js)           └─ settings (env), errors, schemas Pydantic, routers
```

Le dipendenze vanno in una sola direzione: `web → (HTTP) → api → engine`. `engine` non conosce FastAPI né il frontend.

| Modulo | Responsabilità |
|---|---|
| `engine/models.py` | Dataclass immutabili: `Station`, `Campus`, `TrainRun`, `Leg` (walk/bike/train/wait, note), `Itinerary`, `PlanRequest`, `PlanResult` |
| `engine/repositories.py` | Interfacce `TrainRepository`, `LocationRepository`, `SegmentRepository` + implementazioni JSON |
| `engine/legs.py` | Strategie dei tratti: `WalkLegPlanner`, `BikeLegPlanner` (`ActiveLegPlanner`), `TrainLegPlanner` |
| `engine/planner.py`, `engine/journeys/` | Facciata `Planner.plan(request, name)`; planner registrati per nome: `arrive_by` (andata) e `depart_after` (ritorno), max 3 itinerari + soluzioni vicine |
| `engine/origin.py`, `engine/itinerary_builder.py` | `OriginResolver` (stazione/casa, stessa città) e `ItineraryBuilder` (tratto `wait` in stazione, nessun tratto da 0 min) |
| `engine/calendar_rules.py`, `engine/service_calendar.py`, `engine/holidays.py` | Note di calendario del PDF → regole componibili; festività nazionali; corsa effettuata in una data? |
| `engine/train_categories.py`, `engine/validity.py` | Gruppi R/RV · IC/ICN · FR e biglietto diverso; finestra di validità dell'orario dai dati |
| `api/settings.py` | Configurazione da env (`CORS_ORIGINS`), iniettabile in `create_app(settings)` |
| `api/deps.py` | Dependency injection di repository e planner (sostituibili nei test) |
| `api/routers/*` | `GET /api/health`, `GET /api/campuses`, `GET /api/stations`, `POST /api/plan`, `GET /api/geocode` |
| `api/geocoding.py` | `NominatimGeocoder`: ricerca indirizzi limitata a MO/RE, 1 richiesta/s, cache LRU |
| `api/schemas.py`, `api/errors.py` | Contratto Pydantic v2 ed errori uniformi `{detail, code}` |
| `web/src/lib/api/` | Porta `PlanService`; `HttpPlanService` (fetch), `MockPlanService` (fixture), `config`, tipi TS del contratto, proxy opzionale |
| `web/src/lib/plan-request.ts` | Valori del form (default: oggi) → corpo di `POST /api/plan`, validazione |
| `web/src/lib/preferences-store.ts`, `lesson-prefill.ts` | Preferenze in `localStorage`; lezione di oggi dall'orario settimanale |
| `web/src/lib/itinerary-summary.ts`, `route-geometry.ts` | Testi del risultato (treno, attesa, biglietto) e geometria del percorso sulla mappa |
| `web/src/hooks/use-planner-values.ts` | Stato del form: ripristino, precompilazione, salvataggio |
| `web/src/hooks/use-plan.ts` | Stato idle/caricamento/esito/vuoto/errore, indipendente dalla UI |
| `web/src/components/` | Form controllato, ricerca sede, casa (indirizzo/mappa), risultato, timeline, soluzioni vicine, orario settimanale, mappa Leaflet (caricata solo quando serve) |
| `tools/` | `validate_data.py` (coerenza dataset), `export_mock_fixtures.py` |

**Estendibilità.**
- **Nuova modalità attiva** (es. monopattino): basta una sottoclasse di `ActiveLegPlanner`, registrata con `Planner(..., active_planners={"scooter": ...})`, senza modificare il planner. L'API accetta oggi solo `walk|bike`.
- **Nuova domanda** (es. «arrivo entro…» con cambi): basta un nuovo `JourneyPlanner` registrato per nome, che riusa le stesse strategie dei tratti.
- **Nuovi tipi di nota di calendario:** basta aggiungere un `ClauseParser` al registro di `CalendarNoteParser`.
- **Nuovi orari o corse:** si aggiornano i dati dietro `TrainRepository`.
- **Nuove fonti** (es. GTFS): basta una nuova implementazione del repository.
- **Nuovi backend lato web:** basta una nuova implementazione di `PlanService`.

### Limiti dei dati

- **Non è in tempo reale.** Gli orari sono uno snapshot manuale del PDF ufficiale Trenitalia *Regionale Emilia*, edizione valida dal **17/10/2026 al 12/12/2026**: [Regionale_Emilia.pdf](https://www.trenitalia.com/content/dam/trenitalia/allegati/info/orario-digitale/orari-regionali/Regionale_Emilia.pdf). Il PDF è stato verificato il 23/10/2026; il metodo è descritto in `docs/research/STATUS_treni.md`. Ritardi, soppressioni, scioperi e lavori non sono considerati. Fuori dal periodo di validità l'API aggiunge un avviso.
- `data/trains.json` contiene 121 corse feriali (61 RE→MO, 60 MO→RE): Regionale, Regionale Veloce, Intercity, Intercity Notte e Frecciarossa. Le ultime tre categorie richiedono titoli di viaggio diversi dal regionale.
- Il motore filtra per giorno della settimana, per `valid_from`/`valid_to` e per le **festività nazionali** (es. 1/11, 8/12).
- **Note di calendario.** `calendar_rules` interpreta le note del PDF con una grammatica rigorosa: giorni, esclusioni, periodi, sospensioni, feriali e festivi. Sulle 121 corse:
  - 11 hanno note interpretate;
  - 55 hanno note solo informative;
  - 55 hanno note **non interpretabili** (troncate o ambigue nella trascrizione). Per queste la corsa resta valida secondo i giorni strutturati e la risposta aggiunge un avviso con la pagina del PDF («Calendario da verificare»).
  
  Nessun significato viene inventato.
- **Categorie:** per default solo R/RV. IC/ICN/FR (biglietto diverso o supplemento) compaiono solo se richiesti, con badge.
- Copertura: solo **Modena FS** e **Reggio Emilia FS** e 5 sedi (DIEF, Economia «Marco Biagi», Giurisprudenza, Palazzo Dossetti, Campus San Lazzaro).
- **Tempi attivi.** A piedi: durata OSRM *routed-foot*. In bici: distanza OSRM / 15 km/h, arrotondata per eccesso. Se si parte da coordinate, il tratto casa→stazione è stimato (distanza in linea d'aria × 1,3).
- **Tempo in stazione:** 5 minuti di default, configurabile 1–30 (non è un dato misurato, è una scelta dell'utente).
- **Indirizzi:** la ricerca usa il servizio pubblico Nominatim (solo all'invio, 1 richiesta/s, area Modena/Reggio Emilia). L'indirizzo di casa resta solo nel browser.
- La mappa disegna un percorso indicativo in linea retta; le durate vengono dall'API.

### Licenze e attribuzioni

- **Codice:** licenza [MIT](LICENSE) © 2026 Jaski99 e contributori UnimoreGo.
- **OpenStreetMap:**
  - Coordinate delle sedi e delle stazioni (via Nominatim) e percorsi a piedi/bici (via FOSSGIS OSRM, `routing.openstreetmap.de`): © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licenza **ODbL 1.0**. La fonte di ogni elemento è annotata in `data/locations.json` e `data/segments.json`.
  - Ricerca indirizzi di casa (`/api/geocode`): Nominatim, dati © OpenStreetMap contributors, **ODbL 1.0**, nel rispetto della [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) (max 1 richiesta/s, cache, User-Agent identificativo, nessun autocompletamento).
  - Tile della mappa: © OpenStreetMap contributors, nel rispetto della [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
- **Orari ferroviari:** fonte Trenitalia (PDF *Regionale Emilia*, corse operate da Trenitalia e Trenitalia Tper). I dati sono trascritti a scopo dimostrativo e restano di Trenitalia; non è stata accertata una licenza di riuso. Ogni corsa riporta pagina e nota del PDF nel campo `source`, mostrato anche nelle risposte dell'API. L'app lo dichiara in ogni risposta («Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale)»).
- Progetto portfolio indipendente, non affiliato a UNIMORE, Trenitalia o Trenitalia Tper.

---

## English

### What it is

**UnimoreGo** is a web app for **UNIMORE** commuter students that answers one question: *when do I have to leave home to make it to class?*
You choose the campus and lesson time, where you start and how you move in town. It then combines **Modena FS ↔ Reggio Emilia FS** trains with the active first/last mile and shows **"Esci alle HH:MM"** (leave at), the expected arrival, the slack and up to 3 alternatives.

Options (v0.4):
- **Outbound / return.** Outbound answers "when do I leave?" (`arrive_by`, lesson start). Return answers "when do I head home?" (`depart_after`, lesson end).
- **Origin.** The station, or **home** from an address (OpenStreetMap Nominatim search), your device location or a map tap, with optional home↔station minutes.
- **Walk or bike.**
- **Station time.** Default 5 min, range 1–30, so "leave at" never equals the train departure.
- **Margin.** Default 10 min.
- **Regional trains only (R/RV).** On by default. IC/FR appear only when enabled, with a **"Biglietto diverso / supplemento"** badge (different ticket or supplement).

Preferences stay in `localStorage` (never the date), and the weekly schedule prefills today's lesson.

Domain rule: **never take the train within the same city**. When no train is useful (night, holidays, outside the timetable validity), the app says so in Italian and offers the previous/next solution.

The screenshot shows a real API result: Reggio Emilia FS → DIEF, Monday 26/10/2026, 08:30 lesson, bike, 10 min margin, 5 min station time, regional only. Result: **leave at 07:39**, 5 min at the station, RV 3907 07:44 → 07:56, 22 min bike ride, arrival 08:18 with 12 min of slack. Alternatives: 07:28 (R 17405) and 06:59 (RV 2451).

Commuter review with measurements (Lighthouse mobile 91–98 / 100 / 100 over 6 runs, axe 0 violations): [`docs/review-phase5.md`](docs/review-phase5.md). Changes: [`CHANGELOG.md`](CHANGELOG.md).

### Getting started

Requirements: Python ≥ 3.11, Node.js ≥ 20, npm, `make`.

```bash
make install   # .venv + pip install -e ".[dev]" and npm ci in web/
make dev       # API on http://localhost:8000 + web on http://localhost:3000
docker compose up --build   # same, with containers (not verified for v0.4: Docker was unavailable)
```

Environment variables:
- `CORS_ORIGINS` (API): allowed origins, comma separated. Default `http://localhost:3000`.
- `NEXT_PUBLIC_API_URL` (web): API base URL used by the browser. Default `http://localhost:8000`; `/` means same-origin.
- `NEXT_PUBLIC_USE_MOCK=1` (web): explicit offline mock fallback.
- `API_PROXY_TARGET` (web): makes Next.js proxy `/api/*` to the backend.

The mock's data is generated from the real API by `make fixtures`; no hand-written timetables.

Quality: `make test` (pytest ≥ 90% coverage + vitest), `make lint`, `make build`, `make smoke`, and `python scripts/e2e_ui.py` (Playwright, checks UI == API on 8 cases). CI runs a Python job (ruff + pytest) and a web job (lint + vitest + build).

### Architecture

Dependencies flow one way: `web → (HTTP) → api → engine`.
- `engine/` holds:
  - the immutable domain models and abstract repositories with JSON implementations;
  - the leg strategies (`ActiveLegPlanner`, `TrainLegPlanner`), `OriginResolver` and `ItineraryBuilder` (station wait leg, no 0-minute legs);
  - journey planners registered by name (`arrive_by`, `depart_after`);
  - `calendar_rules` / `service_calendar` / `holidays`, `train_categories` and `validity`.
- `api/` is a thin FastAPI layer: env-driven `settings`, DI providers, Pydantic schemas, uniform `{detail, code}` errors, and routers (`/api/health`, `/api/campuses`, `/api/stations`, `/api/plan`, `/api/geocode`).
- `web/` puts the UI behind a `PlanService` port with HTTP and mock implementations. On top sit:
  - pure libs: form values → request, preferences store, lesson prefill, itinerary summary, route geometry;
  - hooks: `usePlannerValues`, `usePlan`;
  - presentational components, including a lazily loaded Leaflet map.

Extension points:
- new active modes via `Planner(active_planners=...)`;
- new questions via a registered `JourneyPlanner`;
- new calendar clauses via a `ClauseParser`;
- new data sources via repository implementations;
- new web backends via `PlanService`.

### Data limitations

- **Not real time.** Trains are a manual snapshot of the official Trenitalia *Regionale Emilia* PDF, valid **17/10/2026–12/12/2026**. Delays, cancellations and strikes are ignored, and the API warns when a date falls outside the validity window.
- The snapshot has 121 weekday runs, including Intercity/Frecciarossa, which need non-regional tickets.
- **Calendar notes.** PDF calendar notes are interpreted by a strict grammar (`calendar_rules`); national holidays are applied. Of 121 runs:
  - 11 have interpreted notes;
  - 55 have informational notes only;
  - 55 have notes that cannot be interpreted. Those keep their structured weekdays, and the response adds a warning citing the PDF page. No meaning is invented.
- Only Modena FS / Reggio Emilia FS and 5 campuses are covered.
- Walking times come from OSRM durations; cycling is OSRM distance / 15 km/h.
- **Station time.** It is a user setting (default 5 min), not measured data.
- **Address search.** It uses the public Nominatim service (on submit only, 1 req/s, Modena/Reggio area). The home address stays in the browser.
- The map shows an indicative straight-line route; durations come from the API.

### Licences and attribution

- **Code:** [MIT](LICENSE).
- **Map and location data:** © OpenStreetMap contributors, **ODbL 1.0**. This covers Nominatim coordinates and the home address search, FOSSGIS OSRM routes and OSM tiles, used under the Nominatim and Tile usage policies.
- **Timetable source:** Trenitalia (*Regionale Emilia* PDF; Trenitalia / Trenitalia Tper services). It is transcribed for demonstration only; no reuse licence has been established.
- Independent portfolio project, not affiliated with UNIMORE or Trenitalia.
