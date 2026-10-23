# UnimoreGo — verifica export calendario lezioni UNIMORE

**Compito B · Fase 0 — sola ricerca/verifica**  
**Data di accesso/verifica:** 23 ottobre 2026 (America/New_York)  
**Esito sintetico:** **.ics SÌ, senza login, ma non per il percorso pubblico DIEF/Ingegneria Informatica verificato.**

## Decisione

| Oggetto verificato | Esito | Cosa è stato effettivamente verificato |
|---|---|---|
| Agenda Web UNIMORE / EasyAcademy | **SÌ, pubblico** | Un export `text/calendar` con filename `calendar.ics` viene scaricato senza cookie o login dall'Agenda Web, dopo la selezione di un corso con calendario pubblicato. Il file di esempio è stato davvero scaricato: [`esempio_AgendaWeb_Unimore_2026-27.ics`](esempio_AgendaWeb_Unimore_2026-27.ics). |
| App Unimore Calendar | **NON VERIFICATO come export** | È l'app ufficiale per visualizzare orari, esami e aule. Le schede ufficiali/Store consultate non dichiarano export iCal, Google Calendar o una sottoscrizione calendario. Non è stato installato né autenticato. |
| Esse3 | **NON VERIFICATO come export lezioni** | La home pubblica è stata aperta senza login; non espone un export dell'orario delle lezioni o un link iCal. Non è stato effettuato login né consultata un'area riservata. |
| DIEF — Ingegneria Informatica, LT, a.a. 2026/27 | **NO .ics sul portale orari DIEF verificato** | Il collegamento ufficiale DIEF porta al portale statico `orariolezioni.unimore.it`. Per il corso sono pubblicati HTML, PDF e `.xls`; nella pagina e nell'indice non compare iCal. La richiesta del file omologo `.ics` ha restituito **HTTP 404**. |

Quindi il giudizio richiesto, a livello di Ateneo, è **.ics SÌ / NON RICHIEDE LOGIN**. Non equivale però a dire che *ogni* corso UNIMORE, e in particolare il canale pubblico usato dal DIEF per Ingegneria Informatica, abbia un iCal utilizzabile.

## Verifica concreta dell'Agenda Web

### Procedura normale per uno studente (nessun login)

