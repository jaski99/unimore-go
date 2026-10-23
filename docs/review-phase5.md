# Fase 5 — Revisione da pendolare reale

Revisione dell'app usata come la userebbe uno studente pendolare: **mobile 390×844** (touch) e
**desktop 1366×900**, sulla **build di produzione** (`next build && next start`) collegata all'API
reale (v0.4.0, dati Trenitalia *Regionale Emilia* 17/10–12/12/2026).

- **Baseline:** UI v0.3 (`v0.3-integration`, commit `460c0fa`), misurata prima delle modifiche.
- **Dopo:** `main` con i commit di questa fase.

Gli script di misura (Playwright Python + axe-core 4.10.2 + Lighthouse 12) sono stati eseguiti
in sandbox; i numeri qui sotto sono quelli realmente ottenuti.

## Numeri chiave: prima → dopo

| Misura | Baseline v0.3 | Dopo (v0.4) |
|---|---|---|
| Mobile 390×844: posizione verticale di «Esci alle» | **y = 1942 px** (≈ 2,3 schermate di scroll) | **y = 226 px** (visibile senza scroll) |
| Desktop 1366×900: posizione di «Esci alle» | y = 554 px | y = 476 px |
| Tempo al risultato dopo il caricamento (localhost) | ~0,26 s | 0,22–0,29 s |
| Tocchi per la risposta al primo accesso | 0 (ma data fissa 26/10/2026) | 0 (oggi, o la lezione di oggi dal tuo orario) |
| Tocchi per il ritorno («a che ora parto?») | non disponibile | 3 (A piedi → Ritorno → Calcola) |
| Tocchi per partire da casa (indirizzo) | non disponibile | 5 (Da casa → indirizzo → Cerca → risultato → Calcola) |
| Chiavi localStorage dopo l'uso | `[]` | `unimorego.planner.v1` (+ `unimorego.schedule.v1` se usi l'orario) |
| axe-core (wcag2a, wcag2aa, best-practice) | 6 violazioni *serious* (color-contrast) | **0** in 6 stati (mobile e desktop × risultato+mappa+dettagli aperti, casa+ritorno, nessun treno+validità) |
| Lighthouse mobile — Performance | 89 | **95 / 98 / 95** (3 esecuzioni) |
| Lighthouse mobile — Accessibility | 96 | **100** (3/3) |
| Lighthouse mobile — Best Practices | 96 | **100** (3/3) |
| Lighthouse — FCP / LCP / TBT / CLS | 0,8 s / 2,2 s / 390 ms / 0,03 | 0,8 s / 2,2–2,3 s / 130–200 ms / **0** |
| Mappa | tile solo al centro, 2 punti, nessun percorso | tile complete, percorso (treno continuo + tratti attivi tratteggiati), marker casa/stazioni/sede; Leaflet caricato solo vicino alla vista (0 istanze prima dello scroll) |
| E2E browser (`scripts/e2e_ui.py`, UI == API) | 5/5 casi v0.3 | **8/8** casi v0.4 (andata, buffer 15, a piedi, casa+minuti, margine 15, ritorno, tutti i treni, stessa città) |

Comandi usati:

- **Lighthouse:** `lighthouse http://localhost:3000 --form-factor=mobile --only-categories=performance,accessibility,best-practices --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage"` (Chromium Playwright 1248).
- **Fuori dal repository:** gli script di revisione (`build/review/after.py`, `axe_full.py`, `home_flow.py`) misurano le metriche UX e i flussi.

## Problemi → correzioni → verifica

### Dominio e motore

