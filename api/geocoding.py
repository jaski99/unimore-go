"""Address geocoding for the home location (OpenStreetMap Nominatim).

Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
identifying User-Agent, at most 1 request per second, results cached, and
searches only on explicit user submit (no autocomplete). Results are limited
to the Modena / Reggio Emilia area. Data © OpenStreetMap contributors, ODbL.
"""

from __future__ import annotations

import threading
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from dataclasses import dataclass

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "UnimoreGo/0.4 (portfolio project; https://github.com/Jaski99/unimore-go)"
# lon_min, lat_max, lon_max, lat_min: provinces of Reggio Emilia and Modena
VIEWBOX = "10.30,44.90,11.20,44.45"
MIN_INTERVAL_S = 1.0
CACHE_SIZE = 256


class GeocodingError(RuntimeError):
    """The geocoding service could not be reached or answered badly."""


@dataclass(frozen=True)
class Place:
    label: str
    lat: float
    lon: float


class Geocoder(ABC):
    @abstractmethod
    def search(self, query: str, limit: int = 5) -> list[Place]:
        """Return places matching ``query`` (best first)."""


class NominatimGeocoder(Geocoder):
    """Nominatim client with LRU cache and 1 req/s throttle."""

    def __init__(
        self,
        client: httpx.Client | None = None,
        clock=time.monotonic,
        sleep=time.sleep,
    ) -> None:
        self.client = client or httpx.Client(timeout=8.0, headers={"User-Agent": USER_AGENT})
        self._clock = clock
        self._sleep = sleep
        self._last_call: float | None = None
        self._lock = threading.Lock()
        self._cache: OrderedDict[tuple[str, int], list[Place]] = OrderedDict()

    def search(self, query: str, limit: int = 5) -> list[Place]:
        key = (" ".join(query.lower().split()), limit)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            self._throttle()
            places = self._fetch(query, limit)
            self._cache[key] = places
            if len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
            return places

    def _throttle(self) -> None:
        now = self._clock()
        if self._last_call is not None and now - self._last_call < MIN_INTERVAL_S:
            self._sleep(MIN_INTERVAL_S - (now - self._last_call))
        self._last_call = self._clock()

    def _fetch(self, query: str, limit: int) -> list[Place]:
        params = {
            "q": query,
            "format": "jsonv2",
            "limit": str(limit),
            "countrycodes": "it",
            "viewbox": VIEWBOX,
            "bounded": "1",
            "accept-language": "it",
        }
        try:
            response = self.client.get(
                NOMINATIM_URL, params=params, headers={"User-Agent": USER_AGENT}
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise GeocodingError(str(exc)) from exc
        return [
            Place(label=item["display_name"], lat=float(item["lat"]), lon=float(item["lon"]))
            for item in payload
            if "display_name" in item and "lat" in item and "lon" in item
        ]
