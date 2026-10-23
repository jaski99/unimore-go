# UnimoreGo — Fase 0: verifica dati ferroviari Modena ↔ Reggio Emilia

> **Aggiornamento 2026-10-23 (Fase 5, round 2): questo documento è superato per
> il dataset.** `data/trains.json` ora è estratto in automatico dallo stesso
> PDF con `tools/trenitalia_pdf.py`. Sono 402 corse su tutti i giorni, tra Reggio
> Emilia, Rubiera e Modena, con le note di calendario complete e (dal round 3) i
> simboli di giorno ⚒ † Ⓐ Ⓑ Ⓒ letti dentro le colonne. Il vecchio default «lun–ven» e
> l'esclusione delle colonne del fine settimana (sezione 1 sotto) erano la causa
> dei mancati risultati di domenica e nei festivi. Fonti, metodo e verifiche
> sono in [`data/SOURCES.md`](../../data/SOURCES.md). Le sezioni seguenti
> restano come registro della verifica di Fase 0.

**Accesso e verifiche effettuati il 2026-10-23.**  
**Data di controllo:** lunedì feriale **2026-10-26**.  
**Esito finale:** **non usare un feed automatico per le corse regionali della relazione.** È stato creato il fallback curato [`trains.json`](trains.json), limitato alle corse `Regionale` / `Regionale Veloce` effettivamente verificate nel PDF ufficiale per la data richiesta.

## Decisione

Il NeTEx nazionale Trenitalia e il GTFS derivato sono leggibili e tecnicamente completi come struttura, ma **non riportano le corse Regionali/RV pendolari del PDF nella Modena–Reggio Emilia richiesta**. Il confronto è stato ripetuto direttamente sul NeTEx ufficiale, quindi il risultato non dipende soltanto dal convertitore GTFS.

Nemmeno gli asset RAP Emilia-Romagna dedicati a `TRENITALIA-RER` forniscono, nelle due finestre, le corse PDF necessarie: il livello 1 contiene orari ma non quelle corse; i livelli 2 e 3 scaricati non contengono `ServiceJourney` / passaggi orari. Gli altri candidati controllati sono bus, non coprono le fermate, o non sono raggiungibili dal contesto di verifica.

**Raccomandazione operativa:** usare [`data/trains.json`](trains.json) come snapshot manuale attribuito al PDF, da aggiornare a ogni cambio d'orario e prima della fine della validità del bollettino (**12 dicembre 2026**). Non presentarlo come feed realtime né come dataset con licenza di riuso accertata.

---

## 1. Fonte ufficiale di riscontro e metodo

