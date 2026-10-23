# UnimoreGo — frontend portfolio

Web app responsive per studenti pendolari UNIMORE: calcola a che ora uscire per arrivare a lezione, combinando i regionali sull’asse Reggio Emilia FS ↔ Modena FS con l’ultimo tratto a piedi o in bici.

> **Prototipo portfolio.** La modalità mock contiene un unico itinerario d’esempio, richiesto per Reggio Emilia FS → DIEF, lunedì 26/10/2026, lezione alle 08:30. Tutti gli orari ferroviari e le percorrenze del mock sono dimostrativi, non dati di servizio in tempo reale.

## Italiano

### Avvio

Requisiti: Node.js 20+ e npm.

```bash
cd web
npm install
npm run dev
```

Apri http://localhost:3000. L’app parte in modalità mock se non viene impostata una modalità diversa.

### Variabili d’ambiente

Crea `.env.local` (non va committato):

```dotenv
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- `NEXT_PUBLIC_API_MODE=mock|http` seleziona il servizio implementato dietro `PlanService`.
- `NEXT_PUBLIC_API_URL` è la base URL del backend FastAPI, usata in modalità `http` (es. `http://localhost:8000`). Il browser invia le richieste a `/api/health`, `/api/campuses`, `/api/stations` e `/api/plan`.
- Per il portfolio locale usa `mock`; l’URL non è necessario. In modalità `http`, URL e backend devono essere raggiungibili dal browser e configurati per CORS.

### Comandi

```bash
npm test       # suite Vitest + React Testing Library
npm run build  # build di produzione Next.js
npm run lint   # ESLint
npm run format # Prettier
```

### Architettura

- `src/lib/api/types.ts`: tipi TypeScript strict corrispondenti al contratto API.
- `src/lib/api/plan-service.ts`: interfaccia `PlanService`, implementazioni `HttpPlanService` e `MockPlanService`, factory guidata dalle variabili d’ambiente.
- `src/lib/data/locations.ts`: sedi e stazioni del perimetro, con coordinate OpenStreetMap/Nominatim e riferimento di attribuzione nel commento.
- `src/hooks/use-plan.ts`: gestione stato idle/caricamento/esito/vuoto/errore indipendente dalla UI.
- `src/lib/schedule-store.ts`: interfaccia per l’orario e implementazione `LocalStorageScheduleStore`.
- `src/lib/time-format.ts`: conversione e formattazione esplicita in `Europe/Rome`, inclusa la gestione dell’ora legale.
- `src/components/`: form, ricerca accessibile delle sedi, timeline, risultati, orario settimanale e mappa.
- `src/components/map-panel.tsx` importa Leaflet solo lato client, senza SSR. I tile sono forniti da OpenStreetMap con attribuzione visibile.

Il frontend non contiene algoritmi di routing: costruzione dell’itinerario e contratto dati passano dal servizio, così il mock può essere sostituito dal backend senza riscrivere i componenti. Il mock restituisce risultati solo per l’esempio fornito; per le altre combinazioni restituisce un itinerario vuoto e un avviso, senza inventare orari.

L’interfaccia segue il tema chiaro/scuro di sistema, è mobile-first e usa etichette, controlli da tastiera, stati accessibili e `aria-live` sul risultato.

---

## English

### Run locally

Requirements: Node.js 20+ and npm.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. The app defaults to mock mode unless another mode is configured.

### Environment variables

Create `.env.local` (do not commit it):

```dotenv
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- `NEXT_PUBLIC_API_MODE=mock|http` selects the implementation behind `PlanService`.
- `NEXT_PUBLIC_API_URL` is the FastAPI base URL used in `http` mode (for example `http://localhost:8000`). The browser calls `/api/health`, `/api/campuses`, `/api/stations`, and `/api/plan`.
- Use `mock` for the portfolio demo; the URL is optional in this mode. With `http`, the API must be reachable from the browser and allow the frontend origin through CORS.

### Commands

```bash
npm test       # Vitest + React Testing Library suite
npm run build  # Next.js production build
npm run lint   # ESLint
npm run format # Prettier
```

### Architecture

- `src/lib/api/types.ts` defines strict TypeScript types for the API contract.
- `src/lib/api/plan-service.ts` contains the `PlanService` abstraction, `HttpPlanService`, `MockPlanService`, and environment-based factory.
- `src/lib/data/locations.ts` contains only the specified campuses and stations, with coordinates sourced from OpenStreetMap/Nominatim and attribution noted in code.
- `src/hooks/use-plan.ts` owns loading/success/empty/error state independently from presentation.
- `src/lib/schedule-store.ts` defines the weekly schedule abstraction and the `LocalStorageScheduleStore` adapter.
- `src/lib/time-format.ts` handles `Europe/Rome` formatting and daylight-saving offsets.
- `src/components/` contains cohesive form, campus search, result, timeline, weekly schedule, and map components.
- `src/components/map-panel.tsx` dynamically imports Leaflet on the client only (`ssr: false`). Map tiles come from OpenStreetMap and attribution is shown.

The frontend contains no route-finding algorithm. Planning stays behind the service boundary, so the mock can be replaced by the FastAPI implementation without coupling the UI to transport details. The mock returns an itinerary only for the supplied Reggio Emilia FS → DIEF example on 26 October 2026; all train times and journey durations are marked as examples, not live service data. Other combinations return an empty itinerary and a warning rather than fabricated schedules.

The interface follows the operating system’s light/dark theme, is mobile-first, keyboard accessible, labelled, and announces result updates with `aria-live`.
