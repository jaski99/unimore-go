# UnimoreGo

[![UnimoreGo CI](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml/badge.svg)](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-brightgreen.svg)](pyproject.toml)
[![Coverage: 96%+](https://img.shields.io/badge/Coverage-96%25%2B-success.svg)](tests/)
[![API: FastAPI](https://img.shields.io/badge/API-FastAPI%200.110%2B-009688.svg)](https://fastapi.tiangolo.com/)

> **Versione Italiana** | *[English Version Below](#english-version)*

**UnimoreGo** è una web app responsive progettata specificamente per gli studenti universitari pendolari di **UNIMORE** (Università degli Studi di Modena e Reggio Emilia). Dato il punto di partenza (stazione o coordinate GPS), la sede didattica di destinazione e l'orario di inizio della lezione, UnimoreGo calcola con precisione **a che ora uscire di casa**, indicando l'itinerario door-to-door comprensivo del margine di sicurezza desiderato, i treni utili e i tratti attivi (a piedi o in bicicletta).

---

## Regole Fondamentali di Dominio
1. **Asse Ferroviario**: Collegamenti regionali, veloci, intercity e alta velocità tra **Modena FS** e **Reggio Emilia FS** (e viceversa), tratti dal bollettino ufficiale Trenitalia.
2. **Regola Intracittadina**: **MAI treno all'interno della stessa città**. Gli spostamenti all'interno di Modena o di Reggio Emilia sono pianificati unicamente con mobilità attiva (a piedi o in bicicletta).
3. **Dati Certificati & Affidabili**: Nessun bus locale a rischio ritardi imprevisti, nessun dato realtime inaffidabile, nessun web scraping nel percorso critico. Orari feriali verificati riga per riga dal PDF ufficiale Trenitalia (scadenza 12/12/2026).
4. **Calcolo Tempi Attivi**:
   - A piedi: velocità 4.5 km/h o durata OSRM routed-foot (arrotondata per eccesso).
   - In bicicletta: distanza OSRM / 15 km/h (arrotondata per eccesso).
5. **Margine di Sicurezza**: Predefinito 10 minuti di anticipo rispetto all'inizio della lezione (configurabile dall'utente tra 0 e 60 minuti).

---

## Architettura del Repository

Il progetto adotta un'architettura a livelli conforme ai principi **SOLID**: il modulo `api/` è sottile e agnostico rispetto alla persistenza, dipendendo esclusivamente dalle interfacce del motore (`engine/`) tramite Dependency Injection di FastAPI (`Depends`).

```
unimore-go/
├── .github/workflows/
│   └── ci.yml               # CI GitHub Actions (Ruff + Pytest + Coverage >= 90%)
├── api/                     # Layer REST API FastAPI (Phase 2)
│   ├── __init__.py          # Export app e create_app
│   ├── deps.py              # Dependency Injection providers (TrainRepo, LocationRepo, SegmentRepo, Planner)
│   ├── errors.py            # Error handlers uniformi {detail, code} per 404, 422, 500
│   ├── main.py              # Factory create_app(), CORS middleware, OpenAPI docs
│   ├── schemas.py           # Schemi Pydantic v2 con validazione ed esempi OpenAPI
│   └── routers/             # Router REST modulari
│       ├── campuses.py      # GET /api/campuses
│       ├── health.py        # GET /api/health
│       ├── plan.py          # POST /api/plan
│       └── stations.py      # GET /api/stations
├── data/                    # Dataset JSON curati e tracciati
│   ├── locations.json       # 5 sedi universitarie UNIMORE geocodificate sul sedime
│   ├── segments.json        # 7 segmenti dell'ultimo/primo tratto con tempi piedi/bici
│   ├── stations.json        # Stazioni ferroviarie di riferimento (Modena FS, Reggio Emilia FS)
│   └── trains.json          # 121 corse feriali Modena <-> Reggio Emilia dal PDF ufficiale
├── docs/                    # Documentazione e note di ricerca
│   ├── plan.md              # Piano e roadmap di sviluppo per fasi
│   └── research/            # Esiti verificati della Fase 0 (STATUS_treni, STATUS_sedi, STATUS_ics)
├── engine/                  # Core Commuter Engine Python 3.11 (SOLID)
│   ├── __init__.py
│   ├── legs.py              # Strategie LegPlanner (WalkLegPlanner, BikeLegPlanner, TrainLegPlanner)
│   ├── models.py            # Dataclass immutabili (Station, Campus, TrainRun, Leg, Itinerary, PlanRequest)
│   ├── planner.py           # Planner arrive_by con gestione fuso Europe/Rome e ordinamento
│   └── repositories.py      # Interfacce astratte e implementazioni JSON
├── tests/                   # Suite di test pytest (copertura 96.9%)
│   ├── api/                 # Test HTTP TestClient per API e contratti JSON
│   │   ├── test_campuses.py
│   │   ├── test_contract.py
│   │   ├── test_health.py
│   │   ├── test_plan.py
│   │   └── test_stations.py
│   ├── test_legs.py         # Test unitari strategie tratte attive e ferroviarie
│   ├── test_models.py       # Test modelli di dominio e parsing orari
│   ├── test_planner.py      # Test scenari pendolari ed edge case
│   ├── test_repositories.py # Test repository e caricamento JSON
│   └── test_validation.py   # Test suite validatore dati
├── tools/
│   └── validate_data.py     # Script CLI di validazione integrità e coerenza dataset
├── pyproject.toml           # Configurazione pacchetto, dipendenze, ruff e pytest
├── LICENSE                  # Licenza MIT
└── README.md
```

---

## Installazione e Avvio Rapido

### Requisiti
- Python 3.11 o superiore
- Virtual environment raccomandato

### Installazione delle dipendenze
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Avvio del Server API
```bash
# Avvio con uvicorn e live-reload attivo
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```
La documentazione interattiva OpenAPI / Swagger è accessibile su `http://localhost:8000/docs`, mentre ReDoc è consultabile su `http://localhost:8000/redoc`.

### Configurazione CORS
Le origini ammesse sono configurabili tramite la variabile d'ambiente `CORS_ORIGINS` (separate da virgola). Predefinita: `http://localhost:3000`.
```bash
export CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
uvicorn api.main:app
```

### Esecuzione Test e Copertura
```bash
# Esegui tutti i 60 test con report di copertura (target >= 90%)
pytest --cov=engine --cov=api --cov-report=term-missing

# Linting e verifica stile con Ruff (0 errori)
ruff check .
ruff format --check .

# Validazione dei dataset JSON
python tools/validate_data.py
```

---

## Specifica API REST

Tutti gli endpoint rispondono con intestazioni JSON standard. In caso di errore, la risposta ha sempre la struttura uniforme:
```json
{
  "detail": "Descrizione dell'errore",
  "code": "NOT_FOUND | VALIDATION_ERROR | INTERNAL_SERVER_ERROR"
}
```

### 1. `GET /api/health`
Verifica lo stato operativo del servizio e la data di scadenza dell'orario ferroviario caricato.

**Risposta (200 OK):**
```json
{
  "status": "ok",
  "data_valid_to": "2026-12-12",
  "version": "0.2.0"
}
```

---

### 2. `GET /api/campuses`
Restituisce l'elenco di tutte le sedi didattiche UNIMORE con coordinate geografiche WGS84 verificate.

**Risposta (200 OK):**
```json
[
  {
    "id": "dief",
    "name": "Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)",
    "city": "Modena",
    "lat": 44.6292268,
    "lon": 10.9492319
  },
  {
    "id": "palazzo_dossetti",
    "name": "Dipartimento di Comunicazione ed Economia - Palazzo Dossetti",
    "city": "Reggio Emilia",
    "lat": 44.7023652,
    "lon": 10.6286549
  },
  {
    "id": "campus_san_lazzaro",
    "name": "Campus San Lazzaro - Dipartimento di Scienze e Metodi dell'Ingegneria (DISMI, Padiglione Morselli)",
    "city": "Reggio Emilia",
    "lat": 44.68759,
    "lon": 10.6672109
  },
  {
    "id": "economia_biagi",
    "name": "Dipartimento di Economia 'Marco Biagi' (Foro Boario)",
    "city": "Modena",
    "lat": 44.6500719,
    "lon": 10.9230943
  },
  {
    "id": "giurisprudenza",
    "name": "Dipartimento di Giurisprudenza (Complesso San Geminiano)",
    "city": "Modena",
    "lat": 44.6433902,
    "lon": 10.9259537
  }
]
```

---

### 3. `GET /api/stations`
Restituisce le stazioni ferroviarie di riferimento lungo la linea Bologna-Milano.

**Risposta (200 OK):**
```json
[
  {
    "id": "modena_fs",
    "name": "Modena FS",
    "city": "Modena",
    "lat": 44.653998,
    "lon": 10.930751
  },
  {
    "id": "reggio_fs",
    "name": "Reggio Emilia FS",
    "city": "Reggio Emilia",
    "lat": 44.697309,
    "lon": 10.642577
  }
]
```

---

### 4. `POST /api/plan`
Calcola i migliori itinerari door-to-door per giungere a lezione in tempo.

**Campi Request Body:**
- `origin`: Oggetto con `station_id` (es. `reggio_fs`) oppure coordinate `{lat: float, lon: float}`.
- `campus_id`: Identificativo sede di destinazione (es. `dief`).
- `arrive_by`: Data e ora inizio lezione in formato ISO 8601 (fuso orario `Europe/Rome`).
- `mode`: Modalità attiva preferita (`walk` o `bike`, predefinito `walk`).
- `margin_min`: Margine di sicurezza in minuti (intero `0` - `60`, predefinito `10`).
- `home_to_station_min`: Durata casa -> stazione in minuti (opzionale; se omesso con coordinate, viene stimato automaticamente).

#### Esempio 1: Pendolare Intercittadino (Reggio Emilia -> DIEF Modena in bici)

```bash
curl -s -X POST http://localhost:8000/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"station_id": "reggio_fs"},
    "campus_id": "dief",
    "arrive_by": "2026-10-26T08:30:00",
    "mode": "bike",
    "margin_min": 10,
    "home_to_station_min": 10
  }' | jq .
```

**Risposta (200 OK):**
```json
{
  "itineraries": [
    {
      "leave_at": "07:34",
      "arrive_at": "08:18",
      "slack_min": 12,
      "legs": [
        {
          "type": "bike",
          "from": "Punto di partenza",
          "to": "Reggio Emilia FS",
          "depart": "07:34",
          "arrive": "07:44",
          "minutes": 10,
          "train": null
        },
        {
          "type": "train",
          "from": "Reggio Emilia",
          "to": "Modena",
          "depart": "07:44",
          "arrive": "07:56",
          "minutes": 12,
          "train": {
            "number": "3907",
            "category": "Regionale Veloce",
            "operator": "Trenitalia Tper"
          }
        },
        {
          "type": "bike",
          "from": "Modena FS",
          "to": "Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)",
          "depart": "07:56",
          "arrive": "08:18",
          "minutes": 22,
          "train": null
        }
      ]
    },
    {
      "leave_at": "07:23",
      "arrive_at": "08:09",
      "slack_min": 21,
      "legs": [
        {
          "type": "bike",
          "from": "Punto di partenza",
          "to": "Reggio Emilia FS",
          "depart": "07:23",
          "arrive": "07:33",
          "minutes": 10,
          "train": null
        },
        {
          "type": "train",
          "from": "Reggio Emilia",
          "to": "Modena",
          "depart": "07:33",
          "arrive": "07:47",
          "minutes": 14,
          "train": {
            "number": "17405",
            "category": "Regionale",
            "operator": "Trenitalia Tper"
          }
        },
        {
          "type": "bike",
          "from": "Modena FS",
          "to": "Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)",
          "depart": "07:47",
          "arrive": "08:09",
          "minutes": 22,
          "train": null
        }
      ]
    },
    {
      "leave_at": "07:13",
      "arrive_at": "08:02",
      "slack_min": 28,
      "legs": [
        {
          "type": "bike",
          "from": "Punto di partenza",
          "to": "Reggio Emilia FS",
          "depart": "07:13",
          "arrive": "07:23",
          "minutes": 10,
          "train": null
        },
        {
          "type": "train",
          "from": "Reggio Emilia",
          "to": "Modena",
          "depart": "07:23",
          "arrive": "07:40",
          "minutes": 17,
          "train": {
            "number": "9303",
            "category": "Frecciarossa",
            "operator": "Trenitalia"
          }
        },
        {
          "type": "bike",
          "from": "Modena FS",
          "to": "Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)",
          "depart": "07:40",
          "arrive": "08:02",
          "minutes": 22,
          "train": null
        }
      ]
    }
  ],
  "warnings": [
    "Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale)."
  ]
}
```

#### Esempio 2: Spostamento Urbano Intracittadino (Modena -> DIEF Modena)
Se origine e destinazione si trovano nella stessa città, la regola di dominio esclude l'uso del treno e pianifica un tragitto diretto a piedi o in bicicletta.

```bash
curl -s -X POST http://localhost:8000/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 44.6500, "lon": 10.9300},
    "campus_id": "dief",
    "arrive_by": "2026-10-26T08:30:00",
    "mode": "bike",
    "margin_min": 10
  }' | jq .
```

**Risposta (200 OK):**
```json
{
  "itineraries": [
    {
      "leave_at": "08:05",
      "arrive_at": "08:20",
      "slack_min": 10,
      "legs": [
        {
          "type": "bike",
          "from": "Punto di partenza",
          "to": "Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)",
          "depart": "08:05",
          "arrive": "08:20",
          "minutes": 15,
          "train": null
        }
      ]
    }
  ],
  "warnings": [
    "Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale).",
    "Origine e destinazione nella stessa città: percorso diretto a piedi/bici (nessun treno necessario)."
  ]
}
```

---

<a name="english-version"></a>
## English Version

**UnimoreGo** is a responsive web application designed for commuter students attending **UNIMORE** (University of Modena and Reggio Emilia). By specifying a starting point (station id or GPS coordinates), destination department campus, and lecture time, UnimoreGo determines the exact **time to leave home**, providing door-to-door transit itineraries with safety buffers, train connections, and walking/cycling segments.

### Key Domain Principles
- **Railway Scope**: Regional, fast regional, intercity, and high-speed trains stopping at both **Modena FS** and **Reggio Emilia FS**.
- **Intra-City Rule**: **NEVER take a train within the same city**. Trips inside Modena or Reggio Emilia use active modes exclusively (walking or cycling).
- **Curated Official Data**: No unreliable third-party feeds or scraping; train schedules are rigorously checked against official Trenitalia timetable bulletins (valid until 12/12/2026).
- **Active Speeds**:
  - Walking: OSRM routed-foot duration rounded up (or 4.5 km/h).
  - Cycling: OSRM distance / 15 km/h rounded up.
- **Default Slack**: 10 minutes arrival buffer before lecture start (configurable between 0 and 60 minutes).

### REST API Endpoints
- `GET /api/health`: Health status and timetable expiration.
- `GET /api/campuses`: Complete list of UNIMORE campuses with coordinates.
- `GET /api/stations`: Served railway stations along the railway line.
- `POST /api/plan`: Door-to-door commuter itinerary computation with automatic first-mile distance estimation and Italian warning messages.

### Quick Start
```bash
# Setup virtual environment and dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Run FastAPI server
uvicorn api.main:app --reload

# Run tests and check coverage (>= 90%)
pytest --cov=engine --cov=api --cov-report=term-missing
```

### License
Released under the permissive [MIT License](LICENSE).
