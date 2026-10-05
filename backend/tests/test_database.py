from __future__ import annotations

from datetime import date, datetime, timezone

import psycopg
import pytest

from backend.app.db import new_id
from backend.app.modules.auth import service as auth_service

from .conftest import requires_db

pytestmark = requires_db


def test_answers_a_trivial_query(db):
    db.ping()


def test_stores_a_user_and_reads_it_back(db, new_email):
    email = new_email()
    user = auth_service.register(db, email, "Test", "a long test passphrase")
    found = auth_service.find_user(db, user["id"])
    assert found["email"] == email


def test_rejects_a_duplicate_email(db, new_email):
    email = new_email()
    auth_service.register(db, email, "A", "a long test passphrase")
    with pytest.raises(auth_service.AuthError) as exc:
        auth_service.register(db, email, "B", "a long test passphrase")
    assert exc.value.code == "EMAIL_TAKEN"


def test_allows_only_one_diary_day_per_user(db, new_email):
    user = auth_service.register(db, new_email(), "Day", "a long test passphrase")
    now = datetime.now(timezone.utc)
    with db.cursor() as cur:
        cur.execute(
            'INSERT INTO "FoodLog" (id, "userId", date, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s)',
            (new_id(), user["id"], date(2026, 1, 15), now, now),
        )
        with pytest.raises(psycopg.errors.UniqueViolation):
            cur.execute(
                'INSERT INTO "FoodLog" (id, "userId", date, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s)',
                (new_id(), user["id"], date(2026, 1, 15), now, now),
            )
        cur.connection.rollback()  # the failed insert left the transaction aborted


def test_deletes_logs_items_and_goal_with_the_user(db, new_email):
    user = auth_service.register(db, new_email(), "Cascade", "a long test passphrase")
    now = datetime.now(timezone.utc)
    log_id = new_id()
    item_id = new_id()
    with db.cursor() as cur:
        cur.execute(
            'INSERT INTO "FoodLog" (id, "userId", date, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s)',
            (log_id, user["id"], date(2026, 2, 1), now, now),
        )
        cur.execute(
            """INSERT INTO "FoodItem" (id, "foodLogId", name, quantity, unit, calories, protein, carbs, fat, sugar, fiber, source, "createdAt", "updatedAt")
               VALUES (%s,%s,'egg',2,'piece',140,12,1,10,0,0,'AI',%s,%s)""",
            (item_id, log_id, now, now),
        )
        cur.execute(
            'INSERT INTO "DailyGoal" (id, "userId", "updatedAt") VALUES (%s,%s,%s)',
            (new_id(), user["id"], now),
        )
        cur.execute('DELETE FROM "User" WHERE id = %s', (user["id"],))

        cur.execute('SELECT count(*) AS n FROM "FoodLog" WHERE id = %s', (log_id,))
        assert cur.fetchone()["n"] == 0
        cur.execute('SELECT count(*) AS n FROM "FoodItem" WHERE id = %s', (item_id,))
        assert cur.fetchone()["n"] == 0
        cur.execute('SELECT count(*) AS n FROM "DailyGoal" WHERE "userId" = %s', (user["id"],))
        assert cur.fetchone()["n"] == 0


def test_favourite_is_unique_per_user_and_name(db, new_email):
    user = auth_service.register(db, new_email(), "Fav", "a long test passphrase")
    now = datetime.now(timezone.utc)
    with db.cursor() as cur:
        cur.execute(
            """INSERT INTO "FavoriteFood" (id, "userId", name, quantity, unit, calories, protein, carbs, fat, "createdAt")
               VALUES (%s,%s,'banana',1,'piece',90,1,23,0,%s)""",
            (new_id(), user["id"], now),
        )
        with pytest.raises(psycopg.errors.UniqueViolation):
            cur.execute(
                """INSERT INTO "FavoriteFood" (id, "userId", name, quantity, unit, calories, protein, carbs, fat, "createdAt")
                   VALUES (%s,%s,'banana',1,'piece',90,1,23,0,%s)""",
                (new_id(), user["id"], now),
            )
        cur.connection.rollback()
