# Progetto UnimoreGo — Fase 0: Ricerca e Verifica
## Compito C: Sedi UNIMORE e Tempi del Primo e dell'Ultimo Tratto

- **Data di verifica e compilazione**: 23 ottobre 2026
- **Stato di completamento**: **SÌ** (Completato con successo; rilevata e documentata l'inaffidabilità dei profili pedonali del server demo OSRM pubblico, risolta mediante il servizio ufficiale della community OSM FOSSGIS).
- **Deliverable prodotti**:
  1. `data/locations.json`: 5 sedi UNIMORE geocodificate e verificate su sedime reale.
  2. `data/segments.json`: 5 segmenti completi con misurazioni a piedi, in bici, comparazione OSRM e valutazione di fattibilità.
  3. `data/STATUS_sedi.md`: questo documento di sintesi metodologica, licenza, limiti e checklist manuale.

---

## 1. Metodologia di Geocodifica e Verifica degli Edifici

### 1.1 Fonti Istituzionali degli Indirizzi
Gli indirizzi delle sedi universitarie sono stati estratti direttamente dai canali ufficiali dell'Ateneo UNIMORE:
- Portale generale di Ateneo: [https://unimore.it/it/dipartimenti](https://unimore.it/it/dipartimenti)
- Scuola di Ingegneria (SIST): [https://sist.unimore.it/it/la-scuola/dove-siamo](https://sist.unimore.it/it/la-scuola/dove-siamo)
- Dipartimento di Ingegneria "Enzo Ferrari" (DIEF): [https://www.ingmo.unimore.it/](https://www.ingmo.unimore.it/)
- Dipartimento di Educazione e Scienze Umane (DESU): [https://www.unimore.it/it/dipartimenti/des](https://www.unimore.it/it/dipartimenti/des)

### 1.2 Geocodifica Nominatim / OpenStreetMap
La geocodifica è stata eseguita una sola volta per ciascuna entità tramite l'API pubblica Nominatim di OpenStreetMap (`https://nominatim.openstreetmap.org/search`), attenendosi rigorosamente alla *Nominatim Usage Policy*:
- Intervallo di almeno 1,5 secondi tra richieste successive (limite policy: max 1 richiesta/sec).
- Header `User-Agent` descrittivo e identificativo del progetto accademico.
- Nessun caching massivo o scraping aggressivo.

### 1.3 Verifica sul Sedime dell'Edificio
Le coordinate restituite sono state verificate individualmente per accertare che cadessero esattamente sopra il sedime del corpo di fabbrica universitario e non su piazze generiche o frazioni omonime.

| ID | Nome Sede | Indirizzo Ufficiale | Città | Stazione di Riferimento | Coordinate (Lat, Lon) | Elemento OSM & Verifica |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`dief`** | Dipartimento di Ingegneria "Enzo Ferrari" (DIEF) | Via Pietro Vivarelli 10, 41125 | Modena | Modena FS | `44.6292268, 10.9492319` | `way/194635328` (`amenity=university`). Coordinate perfettamente centrate sul complesso didattico e laboratori MO-26/27. |
| **`palazzo_dossetti`** | Dip. Comunicazione ed Economia - Palazzo Dossetti | Viale Antonio Allegri 9, 42121 | Reggio Emilia | Reggio Emilia FS | `44.7023652, 10.6286549` | `way/168135047` (`building=university`, ex Caserma Zucchi). Coordinate cadono esattamente sull'edificio principale. |
| **`campus_san_lazzaro`** | Campus San Lazzaro - Padiglione Morselli (DISMI) | Via Giovanni Amendola 2, 42122 | Reggio Emilia | Reggio Emilia FS | `44.6875900, 10.6672109` | `way/167927475` (`building=yes`, Pad. Morselli all'interno del Campus `way/372676430`). Sede aule e laboratori DISMI. |
| **`economia_biagi`** | Dipartimento di Economia "Marco Biagi" | Via Jacopo Berengario 51, 41121 | Modena | Modena FS | `44.6500719, 10.9230943` | `way/167305594` (`amenity=university`, Foro Boario). Coordinate sul corpo storico del Foro Boario. |
| **`giurisprudenza`** | Dipartimento di Giurisprudenza (Complesso San Geminiano) | Via San Geminiano 3, 41121 | Modena | Modena FS | `44.6433902, 10.9259537` | `way/646579380` (`amenity=university`, ex Convento). Coordinate all'interno del chiostro/aule didattiche. |

---

## 2. Metodologia di Routing e Analisi dei Servizi

### 2.1 Criticità Rilevata: Server Demo OSRM (`router.project-osrm.org`)
Durante i test sul server demo OSRM pubblico (`http://router.project-osrm.org/route/v1/foot/...`), è emerso un comportamento critico che rende i suoi dati **inaffidabili** per la mobilità attiva:
- Il server demo `router.project-osrm.org` espone unicamente l'istanza con il profilo automobilistico (`car/driving`).
- Invocando URL con prefisso `/foot/` o `/bike/`, il server non applica pesi o velocità pedonali/ciclabili, ma restituisce il medesimo tracciato e la medesima durata automobilistica (velocità media ~30-37 km/h, circa 7,5 minuti per 4,3 km).
- **Conclusione**: usare `router.project-osrm.org` produrrebbe tempi palesemente falsati (sotto-stimati di un fattore da 3x a 7x per i pedoni). Tali valori sono stati registrati in `data/segments.json` come confronto esplicito con il flag `is_reliable: false`.

### 2.2 Servizio Adottato: FOSSGIS / OSM Community Routing
Per ottenere percorsi e tempi affidabili e fedeli alla rete reale, è stata utilizzata l'infrastruttura ufficiale della community OpenStreetMap gestita da FOSSGIS e.V., la stessa che alimenta il routing integrato su `openstreetmap.org`:
- **Profilo a piedi (`routed-foot`)**: `https://routing.openstreetmap.de/routed-foot/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`
  - Rete pedonale OSM: marciapiedi, piazze pedonali, attraversamenti semaforizzati, sentieri nei parchi universitari.
  - Velocità di calcolo: ~4,5 km/h (1,25 m/s), perfettamente in linea con la fisiologia della camminata urbana con bagaglio.
- **Profilo in bici (`routed-bike`)**: `https://routing.openstreetmap.de/routed-bike/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`
  - Rete ciclabile OSM: piste ciclabili protette, percorsi ciclopedonali, corsie riservate e strade residenziali a basso traffico.
  - Velocità nominale di crociera su ciclabile: ~15-23 km/h a seconda del manto stradale e delle precedenze.

---

## 3. Riepilogo Misurazioni e Tempi dei Segmenti

| ID Segmento | Origine | Destinazione | Distanza Aria (Haversine) | A Piedi (Distanza / Tempo) | In Bici (Distanza / Tempo) | OSRM Demo (Non affidabile) | Pedonale > 30 min? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`modena_fs_to_dief`** | Modena FS (Piazza Dante) | DIEF (Via Vivarelli 10) | 3.118 m | **3.926 m / 52,4 min** (4,49 km/h) | **5.433 m / 13,9 min** (23,39 km/h) | *4.318 m / 7,5 min (Auto)* | **SÌ (52 min)** |
| **`reggio_fs_to_palazzo_dossetti`** | Reggio FS (Piazza Marconi) | Palazzo Dossetti (Viale Allegri) | 1.236 m | **1.415 m / 18,9 min** (4,50 km/h) | **1.598 m / 5,9 min** (16,27 km/h) | *2.095 m / 4,6 min (Auto)* | **NO (19 min)** |
| **`reggio_fs_to_campus_san_lazzaro`**| Reggio FS (Piazza Marconi) | Campus San Lazzaro (Pad. Morselli) | 2.227 m | **2.653 m / 35,4 min** (4,50 km/h) | **2.687 m / 13,0 min** (12,40 km/h) | *2.874 m / 5,2 min (Auto)* | **SÌ (35 min)** |
| **`modena_centro_to_dief`** | Modena Centro (Piazza Grande 1) | DIEF (Via Vivarelli 10) | 2.630 m | **3.290 m / 44,0 min** (4,49 km/h) | **4.508 m / 13,3 min** (20,32 km/h) | *3.352 m / 6,0 min (Auto)* | **SÌ (44 min)** |
| **`modena_nord_to_dief`** | Modena Nord (Via Suore 100) | DIEF (Via Vivarelli 10) | 3.834 m | **4.841 m / 64,3 min** (4,52 km/h) | **6.357 m / 17,4 min** (21,97 km/h) | *5.068 m / 8,2 min (Auto)* | **SÌ (64 min)** |

---

## 4. Analisi Critica: Un percorso a piedi oltre i 30 minuti è realistico?

### 4.1 La soglia dei 30 minuti nella mobilità universitaria
Nella letteratura di pianificazione dei trasporti e nei modelli di scelta modale degli studenti universitari, la soglia di cammino accettabile per spostamenti quotidiani di routine è fissata tra **15 e 20 minuti** (circa 1,2 - 1,6 km). Spostamenti a piedi superiori a **30 minuti** (oltre 2,3 - 2,5 km a tratta):
1. **Comportano un costo fisico e temporale eccessivo**: camminare 45-65 minuti per raggiungere la lezione significa impegnare da 1,5 a oltre 2 ore al giorno solo nel cammino, spesso trasportando zaini pesanti con computer portatile e libri.
2. **Sono incompatibili con il meteo padano**: nebbia, piogge autunnali e calura estiva della Pianura Padana scoraggiano tragitti a piedi superiori a 20 minuti.
3. **Nel caso dei pendolari in treno (`modena_fs_to_dief`)**: i 52 minuti a piedi si sommerebbero ai 15-20 minuti di treno regionale e al tragitto casa-stazione a Reggio Emilia, portando il viaggio a oltre 90-100 minuti a tratta.

### 4.2 Valutazione specifica scenario per scenario

- **Scenario 1: `reggio_fs_to_palazzo_dossetti` (1,4 km — ~19 minuti)**
  - **Fattibilità a piedi**: **REALISTICO ED ECCELLENTE**.
  - Attraversa il centro storico pedonale di Reggio Emilia (Viale IV Novembre, Piazza del Monte, Parco del Popolo). È il tipico tragitto pendolare percorso regolarmente a piedi dagli studenti.

- **Scenario 2: `reggio_fs_to_campus_san_lazzaro` (2,65 km — ~35 minuti)**
  - **Fattibilità a piedi**: **AL LIMITE / POCO REALISTICO COME ROUTINE**.
  - Circa 35 minuti a tratta (70 min a/r). Fattibile occasionalmente, ma insostenibile ogni giorno. La bicicletta (13 min lungo la ciclabile di Via Emilia all'Ospizio) o l'autobus urbano sono di gran lunga preferiti.

- **Scenario 3: `modena_centro_to_dief` (3,3 km — ~44 minuti)**
  - **Fattibilità a piedi**: **NON REALISTICO**.
  - 44 minuti a piedi dal centro al campus Vignolese costringerebbero lo studente a uscire un'ora prima della lezione. A Modena, la bicicletta rappresenta il mezzo naturale (13-15 min su rete ciclabile pianeggiante).

- **Scenario 4: `modena_nord_to_dief` (4,8 km — ~64 minuti)**
  - **Fattibilità a piedi**: **TOTALMENTE IRREALISTICO**.
  - Oltre un'ora a piedi per attraversare Modena da nord a sud-est. A piedi non è una scelta modale credibile per uno studente; in bicicletta (17-20 minuti tramite i sottopassi ciclabili della ferrovia) è invece perfettamente sostenibile.

- **Scenario 5: `modena_fs_to_dief` (3,9 km — ~52 minuti)**
  - **Fattibilità a piedi**: **NON REALISTICO per il pendolare**.
  - 52 minuti di camminata dopo essere scesi dal treno vanificano il vantaggio del treno veloce tra le due città (il treno impiega 13-17 minuti, mentre l'ultimo miglio a piedi ne richiederebbe 52). L'uso della bici (propria, pieghevole o bike-sharing in stazione) è essenziale (14-17 min).

### 4.3 Raccomandazioni per il motore `engine/arrive_by.py`
1. Quando l'algoritmo rileva un percorso a piedi `duration_min > 30`, il motore deve:
   - Emettere un avviso chiaro: *"Tempo a piedi superiore a 30 min ({min} min): suggerito l'uso della bicicletta"*.
   - Offrire in prima battuta l'itinerario ciclabile se l'utente ha selezionato "bici" o "qualsiasi mezzo attivo".
2. Se l'utente impone lo spostamento solo a piedi, il motore calcola fedelmente l'orario di uscita anticipato (es. orario di arrivo 09:00 -> uscita ore 07:45 con 10 min di margine), ma segnala l'onerosità del tragitto.

---

## 5. Licenza dei Dati e Attribuzione Obbligatoria

I dati geografici, le coordinate e le geometrie dei percorsi derivano dal database OpenStreetMap e sono distribuiti sotto la licenza:
- **Licenza**: **Open Data Commons Open Database License (ODbL) 1.0**
- **Testo completo**: [https://opendatacommons.org/licenses/odbl/1-0/](https://opendatacommons.org/licenses/odbl/1-0/)
- **Attribuzione legale obbligatoria**:
  Ogni interfaccia o output di UnimoreGo che mostri o utilizzi dati OpenStreetMap (inclusa la mappa Leaflet e i tempi estratti da OSRM/Nominatim) deve riportare visibilmente la dicitura:
  > **"Dati cartografici © OpenStreetMap contributors, rilasciati sotto licenza ODbL"** con link attivo a `https://www.openstreetmap.org/copyright`.

---

## 6. Fonti Ufficiali Consultate

Tutte le fonti sono state verificate direttamente in data **23 ottobre 2026**:
1. **UNIMORE — Sedi e Dipartimenti**: [https://unimore.it/it/dipartimenti](https://unimore.it/it/dipartimenti)
2. **UNIMORE SIST — Sedi Scuola di Ingegneria**: [https://sist.unimore.it/it/la-scuola/dove-siamo](https://sist.unimore.it/it/la-scuola/dove-siamo)
3. **UNIMORE DIEF — Informazioni e contatti**: [https://www.ingmo.unimore.it/](https://www.ingmo.unimore.it/)
4. **OpenStreetMap Nominatim Geocoding API**: [https://nominatim.openstreetmap.org/](https://nominatim.openstreetmap.org/)
5. **FOSSGIS OpenStreetMap Routing Service (`routed-foot` & `routed-bike`)**: [https://routing.openstreetmap.de/](https://routing.openstreetmap.de/)
6. **Project OSRM Demo Server**: [http://router.project-osrm.org/](http://router.project-osrm.org/) (utilizzato per verifica e documentazione della mancata disponibilità dei profili attivi).

---

## 7. Limiti Tecnici Riscontrati

1. **Assenza di profili foot/bike sul demo server OSRM pubblico**: come illustrato al punto 2.1, `router.project-osrm.org` risponde sempre con tempi automobilistici, rendendo obbligatorio l'utilizzo delle istanze specializzate `routing.openstreetmap.de`.
2. **Ambivalenza toponomastica su Nominatim per le stazioni ferroviarie**: la ricerca generica "Stazione di Modena" seleziona una frazione collinare omonima a Pavullo; è necessario interrogare esplicitamente "Piazza Dante Alighieri, Modena" o specificare l'ID ferroviario.
3. **Assenza della rete di Trasporto Pubblico Locale (bus SETA)**: come stabilito dai vincoli di Fase 0 del progetto, il trasporto urbano su gomma non è modellato. Di conseguenza, tratte come Modena FS -> DIEF (3,9 km) risultano praticabili in tempi rapidi unicamente in bicicletta.

---

## 8. Cosa resta da verificare a mano (Checklist per la transizione alla Fase 1)

Prima di consolidare il motore applicativo nella Fase successiva, si raccomandano le seguenti verifiche sul campo:
- [ ] **Varchi e accessi effettivi al DIEF**: verificare se gli studenti accedono prevalentemente dal varco pedonale/ciclabile di Via Vivarelli 10 o dall'ingresso ciclabile collegato a Via Campi / Parco scientifico.
- [ ] **Parcheggi biciclette e velostazioni**: verificare la disponibilità e capienza delle rastrelliere sicure presso Modena FS (Piazza Dante e Porta Nord) e Reggio Emilia FS, per valutare se uno studente pendolare può lasciare una bicicletta "stazionaria" alla stazione di arrivo.
- [ ] **Velocità reale ciclabile urbana**: il profilo OSRM `routed-bike` calcola una velocità di crociera libera fino a 20-23 km/h; a livello pratico, tra intersezioni semaforizzate, rallentamenti e traffico promiscuo, la velocità media reale a Modena e Reggio Emilia si attesta tra **15 e 18 km/h** (suggerito applicare un coefficiente cautelativo del +15% sui tempi in bici in `arrive_by.py`).
- [ ] **Accessibilità disabili / P.E.B.A.**: accertare la continuità degli scivoli e l'assenza di barriere architettoniche sui marciapiedi dei segmenti identificati.
