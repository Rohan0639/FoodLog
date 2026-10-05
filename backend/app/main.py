"""
Builds the FastAPI app. Kept free of side effects at import time so tests can
mount a fresh instance with test doubles for the database and the AI parser.
Mirrors server/src/app.ts.
"""

from __future__ import annotations

import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import Settings
from .db import Database
from .errors import ApiError, api_error_handler, error_body
from .logging_utils import log
from .modules.auth.routes import router as auth_router
from .modules.parsing.routes import router as parsing_router

REQUEST_ID_RE = re.compile(r"^[\w-]{8,64}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Request id, security headers, CORS and structured logging, in one pass."""

    def __init__(self, app, cors_origin: str):
        super().__init__(app)
        self.cors_origin = cors_origin

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("x-request-id")
        request_id = incoming if incoming and REQUEST_ID_RE.match(incoming) else uuid.uuid4().hex
        request.state.request_id = request_id

        if request.method == "OPTIONS":
            response = JSONResponse(status_code=204, content=None)
        else:
            started = time.perf_counter()
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            log(
                "info",
                "request",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
            )

        response.headers["X-Request-Id"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"

        if request.headers.get("origin") == self.cors_origin:
            response.headers["Access-Control-Allow-Origin"] = self.cors_origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Request-Id"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"

        return response


MAX_BODY_BYTES = 8 * 1024 * 1024  # covers the base64 nutrition-label photo (<=6MB) plus overhead


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content=error_body("PAYLOAD_TOO_LARGE", "The request body is too large."))
        return await call_next(request)


def create_app(
    *,
    cors_origin: str = "http://localhost:5173",
    db: Database | None = None,
    ping_database=None,
    ai_parser=None,
    settings: Settings | None = None,
) -> FastAPI:
    app = FastAPI(title="FoodLog API", docs_url=None, redoc_url=None, openapi_url=None)

    app.state.db = db
    app.state.ai_parser = ai_parser
    # Auth routes read this for the JWT secret and whether cookies should be Secure.
    app.state.settings = settings

    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(RequestContextMiddleware, cors_origin=cors_origin)

    app.add_exception_handler(ApiError, api_error_handler)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, ValueError) and "JSON" in str(exc):
            return JSONResponse(status_code=400, content=error_body("INVALID_JSON", "The request body is not valid JSON."))
        request_id = getattr(request.state, "request_id", None)
        log("error", "unhandled error", request_id=request_id, path=request.url.path, error_name=type(exc).__name__, error_message=str(exc))
        return JSONResponse(status_code=500, content=error_body("INTERNAL_ERROR", "Something went wrong. Please try again."))

    @app.get("/api/health")
    async def health():
        return {"success": True, "data": {"status": "ok"}}

    @app.get("/api/health/db")
    async def health_db():
        if not ping_database:
            return JSONResponse(status_code=503, content=error_body("DB_NOT_CONFIGURED", "No database is configured."))
        try:
            ping_database()
            return {"success": True, "data": {"database": "ok"}}
        except Exception as err:  # noqa: BLE001
            log("error", "database health check failed", error_name=type(err).__name__)
            return JSONResponse(status_code=503, content=error_body("DB_UNAVAILABLE", "The database is not reachable right now."))

    if db is not None:
        app.include_router(auth_router, prefix="/api/auth")
        app.include_router(parsing_router, prefix="/api")

    @app.api_route("/api/{_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def _not_found(_path: str):
        raise ApiError(404, "NOT_FOUND", "Not found")

    return app
