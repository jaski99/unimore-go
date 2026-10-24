"""API routers package."""

from api.routers.campuses import router as campuses_router
from api.routers.geocode import router as geocode_router
from api.routers.health import router as health_router
from api.routers.plan import router as plan_router
from api.routers.stations import router as stations_router

__all__ = [
    "health_router",
    "campuses_router",
    "stations_router",
    "plan_router",
    "geocode_router",
]
