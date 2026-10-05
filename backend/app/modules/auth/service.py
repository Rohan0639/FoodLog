from __future__ import annotations

from datetime import datetime, timezone

import psycopg

from ...db import Database, new_id
from ...security.auth import hash_password, verify_password


class AuthError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def register(db: Database, email: str, name: str, password: str) -> dict:
    password_hash = hash_password(password)
    user_id = new_id()
    now = datetime.now(timezone.utc)
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user_id, email, name, password_hash, now, now),
            )
    except psycopg.errors.UniqueViolation:
        raise AuthError("EMAIL_TAKEN", "An account with this email already exists.")
    return {"id": user_id, "email": email, "name": name}


def login(db: Database, email: str, password: str) -> dict:
    with db.cursor() as cur:
        cur.execute(
            'SELECT id, email, name, "passwordHash" FROM "User" WHERE email = %s',
            (email,),
        )
        user = cur.fetchone()

    # Same error whether the email or the password is wrong, so accounts cannot be enumerated.
    ok = bool(user) and verify_password(user["passwordHash"], password)
    if not user or not ok:
        raise AuthError("INVALID_CREDENTIALS", "Email or password is incorrect.")
    return {"id": user["id"], "email": user["email"], "name": user["name"]}


def find_user(db: Database, user_id: str) -> dict | None:
    with db.cursor() as cur:
        cur.execute('SELECT id, email, name FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
    return dict(row) if row else None