| # | Problema trovato | Correzione | Verifica |
|---|---|---|---|
| 1 | Partendo dalla stazione «Esci alle» coincideva con la partenza del treno (07:44). | `station_buffer_min` (default 5, 1–30, configurabile in UI «Tempo in stazione»): tratto `wait` prima di ogni treno; vale anche arrivando in stazione da casa. | pytest `test_itinerary_builder.py`, `api/test_plan_phase5.py`; E2E: RE FS→DIEF 08:30 → **Esci alle 07:39**, treno 07:44; con 15 min → 07:29. |
| 2 | Tratti a piedi/bici da 0 minuti (origine = stazione). | `ItineraryBuilder` non genera tratti ≤ 0 min; la UI li filtra comunque (`visibleLegs`). | pytest builder; vitest `itinerary-timeline.test.tsx`; E2E controlla `minutes > 0` su ogni tratto. |
| 3 | FR/IC proposti come i regionali, senza avvisi sul biglietto. | Filtro «Solo regionali (R/RV)» attivo di default; param API opzionale `train_categories` (omesso = tutte, retrocompatibile). Badge «Biglietto diverso / supplemento» sul risultato e sui tratti; nelle alternative la scritta «biglietto diverso». | pytest `test_train_categories.py`, `api/test_plan_phase5.py`; vitest result-panel/timeline/plan-form; E2E «tutti i treni»: badge = `different_ticket` dell'API. |
| 4 | Note di calendario del PDF ignorate. | Modulo `engine/calendar_rules.py` (grammatica rigorosa: solo giorni, esclusi giorni, periodi, sospensioni, date, feriali, festivi) + `service_calendar.py` + `holidays.py`. Le note non interpretabili generano un avviso con la pagina del PDF. | pytest `test_calendar_rules.py`, `test_service_calendar.py`; dati reali: 11 corse interpretate, 55 solo informative, 55 non interpretabili (→ avviso, es. «… pag. 74»). |
| 5 | Nessuna origine «casa» vera. | Casa da indirizzo (`GET /api/geocode`, Nominatim) o tocco sulla mappa, più minuti casa→stazione facoltativi. Casa nella stessa città della sede → solo piedi/bici. | pytest `test_origin.py`, `test_journeys.py::test_same_city_is_direct_without_train` (MO→MO e RE→RE, da stazione e da coordinate, andata e ritorno), `api/test_plan_phase5.py::test_return_trip_same_city_never_train`, `api/test_geocode.py`; flusso browser reale: casa a Modena → DIEF = «Diretto in bici, senza treno»; casa a Reggio → bici + attesa + RV 3907 + bici. |
| 6 | Manca il ritorno. | Planner `depart_after` registrato per nome accanto ad `arrive_by`, con le stesse strategie dei tratti. UI: «Ritorno · a che ora parto?». | pytest `test_journeys.py`; E2E: fine lezione 13:00 → **Parti alle 13:33**. |
| 7 | Notte/festivi/date fuori validità: risultato vuoto e poco chiaro. | Messaggio italiano «Nessun treno utile…» + soluzione precedente/successiva (`nearby`); avviso esplicito oltre `data_valid_to`; avviso in UI già mentre scegli la data. | pytest `test_validity.py`, `api/test_plan_phase5.py`; browser: 14/12/2026 → avviso validità + «Soluzione precedente · sab 12 dic». |

### UX, accessibilità e performance