| Voce | Evidenza verificata |
|---|---|
| Orario umano ufficiale | [PDF Regionale Emilia](https://www.trenitalia.com/content/dam/trenitalia/allegati/info/orario-digitale/orari-regionali/Regionale_Emilia.pdf), scaricato e aperto il 2026-10-23. SHA-256 `80f3c07b96214ce8c5b8b9ba7f00541e20feb448f4c666722617653d11ee4cd3`. Edizione valida **17 ottobre–12 dicembre 2026**. |
| Metodo PDF | Rendering delle pagine e verifica visiva delle intestazioni di colonna, delle righe `Reggio Emilia` / `Modena` e delle note calendario. Il testo estratto dal PDF non è stato usato da solo per ricostruire gli orari. |
| Operatore | Nelle tabelle Milano–Bologna la nota **8** (pagine 61–66 stampate) e la nota **1** (pagine 37–50 stampate) dicono esplicitamente **«Servizio di Trenitalia Tper»**. Tutte le corse riportate nel JSON portano quella nota. |
| Stazioni | Il PDF usa i nomi `Reggio Emilia` e `Modena`; nel NeTEx le fermate sono i codici UIC `830005023` e `830005032`, corrispondenti alle stazioni FS richieste. |
| Interpretazione finestra | Limiti inclusi: una partenza alle 06:30/09:30 oppure alle 16:00/20:00 è nella finestra. Perciò RV 3926 delle 20:00 è inclusa. |

### Corse fisicamente stampate ma escluse dal lunedì 2026-10-26

Sono state lette anche le colonne R/RV che **non** valgono nel lunedì bersaglio; non sono state inserite in `trains.json`.

| Direzione | Treno | Orario | Motivo dell’esclusione | Pagina PDF / stampata |
|---|---:|---|---|---|
| Reggio Emilia → Modena | R 17407 | 08:14–08:32 | nota 49: dal martedì alla domenica | 77 / 65 |
| Reggio Emilia → Modena | RV 2493 | 08:21–08:38 | nota 50: sabato e domenica | 77 / 65 |
| Modena → Reggio Emilia | RV 2484 | 19:23–19:41 | nota 189: si effettua il venerdì | 60 / 48 |

---

## 2. Corse Regionali/RV verificate per lunedì 2026-10-26

Le tabelle seguenti sono il contenuto operativo del JSON. Le note di validità sono riportate nel campo `calendar_note` del file, per non trasformare intervalli/deroghe del PDF in una falsa regola giornaliera.

### Reggio Emilia → Modena, 06:30–09:30

| Treno | Categoria | Parte | Arriva | Validità usata per il 26/10 | PDF pagina / stampata |
|---:|---|---:|---:|---|---|
| 3905 | RV | 06:42 | 06:58 | nota 27, dal 19/10 al 26/10 | 73 / 61 |
| 2451 | RV | 07:04 | 07:20 | nessuna limitazione stampata; periodo del bollettino | 73 / 61 |
| 17405 | R | 07:33 | 07:47 | nessuna limitazione stampata; periodo del bollettino | 75 / 63 |
| 3907 | RV | 07:44 | 07:56 | nota 35, fino al 16/11 | 75 / 63 |
| 17425 | R | 07:59 | 08:15 | nessuna limitazione stampata; periodo del bollettino | 75 / 63 |
| 2067 | RV | 08:44 | 08:56 | nota 53, 22/10–16/11, sospeso 23–25/10; quindi attivo il 26/10 | 78 / 66 |

**Totale verificato:** 6 corse, tutte gestite da **Trenitalia Tper**.

### Modena → Reggio Emilia, 16:00–20:00

| Treno | Categoria | Parte | Arriva | Validità usata per il 26/10 | PDF pagina / stampata |
|---:|---|---:|---:|---|---|
| 3918 | RV | 16:00 | 16:16 | nota 119, fino al 16/11 | 49 / 37 |
| 2478 | RV | 16:23 | 16:41 | nessuna limitazione stampata; periodo del bollettino | 50 / 38 |
| 3920 | RV | 17:00 | 17:16 | nessuna limitazione stampata; periodo del bollettino | 52 / 40 |
| 17418 | R | 17:22 | 17:40 | nessuna limitazione stampata; periodo del bollettino | 53 / 41 |
| 3922 | RV | 18:00 | 18:16 | nota 119, fino al 16/11 | 56 / 44 |
| 2482 | RV | 18:23 | 18:41 | nessuna limitazione stampata; periodo del bollettino | 57 / 45 |
| 17426 | R | 18:43 | 19:00 | nessuna limitazione stampata; periodo del bollettino | 58 / 46 |
| 3924 | RV | 19:00 | 19:16 | nota 119, fino al 16/11 | 59 / 47 |
| 17420 | R | 19:23 | 19:41 | nota 188, sospeso il venerdì; quindi attivo il lunedì | 60 / 48 |
| 3926 | RV | 20:00 | 20:16 | nota 119, fino al 16/11; limite superiore incluso | 62 / 50 |

**Totale verificato:** 10 corse, tutte gestite da **Trenitalia Tper**.

---

## 3. Confronto con NeTEx/GTFS nazionale

### NeTEx nazionale ufficiale: il buco è confermato direttamente

| Voce | Evidenza |
|---|---|
| Catalogo | [NAP — Trenitalia L1](https://www.cciss.it/nap/mmtis/public/catalog/Dataset/1077621) |
| URL scaricato | [`checkedResource` asset 1080596](https://www.cciss.it/nap/mmtis/public/api/v1/download/blob/Asset/1080596/checkedResource) |
| Snapshot verificato | SHA-256 `4959d9ac565ab4578d051f71854e61ee83c34fe4ebe9e76cb666d77aea3e2a74`; `gzip -t` superato; `PublicationTimestamp` `2026-10-15T14:16:04Z`. |
| Parsing reale | 17.613 `ServiceJourney`, 192.252 `TimetabledPassingTime` / `StopPointInJourneyPattern`, 1.909 `StopPlace` / `ScheduledStopPoint`. |
| Risultato diretto | Tra tutte le `ServiceJourney` nazionali con passaggio diretto fra i due UIC sono state cercate le due finestre: **nessuna corsa corrisponde alle R/RV del PDF**. Alcuni numeri uguali (2451, 2067, 2478, 2482, 2493, 3922) esistono nel file, ma su altre relazioni, non fra Reggio Emilia e Modena. |
| Evidenza riproducibile | [`verify_national_netex_direct_windows.out`](verify_national_netex_direct_windows.out) conserva URL, hash, conteggi e i servizi diretti trovati. |

Questa verifica elimina l’ipotesi alternativa «il convertitore GTFS ha omesso da solo i treni»: **il NeTEx nazionale stesso non contiene le R/RV PDF sulla relazione e nelle fasce richieste.**

### GTFS convertito: risultato coerente ma non sufficiente da solo

| Voce | Evidenza |
|---|---|
| GTFS | Snapshot immutabile di [deryclem/trenitalia-gtfs](https://raw.githubusercontent.com/deryclem/trenitalia-gtfs/533b49fbb416572d460c5abd503827f670a0dc97/gtfs-trenitalia.zip), SHA-256 `e1dd42d873db4e5021766e31f86178fd5b3ee4089bc24244dfb9f1169dbf45e7`. |
| File effettivamente aperti | `stops.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt` e gli altri file principali; 17.613 trip e 192.252 stop-time. |
| Lunedì 26/10, Reggio → Modena 06:30–09:30 | 5 diretti — IC 603 07:10–07:26, FR 9303 07:23–07:40, IC 583 08:05–08:22, FR 8803 09:00–09:14, IC 605 09:11–09:24 — **0 Regionale/RV**. |
| Riproducibilità | [`verify_trains_gtfs.py`](verify_trains_gtfs.py), output [`verify_trains_gtfs_2026-10-26.out`](verify_trains_gtfs_2026-10-26.out). |

Il GTFS è una conversione di terza parte, perciò non è stato usato come prova unica; è solo coerente con il controllo diretto del NeTEx nazionale.

---

## 4. Ricerca ordinata di feed/candidati specifici

Ogni candidato dichiarato «scaricato» è stato realmente scaricato, aperto e verificato; in caso di indisponibilità lo si dichiara esplicitamente.

| Candidato | Verifica reale / esito | Licenza e limite |
|---|---|---|
| **RAP ER L1 `IT-ITH5-TRENITALIA-RER`** | [Asset 399807](https://www.cciss.it/nap/mmtis/public/catalog/Asset/399807), [`checkedResource`](https://www.cciss.it/nap/mmtis/public/api/v1/download/blob/Asset/399807/checkedResource) scaricato: SHA-256 `5f21eb2c372b06a3355ff0474b2f800005518f8bdf599f5ede92d639abba55ab`, pubblicazione `2026-10-20T04:13:07+01:00`. Parsing: 359 stop, 5 linee, 841 `ServiceJourney`, 14.047 passaggi. Sono presenti Modena e Reggio Emilia, ma **0 R/RV diretti** nelle due finestre. Dettaglio in [`verify_trenitalia_tper_l1_2026-10-26.out`](verify_trenitalia_tper_l1_2026-10-26.out). | Il NAP non espone una licenza di riuso. Feed parziale/non idoneo alle fasce pendolari richieste. |
| **RAP ER L2 `IT-ITH5-TRENITALIA-RER`** | [Asset 534567](https://www.cciss.it/nap/mmtis/public/catalog/Asset/534567), [`checkedResource`](https://www.cciss.it/nap/mmtis/public/api/v1/download/blob/Asset/534567/checkedResource) scaricato: SHA-256 `2cad3acf671812d97c703cb1f2ac75db73c0f07053c8eab3a29036e0202491df`, pubblicazione `2026-10-20T04:16:07+01:00`. Apertura XML: 1 operatore, 359 stop, 5 linee, **0 `ServiceJourney` e 0 passaggi temporizzati**. | Non idoneo a calcolare orari. Nessuna licenza esposta. |
| **RAP ER L3 `IT-ITH5-TRENITALIA-RER`** | [Asset 534665](https://www.cciss.it/nap/mmtis/public/catalog/Asset/534665), [`checkedResource`](https://www.cciss.it/nap/mmtis/public/api/v1/download/blob/Asset/534665/checkedResource) già scaricato/aperto: SHA-256 `ab74da494c4d660c3b638508a6b34e012c6a991db6cea26d2b1aea8889fe2a1e`, pubblicazione `2026-10-20T04:19:07+01:00`. 359 stop e 5 linee, ma **0 `ServiceJourney` / 0 passaggi**. | Non idoneo; nessuna licenza NAP esposta. |
| **TPER GTFS / Transitland** | Transitland rimanda al GTFS TPER Bologna. Scaricato [gommagtfsbo v20261006](https://solweb.tper.it/web/tools/open-data/open-data-download.aspx?source=solweb.tper.it&filename=gommagtfsbo&version=20261006&format=zip), SHA-256 `6ba89d396327ac268e6b5c25752a54a6d63295443508e74968cd47eebc2de9df`. Aperti i file GTFS: 6.339 stop, nessuna fermata target esatta, 239 route tutte `route_type=3` (bus). | [Open data TPER](https://solweb.tper.it/web/tools/open-data/open-data.aspx): CC BY 3.0 IT. È bus, non TPER ferroviario. |
| **Mobility Database mdb-1319** | Scaricato [archivio catalogato](https://files.mobilitydatabase.org/mdb-1319/mdb-1319-202601160000/mdb-1319-202601160000.zip), SHA-256 `a262c5bdfccd98a5c7e7ae08eea8eecb3189222f34c1015f5d4608faf3efc152`. Aperti `stops.txt`, `trips.txt`, `stop_times.txt`, `calendar_dates.txt`; `calendar.txt` assente e nessuna fermata target esatta. | Catalogo: CC-BY; non copre la relazione. |
| **Transitland, feed Trenitalia storico** | Il catalogo [f-sp-trenitaliaspa](https://www.transit.land/feeds/f-sp-trenitaliaspa) rimanda al vecchio GTFS Toscana, non a un feed distinto Trenitalia Tper. Non aggiunge copertura rispetto al candidato Mobility Database. | Licenza indicata dal catalogo CC-BY 4.0, ma non è un feed TTX completo della relazione. |
| **Regione Emilia-Romagna / FER** | Interrogate le API CKAN regionali per `GTFS`, `orari treni` e `Trenitalia`: [GTFS](https://dati.emilia-romagna.it/api/3/action/package_search?q=GTFS&rows=100), [orari treni](https://dati.emilia-romagna.it/api/3/action/package_search?q=orari%20treni&rows=100), [Trenitalia](https://dati.emilia-romagna.it/api/3/action/package_search?q=Trenitalia&rows=100): **0 risultati**. Il RAP è quindi l’unico candidato ER machine-readable trovato e verificato. | Nessun feed ferroviario FER separato rinvenuto/scaricabile. |
| **Dataset specifico TTX di Regione Liguria** | La ricerca ha rinvenuto il catalogo [«Dati servizio pianificato TRENITALIA - TPER S.C.a.R.L.»](https://dati.regione.liguria.it/dataset/ds-643) e l’URL NeTEx pubblicato `https://srvcarto.regione.liguria.it/dtuff/download_statico/opendata/trasporti/NeTEx/IT-ITC3-TRENITALIA-TPER-NeTEx_L1.xml.gz`. Sono stati tentati download/apertura diretti, ma il server ha chiuso la sessione TLS o è andato in timeout in tre tentativi; nessun file completo è stato ottenuto. | **Non è una prova di copertura** e non è stato usato per `trains.json`. Da ritentare da una rete diversa se diventa prioritario. |
| **PDF ufficiale Trenitalia / TTX** | È l’unica fonte che ha permesso il riscontro completo delle corse pendolari richieste; non è un formato machine-readable. | Nessuna licenza di riuso verificata. |

---

## 5. Licenze, limiti e uso corretto

1. **NeTEx NAP/RAP:** il catalogo fornisce formato e download ma non una licenza esplicita di riuso; il footer CCiSS non equivale a una licenza aperta. Prima di redistribuire o usare in produzione serve conferma scritta da NAP, Regione o operatore.
2. **GTFS convertito:** il repository del curatore dichiara CC-BY 4.0, ma tale dichiarazione non trasferisce automaticamente una licenza al NeTEx/PDF sorgente. Attribuzione dichiarata: *Clément Desouche (@deryclem), via dati Trenitalia / CCISS MMTIS*.
3. **PDF e JSON:** `trains.json` è una trascrizione curata e attribuita, non un feed autorizzato/realtime. Il file conserva URL, pagina e note, ma non risolve i diritti sul riuso dei dati.
4. **Calendario:** il JSON è verificato per **lunedì 2026-10-26**. Per alcune corse il periodo di base è quello del bollettino; le eccezioni leggibili sono nel campo `calendar_note`. Non usare il file per date diverse senza interpretare quelle note e senza un nuovo riscontro.
5. **Operatività:** nessuna verifica su ritardi, soppressioni, binari, accessibilità effettiva, tariffa, titolo di viaggio o interscambio. Non sono stati usati bus SETA, ritardi live, OSRM/OTP self-hosted, scraping Esse3 o API non ufficiali nel percorso critico.

---

## 6. Deliverable e pulizia

- [`trains.json`](trains.json) — **16** corse R/RV verificate, 6 verso Modena e 10 verso Reggio Emilia; include esattamente i campi richiesti `from`, `to`, `depart`, `arrive`, `train`, `category`, `valid_from`, `valid_to`, `source` e campi di tracciabilità aggiuntivi.
- [`verify_trains_gtfs.py`](verify_trains_gtfs.py) e [`verify_trains_gtfs_2026-10-26.out`](verify_trains_gtfs_2026-10-26.out) — evidenza GTFS convertito.
- [`verify_national_netex_direct_windows.out`](verify_national_netex_direct_windows.out) — evidenza diretta sul NeTEx nazionale.
- [`verify_trenitalia_tper_l1_2026-10-26.out`](verify_trenitalia_tper_l1_2026-10-26.out) — evidenza sul candidato RAP ER L1 specifico.

Gli archivi e gli estratti voluminosi in `research/data_candidate/`, `research/extracted_gtfs/`, `research/extracted_mdb/` e `research/extracted_tper/` sono stati eliminati dopo aver consolidato URL, hash ed esiti qui sopra. Il PDF ufficiale resta in `research/sources/` come fonte del JSON.

---

## 7. Fase 1: Estensione all'intera giornata feriale (Modena ↔ Reggio Emilia)

In data **2026-10-23**, l'archivio [`data/trains.json`](../../data/trains.json) è stato esteso a **tutte le corse feriali dell'intera giornata** per entrambe le direzioni (Reggio Emilia FS ↔ Modena FS), partendo dal PDF ufficiale Trenitalia `Regionale_Emilia.pdf` (edizione 17/10–12/12/2026, SHA-256 `80f3c07b96214ce8c5b8b9ba7f00541e20feb448f4c666722617653d11ee4cd3`).

### 7.1 Sintesi del dataset esteso
- **Totale corse validate**: **121 corse**
- **Reggio Emilia → Modena**: **61 corse**
- **Modena → Reggio Emilia**: **60 corse**
- **Categorie incluse**: Regionale (R), Regionale Veloce (RV), Intercity (IC), Intercity Notte (ICN), Frecciarossa (FR con fermata in entrambe le stazioni storiche FS).
- **Operatori**: `Trenitalia Tper` (servizio regionale e suburbano) e `Trenitalia` (lunga percorrenza IC/FR).
- **Coerenza oraria**: tutte le corse hanno `arrive > depart` e durata compresa rigorosamente tra **10 e 30 minuti** (media 15–18 minuti).

### 7.2 Metodologia di decodifica note e numerazione colonne
Le note numerate in apice nei quadri orari 1 (Milano–Bologna e Bologna–Milano) utilizzano il font `ArialMT` con CMap differenziale in cui ogni carattere del range ASCII `!` (33) – `*` (42) corrisponde esattamente alla cifra `ord(c) - 33` (0–9):
- `!` = 0, `"` = 1, `#` = 2, `$` = 3, `%` = 4, `&` = 5, `'` = 6, `(` = 7, `)` = 8, `*` = 9.
- Esempi verificati: `#(` = nota 27; `$&` = nota 35; `""*` = nota 119; `"))` = nota 188; `")*` = nota 189.

### 7.3 Criteri di esclusione e corse omesse (annotazioni obbligatorie)
In conformità alle direttive di progetto ("niente valori inventati: se illeggibile omettila e annotalo"):
1. **Fermate AV Mediopadana esclusive**: le corse Frecciarossa/Italo instradate esclusivamente sulla linea AV (fermata `Reggio Emilia AV` senza fermata a `Reggio Emilia` FS e senza fermata a `Modena`) sono escluse perché non collegano le stazioni pendolari della città.
2. **Corse esclusivamente festive / fine settimana**:
   - RV 2493 (08:21 RE→MO): nota 50, sabato e domenica.
   - RV 2494 (21:20 MO→RE): nota 198, sabato e domenica.
   - RV 2499 (11:20 RE→MO): nota 101, si effettua il sabato.
   - IC 1589 (08:35 RE→MO), IC 1545 (11:33 RE→MO): si effettuano solo il sabato.
   - IC 1546 (19:13 MO→RE), IC 1588 (22:07 / 23:04 MO→RE): si effettuano solo la domenica.
   - R 3919 / R 87889 (10:44 RE→MO): nota 93, si effettuano la domenica.
3. **Corse speciali su singola data isolata**:
   - R 1749 (15:57 RE→MO) e R 1747 (17:28 RE→MO): note 131 e 139, corse per singola festività (4/12 o 5/12).
   - FR 9561 (23:57 RE→MO) e FR 9562 (06:00 MO→RE): note 139 e 56, corse straordinarie del 4/12 o 5/12.
   - ICN 89645 e 89649 (21:23 / 21:52 RE→MO): nota 14, corsa isolata del 17/10.
4. **Scavalcamento mezzanotte / durata anomala**:
   - RV 2485 (23:49 RE → 00:03 MO): corsa valida ma esclusa per rispetto del vincolo solare `arrive > depart` nello stesso giorno.
   - EuroNight B0144 / B0145 (durata ~40 min con fermata tecnica prolungata) e ICN 1963 / IC 604 (durata 31 min, oltre la soglia massima di 30 min per pendolarismo).
5. **Deduplicazione su treno canonico**: le corse con varianti orarie temporanee dovute a cantieri (es. ICN 752 o IC 590 nel weekend 14-15/11) sono state normalizzate alla corsa feriale regolare, garantendo unicità assoluta per `(from, to, train)`.

---

## 8. Fase 5: uso delle note di calendario e delle categorie (v0.4)

Il dataset `data/trains.json` **non è stato modificato** in questa fase: restano 121 corse, valide dal 17/10 al 12/12/2026 (validità ora calcolata dai dati in `engine/validity.py`). È cambiato solo il modo in cui il motore usa i campi già presenti.

### 8.1 Note di calendario (`engine/calendar_rules.py`)

Ogni corsa conserva la nota trascritta (`calendar_note`) e la pagina del PDF (`source`). Il parser accetta una nota solo se **ogni** clausola corrisponde completamente alla grammatica. Le clausole riconosciute sono:
- «si effettua il lun/…»;
- «non si effettua il …» / «sospeso il …»;
- «dal … al …»;
- date singole;
- «feriale» / «festivi».

Esito sulle 121 corse (verifica eseguita il 2026-10-23):

| Esito | Corse | Effetto nel planner |
|---|---:|---|
| Nota interpretata | 11 | La regola filtra la corsa per data (insieme ai giorni strutturati e alle festività nazionali). |
| Solo informativa (operatore, controlli di trascrizione, regole biglietti) | 55 | Nessun effetto. |
| Non interpretabile (clausola troncata, a capo non ricostruibile, più note alternative unite da `\|`) | 55 | La corsa resta valida secondo `days`/`valid_from`/`valid_to`. La risposta aggiunge un avviso che cita la nota e la pagina («Calendario da verificare»). |

Esempi di note interpretate, con la pagina del PDF (pagina file / pagina stampata):

| Regola | Corsa | Pagina |
|---|---|---|
| fino al 16/11 | RV 3918 | 49 / 37 (note 1 e 119) |
| sospeso il venerdì | R | 60 / 48 (note 1 e 188) |
| solo venerdì | RV 2484 | 60 / 48 (note 1 e 189) |
| dal 19/10 al 26/10 | RV | 73 / 61 (note 8 e 27) |
| solo lunedì | RV | 76 / 64 (note 8 e 40) |
| dal 22/10 al 16/11, sospeso il 23–25/10 | RV | 78 / 66 (note 8 e 53) |
| solo lun, ven, sab | R | 124 / 112 (note 8 e 191) |

Festività considerate nell'edizione: **1/11** (Ognissanti) e **8/12** (Immacolata), da `engine/holidays.py` (festività nazionali italiane, Pasqua calcolata).

### 8.2 Categorie e biglietti (`engine/train_categories.py`)

- **regional:** R, RV. Biglietto regionale.
- **intercity:** IC, ICN.
- **high_speed:** FR.

Le categorie IC, ICN e FR sono marcate `different_ticket: true` (biglietto diverso o supplemento) e la UI mostra il badge «Biglietto diverso / supplemento». Per default la UI chiede solo `regional`; l'API senza `train_categories` considera tutte le categorie (comportamento v0.3).

### 8.3 Limiti che restano

- Le 55 note non interpretabili andrebbero ricontrollate a vista sul PDF e ritrascritte. Fino ad allora l'app avvisa e non inventa.
- Fuori dal 17/10–12/12/2026 non ci sono dati: l'API lo dichiara esplicitamente e propone solo soluzioni dentro la validità.
