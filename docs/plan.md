# UnimoreGo — Piano di Sviluppo di Progetto (Roadmap)

## Visione e Obiettivo
**UnimoreGo** è una web app responsive pensata specificamente per gli studenti pendolari dell'Università di Modena e Reggio Emilia (UNIMORE).
Dato il punto di partenza (indirizzo/stazione), la sede universitaria bersaglio e l'ora di inizio della lezione, calcola esattamente **a che ora uscire di casa** (orario di partenza + margine di sicurezza), indicando la combinazione ottimale di primo tratto attivo (piedi/bici), treno regionale/veloce/intercity sull'asse Modena FS ↔ Reggio Emilia FS, e ultimo tratto attivo verso il campus.

### Regole Fondamentali di Dominio
1. **Ambito Ferroviario**: Asse `Modena FS` ↔ `Reggio Emilia FS` (R, RV, IC, FR con fermata in entrambe).
2. **Regola Intracittadina**: **MAI treno dentro la stessa città**. Per spostamenti all'interno di Modena o Reggio Emilia si utilizzano esclusivamente itinerari attivi diretti (a piedi o in bicicletta).
3. **Nessun Realtime / Scraping**: Snapshot manuale curato e verificato delle corse ufficiali Trenitalia Tper / Trenitalia; nessun scraping di portali studenti.
4. **Calcolo Attivo**: Bici calcolata su distanza OSRM routed-bike diviso 15 km/h (arrotondata per eccesso); piedi su durata OSRM routed-foot (arrotondata per eccesso).
5. **Margine di Sicurezza**: Predefinito 10 minuti (configurabile dall'utente).

---

## Roadmap per Fasi

### Fase 0 — Ricerca e Validazione Dati (Completata)
- [x] Verifica NeTEx nazionale vs PDF ufficiale Trenitalia: accertata l'assenza delle corse regionali Trenitalia Tper nel NeTEx nazionale; decisione di mantenere `trains.json` curato e tracciato al PDF ufficiale.
- [x] Geocodifica e validazione sul sedime di 5 sedi universitarie UNIMORE (`locations.json`).
- [x] Rilevazione e documentazione dell'inconsistenza del server demo OSRM pubblico (solo profilo auto); risolto con OSM FOSSGIS routed-foot e routed-bike (`segments.json`).
- [x] Verifica export calendario lezioni (`STATUS_ics.md`): modulo manuale orario lezioni nel percorso critico.

### Fase 1 — Dataset Completo e Motore di Calcolo (Completata in questo turno)
- [x] **Repository Git & CI**: Struttura repo pulita, Git configurato con branch `main`, GitHub Actions CI per ruff e pytest.
- [x] **Estensione Dati Treni**: Estensione di `trains.json` all'intera giornata feriale (121 corse complessive, 61 RE→MO e 60 MO→RE), lettura e decodifica note dal PDF ufficiale `Regionale_Emilia.pdf`.
- [x] **Script di Validazione Dati**: `tools/validate_data.py` con test automatici su schema, orari (`arrive > depart`), durata 10–30 min e assenza duplicati.
- [x] **Segmenti & Stazioni**: Completamento dei segmenti dell'ultimo tratto con `Modena FS -> economia_biagi` e `Modena FS -> giurisprudenza`; creazione di `data/stations.json`.
- [x] **Architettura Motore Python 3.11 (SOLID)**:
  - `engine/models.py`: Dataclass immutabili (`Station`, `Campus`, `TrainRun`, `Leg`, `Itinerary`, `PlanRequest`).
  - `engine/repositories.py`: Interfacce astratte (`TrainRepository`, `LocationRepository`, `SegmentRepository`) e implementazioni JSON.
  - `engine/legs.py`: Strategie modulari `ActiveLegPlanner` (`WalkLegPlanner`, `BikeLegPlanner`) e `TrainLegPlanner`.
  - `engine/planner.py`: Algoritmo `arrive_by()` con gestione timezone `Europe/Rome`, ordinamento dal più tardi utile, top 3 opzioni, gestione edge case e warning.
- [x] **Suite di Test & Copertura**: 38 test pytest esaustivi, copertura codice motore **> 95%** (target >= 90%).

### Fase 2 — Backend FastAPI (Prossima)
- [ ] Creazione del servizio FastAPI leggero (`api/main.py`).
- [ ] Schema Pydantic v2 per request/response con validazione campi orari/coordinate.
- [ ] Endpoint `/api/v1/plan` che incapsula `engine.planner.Planner`.
- [ ] Endpoint `/api/v1/campuses` e `/api/v1/stations` per autocompletamento frontend.
- [ ] Middleware CORS e gestione errori HTTP strutturata.
- [ ] Test di integrazione HTTP con `httpx.AsyncClient` e `TestClient`.

### Fase 3 — Frontend Responsive (Successiva)
- [ ] Stack Next.js + TypeScript + Tailwind CSS.
- [ ] Interfaccia utente mobile-first in lingua italiana.
- [ ] Mappa interattiva Leaflet con visualizzazione percorso (primo tratto, asse ferroviario, ultimo tratto).
- [ ] Selezione rapida campus UNIMORE con preset stazioni di riferimento.
- [ ] Selettore modalità di trasporto attivo (a piedi o bicicletta).
- [ ] Visualizzazione chiara dell'orario di uscita di casa raccomandato e margine di arrivo.
