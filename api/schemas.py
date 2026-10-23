"""Pydantic v2 schemas and validation models for UnimoreGo API.

All models provide comprehensive OpenAPI examples to serve as an exact
mock contract for frontend developers.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

TrainCategoryGroup = Literal["regional", "intercity", "high_speed"]


class ErrorResponse(BaseModel):
    """Uniform error response."""

    detail: str = Field(
        ...,
        description="Descrizione dettagliata dell'errore",
        examples=["Campus non trovato: dief_err"],
    )
    code: str = Field(..., description="Codice errore macchina", examples=["NOT_FOUND"])


class HealthResponse(BaseModel):
    """Health check endpoint response."""

    status: str = Field("ok", description="Stato del servizio", examples=["ok"])
    data_valid_from: str = Field(
        ...,
        description="Data di inizio validità dell'orario caricato (derivata dai dati)",
        examples=["2026-10-17"],
    )
    data_valid_to: str = Field(
        ...,
        description="Data di scadenza dell'orario ferroviario ufficiale caricato",
        examples=["2026-12-12"],
    )
    version: str = Field(..., description="Versione del motore e dell'API", examples=["0.6.0"])


class CampusItem(BaseModel):
    """University campus summary."""

    id: str = Field(..., description="Identificativo univoco del campus", examples=["dief"])
    name: str = Field(
        ...,
        description="Nome del dipartimento universitario",
        examples=["Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)"],
    )
    city: str = Field(..., description="Città della sede didattica", examples=["Modena"])
    lat: float = Field(..., description="Latitudine WGS84", examples=[44.6292268])
    lon: float = Field(..., description="Longitudine WGS84", examples=[10.9492319])


class StationItem(BaseModel):
    """Railway station summary."""

    id: str = Field(
        ..., description="Identificativo univoco della stazione", examples=["modena_fs"]
    )
    name: str = Field(..., description="Nome della stazione", examples=["Modena FS"])
    city: str = Field(..., description="Città della stazione", examples=["Modena"])
    lat: float = Field(..., description="Latitudine WGS84", examples=[44.653998])
    lon: float = Field(..., description="Longitudine WGS84", examples=[10.930751])


class OriginCoords(BaseModel):
    """Geographic coordinate origin."""

    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitudine", examples=[44.697309])
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitudine", examples=[10.642577])


class OriginStation(BaseModel):
    """Station origin."""

    station_id: str = Field(
        ..., description="Identificativo stazione di partenza", examples=["reggio_fs"]
    )


class PlanRequestSchema(BaseModel):
    """Commuter trip planning request."""

    origin: OriginStation | OriginCoords = Field(
        ...,
        description="Punto di partenza: stazione ({station_id}) oppure coordinate ({lat, lon})",
        examples=[{"station_id": "reggio_fs"}],
    )
    campus_id: str = Field(
        ..., description="Identificativo campus di destinazione", examples=["dief"]
    )
    arrive_by: str | None = Field(
        None,
        description=(
            "Andata: data e ora di inizio lezione, ISO 8601 (Europe/Rome). "
            "Indicare esattamente uno tra arrive_by e depart_after."
        ),
        examples=["2026-10-26T08:30:00+01:00"],
    )
    depart_after: str | None = Field(
        None,
        description=(
            "Ritorno: data e ora di fine lezione, ISO 8601 (Europe/Rome). Restituisce le prime "
            "soluzioni dalla sede verso la stazione di casa."
        ),
        examples=["2026-10-26T13:00:00+01:00"],
    )
    mode: Literal["walk", "bike"] = Field(
        "walk",
        description="Modalità attiva preferita per il primo e ultimo miglio (walk | bike)",
        examples=["bike"],
    )
    margin_min: int = Field(
        10,
        ge=0,
        le=60,
        description="Margine di sicurezza di arrivo prima della lezione (minuti, 0-60)",
        examples=[10],
    )
    home_to_station_min: int | None = Field(
        None,
        ge=0,
        description="Tempo casa->stazione fornito dall'utente in minuti (opzionale)",
        examples=[10],
    )
    station_buffer_min: int = Field(
        5,
        ge=1,
        le=30,
        description=(
            "Minuti in stazione prima della partenza (biglietto, binario). Sempre almeno 1, "
            "così l'orario di uscita non coincide mai con la partenza del treno."
        ),
        examples=[5],
    )
    train_categories: list[TrainCategoryGroup] | None = Field(
        None,
        min_length=1,
        description=(
            "Gruppi di treni ammessi: regional (R/RV), intercity (IC/ICN), high_speed (FR). "
            "Se omesso valgono tutte le categorie (compatibilità con v0.3)."
        ),
        examples=[["regional"]],
    )

    @model_validator(mode="after")
    def _exactly_one_time(self) -> PlanRequestSchema:
        if (self.arrive_by is None) == (self.depart_after is None):
            raise ValueError("indicare esattamente uno tra arrive_by e depart_after")
        return self

    @property
    def planner_name(self) -> str:
        return "arrive_by" if self.arrive_by is not None else "depart_after"

    @property
    def target(self) -> str:
        return self.arrive_by if self.arrive_by is not None else self.depart_after  # type: ignore[return-value]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "origin": {"station_id": "reggio_fs"},
                "campus_id": "dief",
                "arrive_by": "2026-10-26T08:30:00+02:00",
                "mode": "bike",
                "margin_min": 10,
                "home_to_station_min": 10,
                "station_buffer_min": 5,
                "train_categories": ["regional"],
            }
        }
    )


class TrainInfoSchema(BaseModel):
    """Train information for rail legs."""

    number: str = Field(..., description="Numero del treno", examples=["3907"])
    category: str = Field(..., description="Categoria del treno", examples=["Regionale Veloce"])
    operator: str = Field(
        ..., description="Impresa ferroviaria operatrice", examples=["Trenitalia Tper"]
    )
    code: str = Field("", description="Sigla categoria (R, RV, IC, ICN, FR)", examples=["RV"])
    category_group: TrainCategoryGroup = Field(
        "regional", description="Gruppo di categoria per il filtro", examples=["regional"]
    )
    different_ticket: bool = Field(
        False,
        description="True se serve un biglietto diverso dal regionale o un supplemento (IC/FR)",
        examples=[False],
    )
    source: str = Field(
        "",
        description="Pagina del PDF Trenitalia da cui è tratta la corsa",
        examples=["Regionale_Emilia.pdf, pag. 75 (pagina stampata 63; note 8 e 35)"],
    )
    festive_unverified: bool = Field(
        False,
        description=(
            "True in un giorno festivo (domenica o festività) se l'orario non conferma "
            "esplicitamente la circolazione della corsa (nessun simbolo †/Ⓑ/Ⓒ né nota che "
            "nomini il giorno): la UI mostra «Circolazione nei festivi da verificare»"
        ),
        examples=[False],
    )


class LegSchema(BaseModel):
    """Single leg of an itinerary."""

    model_config = ConfigDict(populate_by_name=True)

    leg_type: Literal["walk", "bike", "train", "wait"] = Field(
        ...,
        alias="type",
        description="Tipologia del tratto (walk, bike, train, wait = tempo in stazione)",
        examples=["train"],
    )
    from_location: str = Field(
        ..., alias="from", description="Luogo o stazione di partenza", examples=["Reggio Emilia"]
    )
    to_location: str = Field(
        ..., alias="to", description="Luogo o sede di arrivo", examples=["Modena"]
    )
    depart: str = Field(..., description="Orario di partenza (HH:MM)", examples=["07:44"])
    arrive: str = Field(..., description="Orario di arrivo (HH:MM)", examples=["07:56"])
    minutes: int = Field(..., description="Durata del tratto in minuti", examples=[12])
    train: TrainInfoSchema | None = Field(
        None,
        description="Dati della corsa ferroviaria (solo per tratti in treno)",
        examples=[
            {"number": "3907", "category": "Regionale Veloce", "operator": "Trenitalia Tper"}
        ],
    )
    notes: list[str] = Field(
        default_factory=list,
        description="Avvisi specifici del tratto (es. nota di calendario non interpretata)",
    )


class ItinerarySchema(BaseModel):
    """Complete door-to-door itinerary option."""

    leave_at: str = Field(
        ..., description="Orario in cui uscire di casa (HH:MM)", examples=["07:34"]
    )
    arrive_at: str = Field(
        ..., description="Orario stimato di arrivo al campus (HH:MM)", examples=["08:18"]
    )
    slack_min: int = Field(
        ...,
        description=(
            "Andata: anticipo sull'inizio lezione (negativo = ritardo). "
            "Ritorno: minuti liberi tra fine lezione e uscita dalla sede"
        ),
        examples=[12],
    )
    legs: list[LegSchema] = Field(..., description="Tratti sequenziali del viaggio")
    date: str = Field("", description="Data del viaggio (YYYY-MM-DD)", examples=["2026-10-26"])
    duration_min: int = Field(
        0, description="Durata porta a porta in minuti (dall'uscita all'arrivo)", examples=[44]
    )
    changes: int = Field(0, description="Numero di cambi di treno (0 = diretto)", examples=[0])


class NearbySchema(BaseModel):
    """Closest solution outside the requested window."""

    kind: Literal["previous", "next"] = Field(..., description="Soluzione precedente o successiva")
    itinerary: ItinerarySchema
    label: str = Field(
        "",
        description="Spiegazione in italiano della soluzione alternativa",
        examples=["Stessa ora di lezione, lunedì 26/10/2026 (giorno feriale successivo)."],
    )


class NoticeSchema(BaseModel):
    """A user-facing notice with a stable code and a severity level."""

    code: str = Field(
        ...,
        description=(
            "Codice stabile: out_of_validity, no_service, calendar_note, home_far, "
            "home_unknown, festive_day, same_city, estimate, generic, not_realtime"
        ),
        examples=["no_service"],
    )
    level: Literal["error", "warning", "info"] = Field(..., description="Gravità")
    message: str = Field(..., description="Testo in italiano")


class CalculationSchema(BaseModel):
    """How the station time limit was computed (shown to the user)."""

    station: str = Field(..., description="Stazione della sede", examples=["Modena FS"])
    time: str = Field(..., description="Orario limite (HH:MM)", examples=["08:31"])
    summary: str = Field(
        ...,
        description="Spiegazione del calcolo in italiano",
        examples=[
            "Calcolo: lezione alle 09:00 − 10 min di anticipo − 19 min a piedi dalla stazione "
            "alla sede = arrivo a Modena FS entro le 08:31."
        ],
    )


class SuggestionSchema(BaseModel):
    """A faster mode for the same trip (same city, long walk -> bike)."""

    mode: Literal["bike"] = Field(..., description="Mezzo suggerito", examples=["bike"])
    minutes: int = Field(
        ..., ge=0, description="Durata con il mezzo suggerito (bici a 15 km/h)", examples=[22]
    )
    message: str = Field(
        ...,
        description="Testo pronto per la UI",
        examples=["In bici circa 22 min (a piedi 53 min)."],
    )


class PlanResponseSchema(BaseModel):
    """Trip planning result."""

    planner: Literal["arrive_by", "depart_after"] = Field(
        "arrive_by", description="Pianificatore usato: andata (arrive_by) o ritorno (depart_after)"
    )
    itineraries: list[ItinerarySchema] = Field(
        ...,
        description=(
            "Migliori itinerari (max 3): per arrive_by ordinati per uscita più tardiva, per "
            "depart_after per partenza più vicina alla fine della lezione"
        ),
    )
    nearby: list[NearbySchema] = Field(
        default_factory=list,
        description="Se non c'è un treno utile: soluzione precedente e/o successiva (anche altri giorni)",
    )
    calculation: CalculationSchema | None = Field(
        None, description="Calcolo dell'orario limite in stazione (assente per percorsi diretti)"
    )
    suggestion: SuggestionSchema | None = Field(
        None,
        description=(
            "Stessa città a piedi oltre 20 min: la bici con il suo tempo; null altrimenti"
        ),
    )
    notices: list[NoticeSchema] = Field(
        default_factory=list,
        description=(
            "Avvisi deduplicati e fusi, ordinati per priorità (il primo è il più importante); "
            "l'avviso 'non in tempo reale' è sempre l'ultimo"
        ),
    )
    warnings: list[str] = Field(
        default_factory=list,
        description=(
            "Compatibilità v0.4: testi degli avvisi; il primo è sempre 'non in tempo reale', "
            "poi gli avvisi in ordine di priorità"
        ),
        examples=[
            "Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale).",
            "Stima primo tratto casa->stazione: 10 minuti in bicicletta basata su distanza stradale stimata (~2.1 km).",
        ],
    )


class GeocodeResult(BaseModel):
    """Address search result (OpenStreetMap Nominatim)."""

    label: str = Field(
        ..., description="Indirizzo trovato", examples=["Via Emilia Centro 1, Modena"]
    )
    lat: float = Field(..., examples=[44.6466])
    lon: float = Field(..., examples=[10.9253])


class GeocodeResponse(BaseModel):
    results: list[GeocodeResult] = Field(default_factory=list)
    attribution: str = Field(
        "Dati © OpenStreetMap contributors, ODbL. Ricerca: Nominatim.",
        description="Attribuzione obbligatoria dei dati OSM",
    )