1. Aprire [Agenda Web UNIMORE — Orario delle lezioni per corso di studio](https://www.aule.unimore.it/PortaleStudentiUnimore/index.php?view=easycourse&_lang=it&include=corso).
2. Selezionare **Anno accademico**, **Area didattica**, **Corso di studio** e **Anno/Percorso**; scegliere la visualizzazione disponibile (agenda settimanale o orario base) e premere **“Mostra orario”**.
3. Quando l'orario è pubblicato nel sistema Agenda Web, nell'area **“Esporta informazioni”** è disponibile il comando **“Esporta sul tuo calendario”**. Il download restituisce un file `calendar.ics` (`Content-Type: text/calendar; charset=utf-8`).
4. Importare il file nel proprio calendario. Non è stato trovato un pulsante/link `webcal:` o “abbonati al calendario”: questa è una **istantanea scaricabile**, non una sottoscrizione verificata.

### Prova effettuata, senza login

Per verificare che non fosse solo un'etichetta dell'interfaccia, è stato usato un corso pubblico dell'Agenda Web che aveva eventi pubblicati:

- a.a. **2026/2027**;
- Area: **Tecnologia**;
- CdS: **Digital Automation Engineering** (`1-362`), anno 1, percorso `PDS0-2026|1`;
- visualizzazione agenda e richiesta dell'elenco completo degli eventi.

L'endpoint pubblico generato dall'Agenda, `https://www.aule.unimore.it/PortaleStudentiUnimore/export/ec_download_ical_list.php`, ha risposto il 23/10/2026 con **HTTP 200**, `Content-Type: text/calendar; charset=utf-8` e `Content-Disposition: inline; filename=calendar.ics`, senza autenticazione. Il risultato è il file allegato sopra (35.093 byte, 110 `VEVENT`).

> **Nota di integrazione:** il percorso PHP è stato rilevato dal JavaScript distribuito pubblicamente dall'Agenda ed è stato testato soltanto per la verifica richiesta. Non è documentato da UNIMORE come API stabile: non va assunto come API contrattuale né usato nel percorso critico di UnimoreGo senza autorizzazione/accordo del titolare.

## Esempio del `.ics` scaricato e campi presenti

Estratto fedele, con una singola lezione del file scaricato:

```ics
BEGIN:VEVENT
UID:1789459200M.0.2[[RE20]-Tecnopolo-ExOfficineReggiane-Padiglione15]1@unimore
DTSTAMP:20261023T060300
DTSTART:20260915T100000
DTEND:20260915T130000
SUMMARY:Artificial Intelligence and Data Science Mamei Marco, Mariani Stefano M.0.2 [[RE 20] - Tecnopolo - Ex Officine Reggiane - Padiglione 15] Lezione
END:VEVENT
```

| Livello | Campi osservati nel file di esempio | Osservazioni |
|---|---|---|
| `VCALENDAR` | `BEGIN/END:VCALENDAR`, `VERSION:2.0`, `CALSCALE:GREGORIAN`, `PRODID:unimore`, `METHOD:PUBLISH`, `X-WR-TIMEZONE:Europe/Brussels`, `VTIMEZONE` | Formato iCalendar 2.0; il fuso dichiarato è `Europe/Brussels`, non `Europe/Rome`. Nel periodo osservato condividono CET/CEST, ma un'integrazione dovrebbe trattarlo come dettaglio da validare. |
| Ogni `VEVENT` | `UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY` | 110 eventi: lezioni e sospensioni delle attività didattiche. |
| **Non presenti** | `LOCATION`, `DESCRIPTION`, `URL`, `ATTENDEE`, `STATUS`, `SEQUENCE`, `RRULE` | La stanza/sede non è in un campo iCalendar strutturato; non c'è ricorrenza (`RRULE`), quindi le occorrenze sono espanse come eventi singoli. |

### Aula o sede: sì nel testo, no nel campo standard `LOCATION`

Nel `SUMMARY` sopra compaiono sia aula `M.0.2` sia sede `[RE 20] - Tecnopolo - Ex Officine Reggiane - Padiglione 15`, ma **non esiste una proprietà `LOCATION:`**. Lo stesso file contiene anche eventi di sospensione con solo date e `SUMMARY`.

Conseguenza: l'export trasporta semanticamente aula/sede per molte lezioni, ma un'app dovrebbe estrarle da testo libero nel `SUMMARY`; non è una fonte strutturata/robusta per il requisito “aula/sede”. La griglia pubblica dell'Agenda ha invece tali informazioni separate (aula e sede) prima dell'export.

## Prova specifica DIEF — Ingegneria Informatica

### Fonte ufficiale usata dal DIEF

La pagina **Orario delle lezioni** del DIEF rimanda per l'a.a. 2026/27 a [Orari delle lezioni DIEF](https://www.orariolezioni.unimore.it/Orario/Dipartimento_di_Ingegneria_Enzo_Ferrari/2026-2027/), non a un'agenda iCal. Nell'indice del semestre, il corso **Ingegneria Informatica — Laurea Triennale** espone:

- [pagina HTML anno 1 / Percorso standard](https://www.orariolezioni.unimore.it/Orario/Dipartimento_di_Ingegneria_Enzo_Ferrari/2026-2027/2433/Curricula/IngegneriaInformatica_LaureaTriennale_1_Percorsostandard_20-212.html);
- [file PDF dell'anno 1](https://www.orariolezioni.unimore.it/Orario/Dipartimento_di_Ingegneria_Enzo_Ferrari/2026-2027/2433/Curricula/IngegneriaInformatica_LaureaTriennale_1_Percorsostandard_20-212.pdf);
- [file `.xls` dell'intero corso](https://www.orariolezioni.unimore.it/Orario/Dipartimento_di_Ingegneria_Enzo_Ferrari/2026-2027/2433/Curricula/IngegneriaInformatica_LaureaTriennale_20-212.xls).

Il `.xls` è stato scaricato e aperto: è un file Excel binario con tre fogli (`1_Percorsostandard`, `2_Percorsostandard`, `3_Percorsostandard`). Il foglio del primo anno dichiara il periodo **16/09/2026–23/12/2026** e mostra insegnamento, docenti e aula (ad esempio `P0.4`); la pagina HTML associa l'aula alla sede `[MO 25] - via Vivarelli 10/1 (Ingegneria)`.

Non è comparso un link `.ics`, “Esporta sul calendario”, “Google Calendar” o “abbonati”. Come controllo limitato sul nome file, la richiesta di:

```text
.../Curricula/IngegneriaInformatica_LaureaTriennale_20-212.ics
```

ha dato **HTTP 404** il 23/10/2026 (anche l'estensione `.ical` ha dato 404). Questo verifica l'assenza dell'omologo iCal nel percorso pubblicato; non dimostra l'inesistenza assoluta di qualunque file nascosto sul server.

### Tentativo nell'Agenda Web per lo stesso CdS

Nell'Agenda Web pubblica, a.a. 2026/27, il CdS era selezionabile come `20-212`, **Ingegneria Informatica — Laurea Triennale**, Area `Tecnologia`, percorso `20-212-0|1`, con tipo di pubblicazione `std` (orario base). La richiesta pubblica dell'orario non ha restituito eventi (`celle: []`, `contains_data: 0`).

È stato comunque richiesto il suo export iCal pubblico: il server ha prodotto un `calendar.ics` valido ma **vuoto di `VEVENT`** (solo intestazione calendario e definizione del fuso). Non è quindi un export utilizzabile per le lezioni DIEF, né consente di verificare aula/sede per quel CdS da Agenda Web. L'orario DIEF effettivamente popolato è quello statico HTML/PDF/XLS descritto sopra.

## Esse3 e app ufficiale: perimetro della verifica

- **Esse3:** è stato aperto soltanto [l'accesso pubblico](https://www.esse3.unimore.it/Home.do), senza autenticazione. La pagina mostra procedure e servizi ma non un export dell'orario delle lezioni. Non si afferma che tale funzione non esista in area riservata: **non è stata verificata**, perché il compito vieta login e scraping di aree riservate.
- **Unimore Calendar:** la pagina ufficiale UNIMORE e [Google Play](https://play.google.com/store/apps/details?id=it.easystaff.unimore&hl=it) confermano che l'app visualizza orari delle lezioni, esami, dettagli e disponibilità aule. Nelle descrizioni esaminate non è indicato un export `.ics`, Google Calendar o una sottoscrizione; dunque **non va assunto** che l'app possa fornire un feed standard.
- **EasyStaff/EasyAcademy:** la pagina del fornitore afferma genericamente che da ogni pagina dell'Agenda Web si possono esportare gli impegni nel calendario dello smartphone. Il test diretto sull'istanza UNIMORE sopra conferma che la funzione è effettivamente attiva almeno per corsi con calendario pubblicato; non ne garantisce la copertura per il DIEF.

## Licenza / riuso

| Risorsa | Licenza o condizione verificata | Implicazione prudenziale |
|---|---|---|
| File iCal, Agenda Web e orario statico DIEF | **Nessuna licenza open/CC o termini di riuso dei dati dell'orario sono stati trovati** nelle pagine o negli header verificati. | Non trattare i dati come open data; chiedere autorizzazione scritta a UNIMORE/titolare del servizio prima di redistribuire, conservare sistematicamente o usare in produzione. |
| Portale UNIMORE | La [pagina copyright UNIMORE](https://www.unimore.it/en/copyright) riserva testi e immagini e consente uso personale non commerciale; non dichiara una licenza dati per Agenda Web/orariolezioni. | È un'indicazione cautelativa, non una licenza dati esplicita per i due sottodomini. Non è sufficiente per dedurre permesso di integrazione commerciale/automatica. |
| Formato iCalendar | È un formato tecnico; non trasferisce una licenza sui contenuti dell'orario. | Separare sempre interoperabilità del formato e diritto di riuso dei dati. |

## Limiti riscontrati e impatto su UnimoreGo

1. **Copertura non uniforme:** Agenda Web ha un export iCal pubblico, ma il CdS DIEF/Ingegneria Informatica verificato pubblica l'orario operativo sul sito statico DIEF, non come calendario popolato nell'Agenda.
2. **Nessun feed sottoscrivibile verificato:** il `.ics` è uno snapshot; per gli aggiornamenti occorrerebbe un nuovo download. Non è stata trovata una URL `webcal:` o “subscribe”.
3. **Aula/sede non strutturate nell'iCal:** nel file scaricato sono concatenate in `SUMMARY`; `LOCATION` è assente. Non fare affidamento su un parser rigido.
4. **Aggiornamenti/cancellazioni:** il file di esempio non contiene `STATUS` né `SEQUENCE`; inoltre una lezione marcata annullata nei dati dell'Agenda non risulta marcata come cancellata nel `VEVENT` osservato. La semantica degli annullamenti va verificata prima di un impiego operativo.
5. **Orario DIEF statico:** l'XLS è un orario settimanale per periodo/anno, non un calendario di singole occorrenze in iCal. Conversione in eventi, gestione delle sospensioni e delle variazioni richiederebbero regole aggiuntive e conferma del titolare.
6. **Licenza:** non c'è una licenza open verificata. Il riuso automatico nel prodotto non è approvato da questa verifica.

## Cosa resta da verificare a mano

- Chiedere a DIEF/UNIMORE se esiste un **export ufficiale e supportato** (iCal, CSV, API documentata) per il piano orario personale e per il CdS Ingegneria Informatica, e con quale licenza/permesso di caching e redistribuzione.
- Chiedere se Agenda Web può essere popolata anche per `20-212`, oppure se il portale statico DIEF è la fonte ufficiale esclusiva.
- Verificare con un account studente, solo se autorizzato, se Esse3 o l'app Unimore Calendar offrono un export personale diverso da quello pubblico; non inferirlo da questa ricerca.
- Chiarire il significato operativo di aule con asterisco, lezioni annullate, recuperi e cambi aula nell'iCal e nel portale statico.
- Validare formato, timezone e compatibilità del `.ics` con Google Calendar/Apple Calendar/Outlook e ottenere una fonte strutturata `LOCATION` prima di usare dati aula/sede per calcoli “arrive-by”.

## Fonti consultate (tutte accesso 23 ottobre 2026)

1. **Agenda Web UNIMORE — orario per corso di studio:** <https://www.aule.unimore.it/PortaleStudentiUnimore/index.php?view=easycourse&_lang=it&include=corso>.
2. **Endpoint di download iCal dell'istanza Agenda Web** (verificato con richiesta pubblica generata dall'interfaccia): <https://www.aule.unimore.it/PortaleStudentiUnimore/export/ec_download_ical_list.php>.
3. **Pagina Agenda Web del fornitore EasyStaff** (descrive l'esportazione sul calendario): <https://www.easystaff.it/easystaff/cms/soluzioni/easy-academy/agendaweb.html>.
4. **DIEF — Orario delle lezioni** (collega il portale orari 2026/27): <https://www.dief.unimore.it/it/didattica/organizzazione-didattica/orario-delle-lezioni>.
5. **Indice pubblico orari DIEF 2026/27:** <https://www.orariolezioni.unimore.it/Orario/Dipartimento_di_Ingegneria_Enzo_Ferrari/2026-2027/>.
6. **Pagina HTML DIEF/Ingegneria Informatica, LT, anno 1:** <https://www.orariolezioni.unimore.it/Orario/Dipartimento_di_Ingegneria_Enzo_Ferrari/2026-2027/2433/Curricula/IngegneriaInformatica_LaureaTriennale_1_Percorsostandard_20-212.html>.
7. **XLS DIEF/Ingegneria Informatica, LT:** <https://www.orariolezioni.unimore.it/Orario/Dipartimento_di_Ingegneria_Enzo_Ferrari/2026-2027/2433/Curricula/IngegneriaInformatica_LaureaTriennale_20-212.xls>.
8. **Esse3 UNIMORE, home pubblica:** <https://www.esse3.unimore.it/Home.do>.
9. **Pagina ufficiale Unimore App / Unimore Calendar:** <https://www.unimore.it/en/services/unimore-app>.
10. **Scheda Google Play Unimore Calendar:** <https://play.google.com/store/apps/details?id=it.easystaff.unimore&hl=it>.
11. **Copyright UNIMORE:** <https://www.unimore.it/en/copyright>.

## File di prova conservati nella sandbox

- [`STATUS_ics.md`](STATUS_ics.md) — questa relazione.
- [`esempio_AgendaWeb_Unimore_2026-27.ics`](esempio_AgendaWeb_Unimore_2026-27.ics) — download pubblico effettivo, non modificato, dell'Agenda Web per il corso di esempio indicato; **non** è l'orario del DIEF/Ingegneria Informatica.
- `evidence/` — copie delle pagine/file/risposte HTTP usate per la verifica tecnica, inclusi l'XLS DIEF scaricato, la risposta iCal vuota del tentativo DIEF e gli header HTTP.
