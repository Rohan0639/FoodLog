from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from backend.app.config import Settings  # noqa: E402
from backend.app.db import Database  # noqa: E402

JWT_SECRET = "test-secret-that-is-long-enough-1234567890"
ORIGIN = "http://localhost:5173"


def database_available() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


requires_db = pytest.mark.skipif(not database_available(), reason="DATABASE_URL is not set")


@pytest.fixture(scope="session")
def db():
    database = Database(os.environ["DATABASE_URL"])
    yield database
    database.close()


@pytest.fixture
def settings() -> Settings:
    return Settings(env="test", port=8787, database_url=os.environ.get("DATABASE_URL", ""), jwt_secret=JWT_SECRET, cors_origin=ORIGIN)


@pytest.fixture
def new_email():
    created: list[str] = []

    def _make() -> str:
        email = f"test-{uuid.uuid4().hex}@example.test"
        created.append(email)
        return email

    yield _make

    if created:
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            d = Database(db_url)
            with d.cursor() as cur:
                cur.execute('DELETE FROM "User" WHERE email = ANY(%s)', (created,))
