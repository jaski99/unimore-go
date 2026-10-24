"""Runtime settings for the UnimoreGo API, read from environment variables.

Kept separate from the app factory (Single Responsibility) so that
configuration parsing can be unit-tested without spinning up FastAPI and so
that tests can inject explicit settings into ``create_app``.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass

CORS_ORIGINS_ENV = "CORS_ORIGINS"
DEFAULT_CORS_ORIGINS: tuple[str, ...] = ("http://localhost:3000",)


def parse_cors_origins(raw: str | None) -> tuple[str, ...]:
    """Parse a comma-separated list of origins.

    Blank entries are dropped and trailing slashes removed, because browsers
    send the ``Origin`` header without a trailing slash. An unset or empty
    value falls back to ``DEFAULT_CORS_ORIGINS``.
    """
    if raw is None:
        return DEFAULT_CORS_ORIGINS
    origins = tuple(item.strip().rstrip("/") for item in raw.split(",") if item.strip())
    return origins or DEFAULT_CORS_ORIGINS


@dataclass(frozen=True)
class Settings:
    """Immutable API settings."""

    cors_origins: tuple[str, ...] = DEFAULT_CORS_ORIGINS

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        """Build settings from ``env`` (defaults to ``os.environ``)."""
        source = os.environ if env is None else env
        return cls(cors_origins=parse_cors_origins(source.get(CORS_ORIGINS_ENV)))
