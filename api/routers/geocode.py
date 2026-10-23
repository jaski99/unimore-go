"""Address search router (home location)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from api.deps import get_geocoder
from api.errors import APIError, error_response_docs
from api.geocoding import Geocoder, GeocodingError
from api.schemas import GeocodeResponse, GeocodeResult

router = APIRouter(prefix="/api", tags=["Geocoding"], responses=error_response_docs())


@router.get(
    "/geocode",
    response_model=GeocodeResponse,
    summary="Cerca un indirizzo (zona Modena / Reggio Emilia)",
    description=(
        "Geocodifica tramite OpenStreetMap Nominatim, limitata alle province di Modena e "
        "Reggio Emilia. Pensata per ricerche su invio (niente autocompletamento)."
    ),
)
def geocode(
    q: str = Query(..., min_length=3, max_length=200, description="Indirizzo da cercare"),
    geocoder: Geocoder = Depends(get_geocoder),
) -> GeocodeResponse:
    try:
        places = geocoder.search(q)
    except GeocodingError as exc:
        raise APIError(
            503, "Ricerca indirizzi non disponibile, riprova o tocca la mappa.", code="UPSTREAM"
        ) from exc
    return GeocodeResponse(
        results=[GeocodeResult(label=p.label, lat=p.lat, lon=p.lon) for p in places]
    )
