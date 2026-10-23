# Fonti dei dati / Data sources

Tutti i dati sono statici e verificabili: nessun orario è inventato e nessuna
API a pagamento o con chiave è usata. / All data is static and verifiable: no
invented timetables, no paid or keyed APIs.

## Stazioni coperte / Covered stations

| Stazione | id | Coordinate (WGS84) | Codice UIC | Fonte coordinate |
|---|---|---|---|---|
| Reggio Emilia FS | `reggio_fs` | 44.697309, 10.642577 | 830005023 | Fase 0 (OSM, nodo 82549162) |
| Rubiera | `rubiera` | 44.6561256, 10.7801896 | 830005031 | OpenStreetMap, nodo [13769327683](https://www.openstreetmap.org/node/13769327683) (`railway=station`, `uic_ref=8305031`, operatore RFI), Overpass API, 2026-10-23, licenza ODbL |
| Modena FS | `modena_fs` | 44.653998, 10.930751 | 830005032 | Fase 0 (OSM, nodo 726611782) |

**Solo queste tre stazioni hanno orari.** Sono le uniche fermate tra Reggio
Emilia e Modena nelle tabelle lette del PDF. Altre stazioni (ad es. Reggio
Emilia AV Mediopadana o le linee TPER verso Sassuolo) non sono incluse: per
aggiungerle serve una fonte orari ufficiale e verificabile, che qui non è stata
estratta. / **Only these three stations have timetables**: they are the only
stops between Reggio Emilia and Modena in the PDF tables that were read.

## Orari treni / Train timetables — `data/trains.json`

| Voce | Valore |
|---|---|
| Documento | Trenitalia, *Orario regionale Emilia-Romagna* — [Regionale_Emilia.pdf](https://www.trenitalia.com/content/dam/trenitalia/allegati/info/orario-digitale/orari-regionali/Regionale_Emilia.pdf) |
| Edizione | «14 giugno – 12 dicembre 2026, aggiornato e valido dal 17/10/2026» |
| Validità usata | **17/10/2026 – 12/12/2026** (`valid_from` / `valid_to` di ogni corsa) |
| Scaricato | 2026-10-23, SHA-256 `80f3c07b96214ce8c5b8b9ba7f00541e20feb448f4c666722617653d11ee4cd3` |
| Tabelle lette | Quadro 1 *Bologna–Piacenza–Milano*: pagine del file 13–128. Quadro 2 *Bologna–Piacenza–Genova/Torino*: pagine 129–148 (due tabelle per pagina) |
| Legenda | Pagina del file 6: `:` = ferma solo nei periodi indicati; `!` = solo in partenza; `◖` = solo in arrivo; `|` = non ferma |
| Note di calendario | Barra laterale di ogni pagina; ogni corsa riporta il testo completo nel campo `calendar_note` e la pagina in `source` (`#page=N`, pagina stampata, numeri di nota) |

### Estrazione riproducibile / Reproducible extraction

```bash
pip install -e ".[data]"           # pymupdf
python tools/trenitalia_pdf.py Regionale_Emilia.pdf --out data/trains.json --report report.txt
python tools/validate_data.py      # schema, durate 3–45 min, note interpretabili, fonte con #page=
```

Lo strumento legge le parole con le loro coordinate. Le colonne si ancorano ai
numeri di treno, le righe alle etichette di stazione (con l'indicatore `a` per
gli arrivi) e la categoria ai glifi del font `infotra1` (L = R, o = RV, C = IC,
A = ICN, B = EC, ¥ = FR). Le note si leggono dalla barra laterale della stessa
pagina. Verifiche fatte:

- Confronto con le 121 corse trascritte a mano in Fase 1: 120 ritrovate con
  orari identici. Manca l'ICN 1962, che è riservato a chi ha biglietto con
  cuccetta e quindi viene escluso di proposito.
- Controllo visivo delle colonne RV 2070/2071 e ICN 1962 sul rendering delle
  pagine.
- Note interpretate controllate a mano, giorno per giorno, con il calendario:
  note 33, 116, 191, 192, 194, 200, 201 e 202 (vedi `tests/test_calendar_rules.py`).

### Cosa viene escluso / What is excluded

| Motivo | Colonne | Note |
|---|---:|---|
| Bus sostitutivi e Suburbano | 165 | Non sono treni della relazione |
| Glifo di categoria non riconosciuto | 44 | Verificato: nessuna ha orari a Reggio Emilia, Rubiera o Modena (bus `B…` e corse di altre linee) |
| Solo viaggiatori con cuccetta/vagone letto | 40 | Nota «Sono ammessi esclusivamente i viaggiatori muniti di biglietto…» |
| Fermata solo in partenza/arrivo o solo nei periodi indicati | 12 | Indicatori `!`, `◖`, `:` della legenda |

### Risultato / Result

402 corse: Reggio Emilia→Modena 140, Modena→Reggio Emilia 138, Reggio
Emilia→Rubiera 33, Rubiera→Modena 33, Modena→Rubiera 29, Rubiera→Reggio
Emilia 29. Categorie: RV 151, R 119, IC 66, FR 44, ICN 14, EC 8.

Le varianti di periodo della stessa corsa (ad es. RV 3907 «fino al 16/11» e
«dal 17/11») sono righe separate con note diverse; il motore sceglie quella
valida nel giorno richiesto.

**Le tabelle del quadro 1/2 non usano simboli di giorno**: le limitazioni sono
solo nelle note. Per questo ogni corsa ha `days` = tutti i giorni e il
calendario reale viene da `calendar_note`. Il vecchio default «lun–ven» della
Fase 1 era un errore di trascrizione: impediva le soluzioni di domenica e nei
festivi (review B1/A1).

## Sedi universitarie / Campuses — `data/locations.json`

Nominatim/OpenStreetMap, verificato il 2026-10-23 (licenza ODbL); per ogni sede
l'oggetto OSM è citato nel campo `source`.

## Tempi a piedi e in bici / Walk and bike times — `data/segments.json`

Tempi stazione↔sede stimati sui percorsi OSM (vedi `docs/research/STATUS_sedi.md`).

## Tempo reale / Real time

L'app **non** è in tempo reale. Per ritardi e soppressioni rimanda alle
pagine pubbliche Trenitalia (nessuna API): [ViaggiaTreno](http://www.viaggiatreno.it/infomobilita/index.jsp),
dove si cerca il treno per numero, e [Infomobilità Trenitalia](https://www.trenitalia.com/it/informazioni/Infomobilita/notizie-infomobilita.html).
Trenitalia non documenta un URL pubblico per aprire direttamente la scheda di
un treno, quindi l'app mostra il numero del treno da cercare.
