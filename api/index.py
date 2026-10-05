"""
Vercel entry for every /api/* request. vercel.json rewrites each request here and
passes the original path in `__route`, so the path is restored before the ASGI app
sees it -- the same mechanism proven to work for the Node deployment
(api/index.ts), now reused for Python so the routing cannot regress.

The app is built once per warm instance and reused across invocations.
"""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.config import load_env  # noqa: E402
from backend.app.db import Database  # noqa: E402
from backend.app.logging_utils import log  # noqa: E402
from backend.app.main import create_app  # noqa: E402

_app = None


def _build_app():
    global _app
    if _app is not None:
        return _app
    try:
        settings = load_env()
        db = Database(settings.database_url)
        _app = create_app(
            cors_origin=settings.cors_origin,
            db=db,
            ping_database=db.ping,
            settings=settings,
        )
    except Exception as err:  # noqa: BLE001
        log("error", "server configuration failed", error_message=str(err))
        raise
    return _app


def _restore_route(scope: dict) -> None:
    """Puts the original /api path back on the ASGI scope, from ?__route=..."""
    query_pairs = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
    route = None
    remaining = []
    for key, value in query_pairs:
        if key == "__route":
            route = value
        else:
            remaining.append((key, value))

    if route is not None:
        path = f"/api/{route}" if route else "/api"
        scope["path"] = path
        scope["raw_path"] = path.encode("utf-8")
        scope["query_string"] = urlencode(remaining).encode("latin-1")


async def app(scope, receive, send):
    """ASGI entry point Vercel's Python runtime detects by this exact name."""
    if scope["type"] == "http":
        _restore_route(scope)
    await _build_app()(scope, receive, send)