| # | Problema trovato | Correzione | Verifica |
|---|---|---|---|
| 8 | Mobile: la risposta era a 1942 px, dopo hero e form. | Layout *answer-first*: in DOM e su mobile il risultato viene prima del form; su desktop due colonne. Hero compatto su mobile; dopo «Calcola» la pagina scorre al risultato. | `after.py`: y = 226 px; vitest `planner-shell.test.tsx` (ordine DOM, scroll su mobile). |
| 9 | La data era fissa (26/10/2026). | Default = oggi (Europe/Rome). | vitest `plan-request.test.ts` (anche 23:30 UTC → giorno dopo a Roma). |
| 10 | Nessun campo ricordato. | `LocalStoragePreferencesStore`: tutto tranne la data, con sanificazione campo per campo. | vitest `preferences-store.test.ts`, `use-planner-values.test.tsx`; browser: «A piedi» + «Ritorno», ricarica → ancora «Parti alle…». |
| 11 | L'orario settimanale non precompilava la lezione. | `pickLessonToPrefill`: prossima lezione di oggi non iniziata, altrimenti la prima entro 7 giorni, con nota «Dal tuo orario: …». | vitest `lesson-prefill.test.ts`; browser: «Dal tuo orario: prossima lezione lun 26 ott alle 10:30.» |
| 12 | Anteprima dell'orario settimanale fissa a bici/10 min/stazione. | Usa le impostazioni correnti dell'utente (`nextLessonRequest`). | vitest `schedule-panel.test.tsx`. |
| 13 | Mappa con tile solo al centro; nessun percorso. | `invalidateSize` dopo il mount e al resize; `buildRoute` disegna treno continuo e tratti attivi tratteggiati. CSS Leaflet spostato nel chunk della mappa; caricamento con IntersectionObserver. | `after.py`: 5 path, 1 tratteggiato, 4–6 tile caricate; 0 istanze Leaflet prima dello scroll. |
| 14 | Contrasto insufficiente (`text-slate-400` 2,63:1 sulle durate). | Testi secondari portati a slate-600/700. | axe 0 violazioni; Lighthouse A11y 100. |
| 15 | Combobox sede: Tab passava per ogni opzione (5 fermate in più). | Opzioni con `tabIndex=-1`, `aria-activedescendant`, Tab chiude la lista. | Sequenza Tab misurata; vitest `campus-search.test.tsx`. |
| 16 | *Regressione introdotta e corretta:* con il risultato in alto CLS = 0,31–0,45, Performance 60–81. | Spazio riservato al risultato (min-height 720 px mobile / 640 px desktop): il form non salta più. | Lighthouse CLS **0**, Performance 95/98/95. |
| 17 | `/favicon.ico` 404 (errore in console, Best Practices 96). | `app/icon.svg`. | Lighthouse Best Practices 100, nessun errore in console. |
| 18 | Etichetta di casa lunga: la pagina mobile si allargava a 507 px (bottone «Cambia» fuori schermo). | `fieldset { min-width: 0 }` (il default `min-content` annullava `truncate`). | `home_flow.py`: larghezza documento 390 px con etichetta lunga. |
| 19 | Etichette Nominatim con luogo prima del civico perdevano la via («Questura/RPC, 10, …»). | `shortLabel` riconosce il civico e mostra «Luogo, Via 10, Città». | vitest `home-location-field.test.tsx`. |
| 20 | Soluzione precedente di un altro giorno: «33 h 13 min prima dell'inizio». | Per soluzioni di un altro giorno si mostra solo l'orario di arrivo. | vitest `result-panel.test.tsx`. |
| 21 | Mappa: chiave duplicata `station-Modena FS` (vista in `next dev`) quando un risultato vecchio veniva abbinato ai nuovi valori durante il caricamento. | Il percorso usa il risultato solo a calcolo concluso; `buildRoute` non disegna mai un treno tra la stessa stazione. | vitest `route-geometry.test.ts`; E2E su dev server da clone pulito: 8/8, nessun errore in console. |

## Limiti noti (non risolti in questa fase)

- **Domenica/festivo senza treni utili:** in `arrive_by` la soluzione «successiva» può essere un treno dello stesso giorno alle 22:xx, poco utile; il messaggio principale resta corretto.
- **55 note di calendario non interpretabili:** la corsa resta valida secondo i giorni strutturati e la UI mostra «Calendario da verificare» con la pagina del PDF. Non sono stati inventati significati.
- **Formato dei campi data/ora:** dipende dalla lingua del browser (`<input type="date">`); in Chromium headless appare in formato US anche con `locale=it-IT`.
- **Mappa:** il percorso è indicativo (linee rette), non un instradamento stradale; le durate vengono dall'API (OSRM).
- **Geocoding:** usa il servizio pubblico Nominatim (1 richiesta/s, solo su invio, mai autocompletamento). I risultati vanno scelti dall'utente: per esempio «Via Emilia San Pietro 10» ha restituito per primo un indirizzo in via Dante Alighieri.
