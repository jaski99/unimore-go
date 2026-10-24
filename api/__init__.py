"""UnimoreGo API Package.

FastAPI REST wrapper providing door-to-door commuter itinerary endpoints.
"""

from api.main import app, create_app

__all__ = ["app", "create_app"]
