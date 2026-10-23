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
| Lighthouse mobile — Performance | 89 | **95 / 98 / 95** (3 esecuzioni); build finale di rilascio: **91 / 93 / 97** |
| Lighthouse mobile — Accessibility | 96 | **100** (3/3) |
| Lighthouse mobile — Best Practices | 96 | **100** (3/3) |
| Lighthouse — FCP / LCP / TBT / CLS | 0,8 s / 2,2 s / 390 ms / 0,03 | 0,8 s / 2,2–2,3 s / 130–200 ms / **0**; build finale: 0,8–0,9 s / 2,2–2,4 s / 160–320 ms / **0** |
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

## Limiti noti del round 1

Stato aggiornato di ogni limite: vedi la tabella A del [round 2](#round-2--v05-v05-review).

- **Domenica/festivo senza treni utili:** in `arrive_by` la soluzione «successiva» può essere un treno dello stesso giorno alle 22:xx, poco utile; il messaggio principale resta corretto.
- **55 note di calendario non interpretabili:** la corsa resta valida secondo i giorni strutturati e la UI mostra «Calendario da verificare» con la pagina del PDF. Non sono stati inventati significati.
- **Formato dei campi data/ora:** dipende dalla lingua del browser (`<input type="date">`); in Chromium headless appare in formato US anche con `locale=it-IT`.
- **Mappa:** il percorso è indicativo (linee rette), non un instradamento stradale; le durate vengono dall'API (OSRM).
- **Geocoding:** usa il servizio pubblico Nominatim (1 richiesta/s, solo su invio, mai autocompletamento). I risultati vanno scelti dall'utente: per esempio «Via Emilia San Pietro 10» ha restituito per primo un indirizzo in via Dante Alighieri.

---

# Round 2 — v0.5 (`v0.5-review`)

Correzioni richieste in `P6_followup.txt` dopo la prova di v0.4-review da studente reale. Base:
`v0.4-review` (`7e6bbe7`), lavoro solo locale su `main`, **nessun push**. Tutti i numeri sotto
sono stati misurati il 23/10/2026 nel sandbox, sulla build di produzione (`next build && next
start`) collegata all'API v0.5.0.

## Numeri finali (D)

| Controllo | Risultato |
|---|---|
| pytest + coverage | **249 passed**, coverage **99 %** (soglia 90) — v0.4: 182 |
| ruff check / ruff format | puliti (71 file) |
| `tools/validate_data.py` | ALL DATASET VALIDATIONS PASSED (402 corse, 0 note non interpretabili) |
| `scripts/smoke.sh` | 8 controlli `ok`, exit 0 (contro l'API locale; anche contro il container, vedi A7) |
| vitest | **32 file, 159 test** passati — v0.4: 96 |
| tsc / eslint / prettier | puliti |
| `next build` | ok |
| E2E `scripts/e2e_ui.py` | casi UI == API **8/8**; flussi **4/4** (9 + 8 + 10 + 12 = 39 controlli); mobile **2/2** (375×667 e 414×896, 11 + 11 controlli); axe **7/7** stati |
| axe-core 4.14.0 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) | **0 violazioni** in 7 stati |
| Lighthouse 12.8.2 mobile (3 esecuzioni) | Performance **93 / 95 / 94**, Accessibility **100**, Best Practices **100** |
| Lighthouse FCP / LCP / TBT / CLS | 0,8 s / 1,1–2,3 s / 210–310 ms / **0** |

Lighthouse è stato eseguito con `npx -y lighthouse@12` e `CHROME_PATH` impostato sul Chromium
di Playwright (build 1248), con i flag `--headless=new --no-sandbox --disable-dev-shm-usage`.
È riuscito al primo tentativo dei due consentiti.

**Regressione trovata e corretta.** Le prime 3 esecuzioni davano Performance **79 / 78 / 75** con
**CLS 0,289**. L'elemento spostato era `#result`: nel layout v0.5 il modulo sta sopra il
risultato, e il suo scheletro di caricamento (4 righe) diventava il modulo vero (~900–980 px)
spingendo giù il risultato.
- **Correzione:** lo scheletro ha l'altezza misurata del modulo per fascia di larghezza (commit `1fea8d3`).
- **Dopo:** CLS 0, Performance 93–95.

## A. Punti aperti del round 1

| # | Problema | Stato | Correzione | Verifica |
|---|---|---|---|---|
| A1 | Arrive-by di domenica/festivi: proponeva un treno serale dello stesso giorno. | **fatto** | Causa radice: le tabelle dei quadri 1/2 del PDF non usano simboli di giorno, quindi il default «lun–ven» della Fase 1 toglieva tutti i treni festivi. Ora 402 corse estratte su tutti i giorni, con le note di calendario. Le alternative sono la stessa ora nel giorno feriale precedente/successivo, oppure un treno dello stesso giorno al massimo 60 min in ritardo; le soluzioni arrivano al massimo 120 min prima della lezione. | pytest `test_journeys.py::test_sunday_lesson_is_planned_without_a_sunday_warning`, `::test_far_lesson_late_train_is_replaced_by_next_working_day`, `::test_weekday_holiday_is_informational_and_has_trains`; API dom 25/10 Modena FS → Palazzo Dossetti 09:00 → RV 3902, esci alle 07:55. |
| A2 | 55 note di calendario non interpretabili. | **fatto** | Grammatica estesa (`AnyOf`/`AllOf`/`Not`, elenchi di termini, `edition_start`); estrattore `tools/trenitalia_pdf.py`. | Dati: 400 corse con nota (148 note distinte), **0 non interpretabili**. `validate_data` fallisce se una nota non è interpretabile. pytest `test_calendar_rules.py`. |
| A3 | Formato data/ora dipendente dalla lingua del browser. | **fatto (ora) / parziale (data)** | Ora: `TimeSelect` a 24 h, sempre HH:MM. Data: resta `<input type="date">` nativo (il selettore del sistema è il più usabile su mobile), ma sotto c'è la lettura in italiano («Lunedì 26 ottobre», badge «Oggi», «Torna a oggi»). | vitest `time-select.test.tsx`, `plan-form.test.tsx`; E2E flussi B2. |
| A4 | Nominatim: «Via Emilia San Pietro 10» restituiva prima via Dante Alighieri. | **fatto** | I risultati sono riordinati per parole della via digitata; tipo di strada, regione, paese e CAP sono ignorati. | pytest `api/test_geocode.py` con le 10 risposte reali di Nominatim del 23/10. |
| A5 | Mappa: percorso in linea d'aria, non stradale. | **non fatto** | Motivo: un instradamento stradale richiederebbe un servizio di routing esterno chiamato dal browser (i server pubblici OSRM/FOSSGIS sono demo con limiti d'uso; gli altri richiedono una chiave, escluso dal brief). Le durate restano quelle OSRM dell'API. La mappa ora lo dichiara: «Linea indicativa in linea d'aria: non è il percorso stradale». | Nessun test specifico per la didascalia (testo statico in `map-panel.tsx`). |
| A6 | `scripts/smoke.sh` obsoleto (corpo di richiesta vecchio, nessun controllo delle risposte). | **fatto** | Invia il corpo v0.5 e verifica le risposte (andata 07:39, ritorno 13:33, dom 25/10, 20/12 fuori validità); exit ≠ 0 al primo errore. | 8 controlli `ok`, exit 0. |
| A7 | Docker mai provato. | **fatto** | — | `docker-compose build` ok (immagini api 163 MB, web 834 MB); `up -d`: API *healthy*, web pronto. `smoke.sh` superato contro il container; `/` → 200; preflight CORS da `http://localhost:3000` → 200. |
| A8 | Verifica da clone pulito. | **parziale** | Il clone pulito di `main` conserva i permessi di `scripts/*.sh`. | **Verificato:** dopo il reset del sandbox, `npm ci` dal lockfile committato su `node_modules` vuota è riuscito, e tutti i test sono girati su quell'installazione. **Non verificato:** `npm ci` *dentro* un secondo clone in `/tmp`, terminato due volte con exit 137 (memoria: il sandbox ha 2 GB e API e sito erano attivi). |

