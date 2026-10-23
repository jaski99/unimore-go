# UnimoreGo

[![UnimoreGo CI](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml/badge.svg)](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 🇮🇹 [Italiano](#italiano) · 🇬🇧 [English](#english)

![UnimoreGo: risultato reale Reggio Emilia FS → DIEF, lunedì 26/10/2026, lezione 08:30, bici, margine 10](docs/screenshot.png)

---

## Italiano

### Cos'è

**UnimoreGo** è una web app per studenti pendolari di **UNIMORE** che risponde a una domanda: *a che ora devo uscire di casa per arrivare a lezione?*
Scegli sede, giorno e ora della lezione, stazione di partenza (o posizione / tempo casa→stazione), modalità **a piedi** o **in bici** e un margine di sicurezza: l'app combina i treni **Modena FS ↔ Reggio Emilia FS** con il primo/ultimo tratto attivo e mostra **«Esci alle HH:MM»**, l'arrivo previsto, l'anticipo e fino a 3 alternative.

Regola di dominio: **mai il treno dentro la stessa città**. Origine e sede nella stessa città → solo piedi/bici.

Lo screenshot qui sopra mostra un risultato reale dell'API: Reggio Emilia FS → DIEF, lunedì 26/10/2026, lezione alle 08:30, bici, margine 10 min. Esito: **esci alle 07:44**, RV 3907 delle 07:44 → 07:56, bici fino al DIEF in 22 minuti, arrivo alle 08:18 con 12 minuti di anticipo. Alternative: 07:33 e 07:23.

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
python scripts/e2e_ui.py http://localhost:3000   # browser reale (Playwright): UI == API su 5 casi
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
| `engine/models.py` | Dataclass immutabili: `Station`, `Campus`, `TrainRun`, `Leg`, `Itinerary`, `PlanRequest` |
| `engine/repositories.py` | Interfacce `TrainRepository`, `LocationRepository`, `SegmentRepository` + implementazioni JSON |
| `engine/legs.py` | Strategie dei tratti: `WalkLegPlanner`, `BikeLegPlanner` (`ActiveLegPlanner`), `TrainLegPlanner` |
| `engine/planner.py` | `Planner.arrive_by`: ricerca all'indietro dall'orario della lezione, max 3 itinerari |
| `api/settings.py` | Configurazione da env (`CORS_ORIGINS`), iniettabile in `create_app(settings)` |
| `api/deps.py` | Dependency injection di repository e planner (sostituibili nei test) |
| `api/routers/*` | `GET /api/health`, `GET /api/campuses`, `GET /api/stations`, `POST /api/plan` |
| `api/schemas.py`, `api/errors.py` | Contratto Pydantic v2 ed errori uniformi `{detail, code}` |
| `web/src/lib/api/` | Porta `PlanService`; `HttpPlanService` (fetch), `MockPlanService` (fixture), `config`, tipi TS del contratto, proxy opzionale |
| `web/src/lib/plan-request.ts` | Valori del form → corpo di `POST /api/plan` |
| `web/src/hooks/use-plan.ts` | Stato idle/caricamento/esito/vuoto/errore, indipendente dalla UI |
| `web/src/components/` | Form, ricerca sede, risultato, timeline, orario settimanale (localStorage), mappa Leaflet |
| `tools/` | `validate_data.py` (coerenza dataset), `export_mock_fixtures.py` |

**Estendibilità.**
- **Nuova modalità attiva** (es. monopattino): basta una sottoclasse di `ActiveLegPlanner`, registrata con `Planner(..., active_planners={"scooter": ...})`, senza modificare il planner. L'API accetta oggi solo `walk|bike`.
- **Nuovi orari o corse:** si aggiornano i dati dietro `TrainRepository`.
- **Nuove fonti** (es. GTFS): basta una nuova implementazione del repository.
- **Nuovi backend lato web:** basta una nuova implementazione di `PlanService`.

### Limiti dei dati

- **Non è in tempo reale.** Gli orari sono uno snapshot manuale del PDF ufficiale Trenitalia *Regionale Emilia*, edizione valida dal **17/10/2026 al 12/12/2026**: [Regionale_Emilia.pdf](https://www.trenitalia.com/content/dam/trenitalia/allegati/info/orario-digitale/orari-regionali/Regionale_Emilia.pdf). Il PDF è stato verificato il 23/10/2026; il metodo è descritto in `docs/research/STATUS_treni.md`. Ritardi, soppressioni, scioperi e lavori non sono considerati. Fuori dal periodo di validità l'API aggiunge un avviso.
- `data/trains.json` contiene 121 corse feriali (61 RE→MO, 60 MO→RE): Regionale, Regionale Veloce, Intercity, Intercity Notte e Frecciarossa. Le ultime tre categorie richiedono titoli di viaggio diversi dal regionale.
- Il motore filtra per giorno della settimana e per `valid_from`/`valid_to`. Le **note di calendario testuali** del PDF (es. «sospeso il…», «si effettua il…») sono conservate ma non interpretate.
- Copertura: solo **Modena FS** e **Reggio Emilia FS** e 5 sedi (DIEF, Economia «Marco Biagi», Giurisprudenza, Palazzo Dossetti, Campus San Lazzaro).
- **Tempi attivi.** A piedi: durata OSRM *routed-foot*. In bici: distanza OSRM / 15 km/h, arrotondata per eccesso. Se si parte da coordinate, il tratto casa→stazione è stimato (distanza in linea d'aria × 1,3).
- Partendo dalla stazione, «Esci alle» coincide con la partenza del treno: non c'è un tempo di accesso al binario.

### Licenze e attribuzioni

- **Codice:** licenza [MIT](LICENSE) © 2026 Jaski99 e contributori UnimoreGo.
- **OpenStreetMap:**
  - Coordinate delle sedi e delle stazioni (via Nominatim) e percorsi a piedi/bici (via FOSSGIS OSRM, `routing.openstreetmap.de`): © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licenza **ODbL 1.0**. La fonte di ogni elemento è annotata in `data/locations.json` e `data/segments.json`.
  - Tile della mappa: © OpenStreetMap contributors, nel rispetto della [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
- **Orari ferroviari:** fonte Trenitalia (PDF *Regionale Emilia*, corse operate da Trenitalia e Trenitalia Tper). I dati sono trascritti a scopo dimostrativo e restano di Trenitalia; non è stata accertata una licenza di riuso. Ogni corsa riporta pagina e nota del PDF nel campo `source`.
- Progetto portfolio indipendente, non affiliato a UNIMORE, Trenitalia o Trenitalia Tper.

---

## English

### What it is

**UnimoreGo** is a web app for **UNIMORE** commuter students that answers one question: *when do I have to leave home to make it to class?*
You choose:
- the campus and the date/time of the lesson;
- the departure station (or your location / home→station minutes);
- **walk** or **bike**;
- a safety margin.

It then combines **Modena FS ↔ Reggio Emilia FS** trains with the active first/last mile. It shows **"Esci alle HH:MM"** (leave at), the expected arrival, the slack and up to 3 alternatives.
Domain rule: **never take the train within the same city**.

The screenshot shows a real API result: Reggio Emilia FS → DIEF, Monday 26/10/2026, 08:30 lesson, bike, 10 min margin. Result: **leave at 07:44**, RV 3907 07:44 → 07:56, 22 min bike ride, arrival 08:18 with 12 min of slack. Alternatives: 07:33 and 07:23.

### Getting started

Requirements: Python ≥ 3.11, Node.js ≥ 20, npm, `make`.

```bash
make install   # .venv + pip install -e ".[dev]" and npm ci in web/
make dev       # API on http://localhost:8000 + web on http://localhost:3000
docker compose up --build   # same, with containers
```

Environment variables:
- `CORS_ORIGINS` (API): allowed origins, comma separated. Default `http://localhost:3000`.
- `NEXT_PUBLIC_API_URL` (web): API base URL used by the browser. Default `http://localhost:8000`; `/` means same-origin.
- `NEXT_PUBLIC_USE_MOCK=1` (web): explicit offline mock fallback.
- `API_PROXY_TARGET` (web): makes Next.js proxy `/api/*` to the backend.

The mock's data is generated from the real API by `make fixtures`; no hand-written timetables.

Quality: `make test` (pytest ≥ 90% coverage + vitest), `make lint`, `make build`, `make smoke`, and `python scripts/e2e_ui.py` (Playwright, checks UI == API on 5 cases). CI runs a Python job (ruff + pytest) and a web job (lint + vitest + build).

### Architecture

Dependencies flow one way: `web → (HTTP) → api → engine`.
- `engine/` holds the immutable domain models, abstract repositories with JSON implementations, leg strategies (`ActiveLegPlanner`, `TrainLegPlanner`) and `Planner.arrive_by`.
- `api/` is a thin FastAPI layer: env-driven `settings`, DI providers, Pydantic schemas, uniform `{detail, code}` errors, and four routers (`/api/health`, `/api/campuses`, `/api/stations`, `/api/plan`).
- `web/` puts the UI behind a `PlanService` port with HTTP and mock implementations, contract types, a form→request mapper, a `usePlan` state hook and presentational components (Leaflet map).

New active modes plug in via `Planner(active_planners=...)`, new data sources via repository implementations, new web backends via `PlanService`.

### Data limitations

- **Not real time.** Trains are a manual snapshot of the official Trenitalia *Regionale Emilia* PDF, valid **17/10/2026–12/12/2026**. Delays, cancellations and strikes are ignored, and the API warns when a date falls outside the validity window.
- The snapshot has 121 weekday runs, including Intercity/Frecciarossa, which need non-regional tickets.
- Free-text calendar notes are stored but not interpreted.
- Only Modena FS / Reggio Emilia FS and 5 campuses are covered.
- Walking times come from OSRM durations; cycling is OSRM distance / 15 km/h.
- When starting at the station, "leave at" equals the train departure (no platform buffer).

### Licences and attribution

- **Code:** [MIT](LICENSE).
- **Map and location data:** © OpenStreetMap contributors, **ODbL 1.0** (Nominatim coordinates, FOSSGIS OSRM routes, OSM tiles).
- **Timetable source:** Trenitalia (*Regionale Emilia* PDF; Trenitalia / Trenitalia Tper services). It is transcribed for demonstration only; no reuse licence has been established.
- Independent portfolio project, not affiliated with UNIMORE or Trenitalia.
