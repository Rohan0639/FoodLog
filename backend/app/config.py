"""
Validated server configuration. Startup fails fast with the names of whatever is
missing, rather than failing on the first request. Mirrors the Node version's
server/src/config/env.ts so the two can be swapped without changing deploy habits.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Settings:
    env: str
    port: int
    database_url: str
    jwt_secret: str
    cors_origin: str


def load_env(source: dict | None = None) -> Settings:
    source = source if source is not None else os.environ

    missing: list[str] = []

    database_url = source.get("DATABASE_URL", "")
    if not database_url:
        missing.append("DATABASE_URL")

    jwt_secret = source.get("JWT_SECRET", "")
    if len(jwt_secret) < 32:
        missing.append("JWT_SECRET")

    if missing:
        # Names only. Values can be secrets, so they are never echoed.
        raise ConfigError(f"Invalid server configuration: {', '.join(missing)}")

    env = source.get("NODE_ENV") or source.get("ENV") or "development"
    if env not in ("development", "test", "production"):
        env = "development"

    try:
        port = int(source.get("PORT", "8787"))
    except ValueError:
        port = 8787

    cors_origin = source.get("CORS_ORIGIN", "http://localhost:5173")

    return Settings(
        env=env,
        port=port,
        database_url=database_url,
        jwt_secret=jwt_secret,
        cors_origin=cors_origin,
    )