## B. Bug della revisione utente

| # | Problema | Stato | Correzione | Verifica |
|---|---|---|---|---|
| B1 | Dom 25/10, Modena FS → Palazzo Dossetti, 09:00: «Nessun treno utile per arrivare entro le 08:31» incomprensibile. | **fatto** | Due cause. (1) Mancavano i treni festivi (vedi A1): ora c'è RV 3902. (2) Il conto non era spiegato: `calculation.summary` lo mostra nel risultato e nell'avviso. | API: «Calcolo: lezione alle 09:00 − 10 min di anticipo − 19 min a piedi dalla stazione alla sede = arrivo a Reggio Emilia FS entro le 08:31.» Conto verificato: 09:00 − 10 − 19 = 08:31; Palazzo Dossetti è a Reggio Emilia. pytest `test_notices.py`, `test_journeys.py`; E2E flusso «B1 + B3» 8/8. |
| B2 | All'apertura c'era già un risultato non richiesto. | **fatto** | Nessun calcolo finché non si preme Calcola o si apre un link completo. Dopo il reload restano sede, stazione, modo e anticipo; la data è oggi con il badge «Oggi». | vitest `planner-shell.test.tsx`, `use-planner-values.test.tsx`, `preferences-store.test.ts`; E2E flusso «B2 + B3» 9/9 (0 risultati all'apertura, preferenze dopo il reload). |
| B3 | Stato non nell'URL; nessuna condivisione. | **fatto** | `url-state` (`sede`, `stazione`/`partenza=casa`, `data`, `ora`, `mezzo`, `verso`, `ritorno`), con validazione campo per campo. Ogni ricerca va nella cronologia; Indietro/Avanti/Ricarica rifanno il calcolo. «Copia link» e «Condividi» (Web Share, con la copia come alternativa). Un link condiviso non sovrascrive le preferenze. | vitest `url-state.test.ts`, `share.test.ts`, `use-history-search.test.tsx`, `result-actions.test.tsx`; E2E Back/Forward/Reload e link copiato. |
| B4 | Avvisi duplicati (20/12: fuori validità + domenica + «orario vale fino al»). | **fatto** | `engine/notices.py`: priorità (fuori validità 100 > nessun treno 90 > nota di calendario 70 > casa lontana 60 > … > non in tempo reale 10) e regole di fusione. La UI mostra un solo avviso principale. | pytest `test_notices.py`, `test_journeys.py::test_out_of_validity_sunday_has_one_primary_notice`. API 20/12: `out_of_validity` + `not_realtime` e «Stessa ora di lezione, sabato 12/12/2026 (giorno feriale precedente)». E2E: 1 avviso. |
| B5 | Selettore sede: bisognava cancellare il testo per vedere le altre sedi. | **fatto** | Combobox ARIA 1.2: al focus/click mostra tutte e 5 le sedi anche con un valore già scelto; frecce, Invio, Esc; il filtro parte solo quando si digita. | vitest `campus-search.test.tsx`; E2E: 5 opzioni nel listbox «Sedi UNIMORE» al focus. |
| B6 | Mappa sotto il form, senza zoom né etichette. | **fatto** | Mappa sotto il risultato (ordine DOM: modulo → risultato → mappa → orario). `fitBounds` con margini calcolati sulle etichette; marker etichettati «Casa», «Stazione partenza · …», «Stazione arrivo · …», «Sede · DIEF»; treno continuo, tratti a piedi/in bici tratteggiati, legenda. | vitest `route-geometry.test.ts`; E2E: etichette attese ed etichette tutte dentro la cornice della mappa. |

## C. Miglioramenti UX

| # | Richiesta | Stato | Correzione | Verifica |
|---|---|---|---|---|
| C1 | Più stazioni solo con orari verificabili; altrimenti dichiarare la copertura. | **fatto** | Aggiunta **Rubiera**: orari dal PDF Trenitalia (quadro 1, con pagina), coordinate da OSM (nodo 13769327683, UIC 8305031), validità 17/10–12/12/2026, tutto citato in `data/SOURCES.md`. Altre fonti valutate (GTFS TPER, NAP ER L1–L3, Mobility Database) non coprono la relazione o non hanno orari: non usate (`docs/research/STATUS_treni.md`). La home mostra «Stazioni coperte: Reggio Emilia FS · Rubiera · Modena FS». | `validate_data`; vitest `plan-form.test.tsx`. |
| C2 | Link a ViaggiaTreno/infomobilità con il numero del treno e la nota «non in tempo reale». | **fatto (senza link per singolo treno)** | Riquadro con il numero del treno, «Copia numero» e i link a ViaggiaTreno (infomobilità) e alle notizie di infomobilità Trenitalia. Nota «Orari programmati, non in tempo reale». Nessuna API a pagamento o con chiave. | vitest `realtime-links.test.ts`, `result-notices.test.tsx`. URL verificati con risposta 200. |
| C3 | «Calcola il ritorno» con le stesse impostazioni; vista andata + ritorno. | **fatto** | Pulsante nel risultato con orario di fine lezione; il ritorno è mostrato sotto l'andata ed è salvato nell'URL (`ritorno=`). | vitest `return-trip.test.tsx`; E2E flusso «C3 + C6» 10/10: fine 13:00 → parti alle 13:33. |
| C4 | Domenica/festivi senza treni: proporre il giorno feriale precedente/successivo. | **fatto** | Alternative `nearby` con etichetta spiegata («Stessa ora di lezione, sabato 12/12/2026 (giorno feriale precedente)»). | pytest `test_journeys.py::test_far_lesson_late_train_is_replaced_by_next_working_day`, `::test_far_future_date_offers_the_last_covered_working_day`; vitest `result-panel.test.tsx`; API 20/12 (vedi B4). |
| C5 | Durata porta a porta, numero di cambi, spiegazione di «anticipo» e «tempo in stazione». | **fatto** | `duration_min` e `changes` dall'API; nel risultato le voci «Porta a porta» (es. 39 min per RE FS → DIEF, 26/10, 08:30) e «Cambi» («Nessuno · treno diretto»); toggletip accessibili «?» (bottone, Esc chiude, allineati per non uscire dallo schermo a 375 px). | pytest `test_itinerary_builder.py`; vitest `help-tip.test.tsx`, `result-panel.test.tsx`, `itinerary-summary.test.ts`. |
| C6 | «Aggiungi al calendario» (.ics) per «Esci alle». | **fatto** | `.ics` generato nel browser: UTC, CRLF, righe piegate a 75 ottetti, promemoria 10 min prima, titolo con il nome breve della sede. | vitest `ics.test.ts`; E2E: download `unimorego-2026-10-26-0739.ics` controllato byte per byte. |
| C7 | Mobile 375×667 e 414×896, niente scroll orizzontale, test e2e. | **fatto** | Risultato e mappa subito sotto il pulsante; scroll al risultato dopo Calcola; toggletip senza overflow. | E2E mobile 2/2 (11 + 11 controlli: `scrollWidth ≤ larghezza`, risultato visibile dopo il tocco, mappa sotto il risultato, help aperto senza overflow). |

## D. Chiusura

| Requisito | Stato |
|---|---|
| pytest con coverage ≥ 90 | **fatto**: 249 passed, 99 % |
| vitest | **fatto**: 159/159 |
| e2e incluso mobile | **fatto**: 8/8 + 4/4 + 2/2 + axe 7/7 |
| ruff, eslint, tsc, prettier | **fatto**: puliti |
| axe 0 violazioni | **fatto**: 0 in 7 stati |
| Lighthouse mobile ≥ 90 | **fatto**: 93 / 95 / 94 (dopo la correzione del CLS) |
| CHANGELOG, README IT+EN, questa sezione | **fatto** |
| Tag `v0.5-review`, bundle `unimore-go-v0.5-review.bundle`, preview riavviata | **fatto** |
| Nessun push | **rispettato**: nessun remote usato |

## Limiti noti dopo il round 2

- **Mappa in linea d'aria** (A5): il motivo è nella tabella A.
- **ViaggiaTreno senza link per singolo treno** (C2): il formato URL non è documentato ufficialmente, quindi si copia il numero.
- **Copertura:** solo Reggio Emilia FS, Rubiera e Modena FS, con orari validi fino al 12/12/2026. Dopo quella data l'app avvisa e propone l'ultimo giorno coperto; per l'orario invernale serve una nuova estrazione dal PDF.
- **`npm ci` in un secondo clone** non eseguito per limiti di memoria del sandbox (A8).
- **Lighthouse TBT** 210–310 ms: dentro la soglia del punteggio, ma è la voce che pesa di più. Il JavaScript non usato è soprattutto Leaflet, già caricato solo quando la mappa entra in vista.
- **Nominatim** resta un servizio pubblico con limiti d'uso (1 richiesta/s, solo all'invio).
