from __future__ import annotations

from fastapi import APIRouter, Request, Response
from pydantic import ValidationError

from ...errors import ApiError
from ...security.auth import COOKIE_NAME, TOKEN_TTL_SECONDS, sign_token, verify_token
from . import service
from .schemas import LoginInput, RegisterInput

router = APIRouter()


def _validation_message(exc: ValidationError) -> str:
    parts = []
    for issue in exc.errors():
        field = ".".join(str(p) for p in issue["loc"])
        parts.append(f"{field}: {issue['msg']}")
    return "; ".join(parts)


def _set_session_cookie(response: Response, token: str, secure: bool) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=TOKEN_TTL_SECONDS,
        path="/",
    )


def require_auth(request: Request) -> str:
    """FastAPI dependency: rejects the request unless its session cookie is valid."""
    token = request.cookies.get(COOKIE_NAME)
    settings = request.app.state.settings
    user_id = verify_token(token, settings.jwt_secret) if token else None
    if not user_id:
        raise ApiError(401, "UNAUTHORIZED", "Please sign in.")
    return user_id


@router.post("/register")
async def register_route(request: Request, response: Response):
    body = await request.json()
    try:
        data = RegisterInput.model_validate(body)
    except ValidationError as exc:
        raise ApiError(422, "VALIDATION_ERROR", _validation_message(exc))

    db = request.app.state.db
    settings = request.app.state.settings
    try:
        user = service.register(db, data.email, data.name, data.password)
    except service.AuthError as exc:
        raise ApiError(409, exc.code, exc.message)

    _set_session_cookie(response, sign_token(user["id"], settings.jwt_secret), settings.env == "production")
    response.status_code = 201
    return {"success": True, "data": {"user": user}}


@router.post("/login")
async def login_route(request: Request, response: Response):
    body = await request.json()
    try:
        data = LoginInput.model_validate(body)
    except ValidationError as exc:
        raise ApiError(422, "VALIDATION_ERROR", _validation_message(exc))

    db = request.app.state.db
    settings = request.app.state.settings
    try:
        user = service.login(db, data.email, data.password)
    except service.AuthError as exc:
        raise ApiError(401, exc.code, exc.message)

    _set_session_cookie(response, sign_token(user["id"], settings.jwt_secret), settings.env == "production")
    return {"success": True, "data": {"user": user}}


@router.post("/logout", status_code=204)
async def logout_route(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="lax")


@router.get("/me")
async def me_route(request: Request):
    user_id = require_auth(request)
    user = service.find_user(request.app.state.db, user_id)
    if not user:
        raise ApiError(401, "UNAUTHORIZED", "Please sign in again.")
    return {"success": True, "data": {"user": user}}
