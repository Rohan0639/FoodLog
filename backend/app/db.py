"""
The database layer. One small connection pool per warm instance, matching how the
Node version reused a single Prisma client across warm serverless invocations.

Tables were created by the original Prisma migrations (prisma/migrations/) in the
`foodlog_app` schema and are addressed here by the same quoted, case-sensitive
names Prisma used (e.g. "User", "passwordHash"). Nothing here depends on Prisma at
runtime; this talks to PostgreSQL directly.
"""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from typing import Iterator
from urllib.parse import urlparse, parse_qs

from urllib.parse import urlencode, urlunparse

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


def new_id() -> str:
    """An opaque unique id. Does not need to match Prisma's cuid format -- it is
    just a primary key value, and both formats are plain text."""
    return uuid.uuid4().hex


def _split_schema(database_url: str) -> tuple[str, str | None]:
    """
    Pulls Prisma's `?schema=...` query parameter out of the URL.

    Prisma's own driver (and Node's `pg`) ignore unrecognised query parameters,
    but libpq -- which psycopg uses -- rejects them outright ("invalid URI query
    parameter"). The schema still has to be applied, just via `options`
    (`-c search_path=...`) instead of a query parameter.
    """
    parsed = urlparse(database_url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    schema_values = query.pop("schema", None)
    schema = schema_values[0] if schema_values else None
    clean = urlunparse(parsed._replace(query=urlencode(query, doseq=True)))
    return clean, schema


class Database:
    """Thin wrapper around a psycopg connection pool, scoped to one schema."""

    def __init__(self, database_url: str):
        conninfo, schema = _split_schema(database_url)
        kwargs: dict = {"row_factory": dict_row}
        if schema:
            kwargs["options"] = f"-c search_path={schema}"
        self._pool = ConnectionPool(
            conninfo,
            min_size=0,
            max_size=3,
            open=True,
            kwargs=kwargs,
        )

    @contextmanager
    def cursor(self) -> Iterator:
        with self._pool.connection() as conn:
            with conn.cursor() as cur:
                yield cur

    def ping(self) -> None:
        with self.cursor() as cur:
            cur.execute("SELECT 1")

    def close(self) -> None:
        self._pool.close()
