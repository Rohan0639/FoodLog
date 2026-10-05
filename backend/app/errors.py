"""
Every error response has this shape. Stack traces are never sent to the client.
Mirrors server/src/middleware/errors.ts.
"""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_body(code: str, message: str) -> dict:
    return {"success": False, "error": {"code": code, "message": message}}


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content=error_body(exc.code, exc.message))


async def not_found_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=404, content=error_body("NOT_FOUND", "Not found"))
