"""Pydantic v2 schemas and validation models for UnimoreGo API.

All models provide comprehensive OpenAPI examples to serve as an exact
mock contract for frontend developers.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
    data_valid_to: str = Field(
        ...,
        description="Data di scadenza dell'orario ferroviario ufficiale caricato",
        examples=["2026-12-12"],
    )
    version: str = Field(..., description="Versione del motore e dell'API", examples=["0.3.0"])


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
    arrive_by: str = Field(
        ...,
        description="Data e ora inizio lezione in formato ISO 8601 (Europe/Rome)",
        examples=["2026-10-26T08:30:00+02:00"],
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

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "origin": {"station_id": "reggio_fs"},
                "campus_id": "dief",
                "arrive_by": "2026-10-26T08:30:00+02:00",
                "mode": "bike",
                "margin_min": 10,
                "home_to_station_min": 10,
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


class LegSchema(BaseModel):
    """Single leg of an itinerary."""

    model_config = ConfigDict(populate_by_name=True)

    leg_type: Literal["walk", "bike", "train"] = Field(
        ...,
        alias="type",
        description="Tipologia di trasporto (walk, bike, train)",
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
        description="Margine di anticipo effettivo prima dell'inizio lezione (minuti)",
        examples=[12],
    )
    legs: list[LegSchema] = Field(..., description="Tratti sequenziali del viaggio")


class PlanResponseSchema(BaseModel):
    """Trip planning result."""

    itineraries: list[ItinerarySchema] = Field(
        ..., description="Migliori itinerari ordinati per leave_at decrescente (max 3)"
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Avvisi operativi in italiano (orari non realtime, validità, stime)",
        examples=[
            "Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale).",
            "Stima primo tratto casa->stazione: 10 minuti in bicicletta basata su distanza stradale stimata (~2.1 km).",
        ],
    )
