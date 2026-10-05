"""
Password hashing and session tokens. Mirrors
server/src/modules/auth/auth.service.ts.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

TOKEN_TTL_SECONDS = 15 * 60
COOKIE_NAME = "foodlog_session"

_hasher = PasswordHasher()  # Argon2id by default.


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def sign_token(user_id: str, secret: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=TOKEN_TTL_SECONDS)
    return jwt.encode({"sub": user_id, "exp": expires_at}, secret, algorithm="HS256")


def verify_token(token: str, secret: str) -> str | None:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None
