# UnimoreGo

[![UnimoreGo CI](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml/badge.svg)](https://github.com/Jaski99/unimore-go/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-brightgreen.svg)](pyproject.toml)
[![Coverage: 95%+](https://img.shields.io/badge/Coverage-95%25%2B-success.svg)](tests/)

> **Versione Italiana** | *[English Version Below](#english-version)*

**UnimoreGo** è un'applicazione web responsive progettata per gli studenti universitari pendolari di **UNIMORE** (Università degli Studi di Modena e Reggio Emilia). Dato il punto di partenza, la sede didattica di destinazione e l'orario di inizio della lezione, UnimoreGo calcola con precisione **a che ora uscire di casa**, indicando l'itinerario door-to-door comprensivo del margine di sicurezza desiderato.

### Ambito e Regole di Dominio
- **Asse Ferroviario**: Collegamenti regionali, veloci e intercity tra **Modena FS** e **Reggio Emilia FS** (e viceversa).
- **Regola Intracittadina**: **MAI treno all'interno della stessa città**. Gli spostamenti all'interno di Modena o di Reggio Emilia sono pianificati unicamente con mobilità attiva (a piedi o in bicicletta).
- **Dati Certificati**: Nessun bus SETA, nessun dato realtime inaffidabile, nessun web scraping nel percorso critico. Dati ferroviari verificati riga per riga dal bollettino ufficiale Trenitalia.
- **Calcolo Tempi Attivi**:
  - A piedi: tempo OSRM routed-foot (arrotondato per eccesso).
  - In bicicletta: distanza OSRM / 15 km/h (arrotondata per eccesso).
- **Margine Predefinito**: 10 minuti di anticipo all'ingresso in aula.

---

## Struttura del Repository

```
unimore-go/
├── .github/workflows/
│   └── ci.yml               # GitHub Actions CI (Ruff + Pytest su Python 3.11, 3.12, 3.13)
├── data/
│   ├── locations.json       # 5 sedi universitarie UNIMORE geocodificate e verificate
│   ├── segments.json        # 7 segmenti dell'ultimo/primo tratto con tempi piedi/bici
│   ├── stations.json        # Stazioni ferroviarie di riferimento (Modena FS, Reggio Emilia FS)
│   └── trains.json          # 121 corse feriali Modena <-> Reggio Emilia dal PDF ufficiale
├── docs/
│   ├── plan.md              # Piano e roadmap di sviluppo per fasi
│   └── research/            # Esiti verificati della Fase 0 (STATUS_treni, STATUS_sedi, STATUS_ics)
├── engine/                  # Motore di calcolo Python 3.11 (SOLID, basso accoppiamento)
│   ├── __init__.py
│   ├── models.py            # Dataclass immutabili (Station, Campus, TrainRun, Leg, Itinerary, PlanRequest)
│   ├── repositories.py      # Interfacce astratte e implementazioni JSON
│   ├── legs.py              # Strategie LegPlanner (WalkLegPlanner, BikeLegPlanner, TrainLegPlanner)
│   └── planner.py           # Planner arrive_by con gestione fuso Europe/Rome e ordinamento
├── tests/                   # Suite di test pytest esaustiva (copertura > 95%)
│   ├── test_legs.py
│   ├── test_models.py
│   ├── test_planner.py
│   ├── test_repositories.py
│   └── test_validation.py
├── tools/
│   └── validate_data.py     # Script CLI di validazione integrità e coerenza dataset
├── pyproject.toml           # Configurazione pacchetto, ruff e pytest
├── LICENSE                  # Licenza MIT
└── README.md
```

---

## Installazione e Avvio Rapido

### Requisiti
- Python 3.11 o superiore
- Virtual environment raccomandato

### Installazione delle dipendenze di sviluppo
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Esecuzione della Suite di Test e Copertura
```bash
# Esegui tutti i test con report di copertura
pytest --cov=engine --cov-report=term-missing

# Linting e formattazione con Ruff
ruff check .
ruff format --check .
```

### Validazione dei Dataset
```bash
python tools/validate_data.py
```

### Esempio di Utilizzo del Motore in Python

```python
from engine import Planner, JsonTrainRepository, JsonLocationRepository, JsonSegmentRepository, PlanRequest

# Inizializzazione repository e planner
planner = Planner(
    train_repo=JsonTrainRepository(),
    location_repo=JsonLocationRepository(),
    segment_repo=JsonSegmentRepository(),
)

# Richiesta: Lezione alle 08:30 al DIEF (Modena) partendo da Reggio Emilia
request = PlanRequest(
    target_date="2026-10-26",
    target_time="08:30",
    destination_campus_id="dief",
    origin_city="Reggio Emilia",
    last_mile_mode="bike",       # ultimo tratto in bici dalla stazione al campus
    first_mile_minutes=10,       # 10 minuti da casa alla stazione di Reggio Emilia FS
    margin_minutes=10,           # 10 minuti di margine di sicurezza
)

# Calcolo delle migliori opzioni (ordinate dalla partenza più comoda)
itineraries = planner.arrive_by(request)

for i, it in enumerate(itineraries, 1):
    print(f"Opzione {i}: Esci di casa alle {it.leave_at} | Arrivo alle {it.arrive_at} | Margine: {it.slack_min} min")
    for leg in it.legs:
        desc = f" ({leg.train.category} {leg.train.train})" if leg.train else ""
        print(f"  [{leg.depart} - {leg.arrive}] {leg.leg_type.upper()}: {leg.origin} -> {leg.destination} ({leg.minutes}m){desc}")
```

---

<a name="english-version"></a>
## English Version

**UnimoreGo** is a responsive web application designed for UNIMORE commuter students travelling along the **Modena FS ↔ Reggio Emilia FS** railway axis. Given an origin point, target university campus, and class start time, UnimoreGo determines exact **door-to-door departure times**, train connections, and safety margins.

### Key Domain Principles
- **Railway Scope**: Regional, fast regional, intercity, and high-speed trains stopping at both Modena FS and Reggio Emilia FS.
- **Intra-City Rule**: **NEVER take a train within the same city**. Trips inside Modena or Reggio Emilia use active modes exclusively (walking or cycling).
- **Curated Data**: No unreliable bus feeds or scraping; train runs are verified against Trenitalia's official timetable bulletin.
- **Active Speed Standards**:
  - Walking: OSRM routed-foot duration rounded up.
  - Cycling: OSRM distance / 15 km/h rounded up.
- **Default Slack**: 10 minutes arrival margin before lecture start.

### Architecture Highlights
- **SOLID Compliance**: Immutable dataclasses (`@dataclass(frozen=True)`), Abstract Repository pattern, Strategy pattern for active and rail leg planners.
- **High Test Coverage**: Over **95% unit test coverage** via `pytest` and `pytest-cov`.
- **Zero Third-Party Runtime Coupling**: Engine uses Python standard library (`zoneinfo`, `math`, `dataclasses`, `datetime`).

### License
Released under the permissive [MIT License](LICENSE).
