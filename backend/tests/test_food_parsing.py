from __future__ import annotations

import pytest

from backend.app.modules.parsing.food_parsing import (
    food_key,
    learn_food,
    parse_fragment,
    parse_meal,
    split_fragments,
)

from .conftest import requires_db


def test_splits_on_and_comma_and_plus_but_never_on_with():
    assert split_fragments("2 eggs and toast, rice + milk") == ["2 eggs", "toast", "rice", "milk"]
    assert split_fragments("burger with cheese") == ["burger with cheese"]


def test_reads_the_quantity_and_the_food_name():
    assert parse_fragment("I had 2 eggs") == {"quantity": 2.0, "name": "eggs"}
    assert parse_fragment("200 g rice") == {"quantity": 200.0, "name": "rice"}
    assert parse_fragment("toast") == {"quantity": 1.0, "name": "toast"}


def test_same_key_for_singular_plural_and_reordered_names():
    assert food_key("Eggs") == food_key("egg")
    assert food_key("brown rice") == food_key("rice brown")
    assert food_key("glass") == "glass"


EGG_ITEM = {
    "name": "egg",
    "quantity": 2,
    "unit": "piece",
    "calories": 140,
    "protein": 12,
    "carbs": 1,
    "fat": 10,
    "sugar": 0,
    "fiber": 0,
}


class _CountingAi:
    def __init__(self, items):
        self.items = items
        self.calls: list[str] = []

    async def __call__(self, text: str):
        self.calls.append(text)
        return self.items


@requires_db
async def test_calls_the_ai_for_an_unknown_food_then_saves_it(db, new_email):
    from backend.app.modules.auth import service as auth_service

    user = auth_service.register(db, new_email(), "Parse", "a long test passphrase")
    ai = _CountingAi([EGG_ITEM])

    first = await parse_meal(db, user["id"], "2 eggs", ai)

    assert len(ai.calls) == 1
    assert first[0]["name"] == "egg"
    assert first[0]["source"] == "ai"
    assert first[0]["calories"] == 140

    with db.cursor() as cur:
        cur.execute(
            'SELECT "caloriesPerUnit" FROM "FoodDictionaryEntry" WHERE "userId" = %s AND key = %s',
            (user["id"], food_key("egg")),
        )
        saved = cur.fetchone()
    assert saved is not None
    assert abs(saved["caloriesPerUnit"] - 70) < 0.01


@requires_db
async def test_repeat_food_is_answered_from_the_saved_table_with_no_ai_call(db, new_email):
    from backend.app.modules.auth import service as auth_service

    user = auth_service.register(db, new_email(), "Parse", "a long test passphrase")
    await parse_meal(db, user["id"], "2 eggs", _CountingAi([EGG_ITEM]))

    ai = _CountingAi([EGG_ITEM])
    again = await parse_meal(db, user["id"], "3 eggs", ai)

    assert len(ai.calls) == 0
    assert again[0]["source"] == "dictionary"
    assert again[0]["quantity"] == 3
    assert again[0]["calories"] == 210


@requires_db
async def test_only_the_unknown_part_of_a_meal_is_sent_to_the_ai(db, new_email):
    from backend.app.modules.auth import service as auth_service

    user = auth_service.register(db, new_email(), "Parse", "a long test passphrase")
    await parse_meal(db, user["id"], "2 eggs", _CountingAi([EGG_ITEM]))

    toast_ai = _CountingAi(
        [{"name": "toast", "quantity": 1, "unit": "slice", "calories": 80, "protein": 3, "carbs": 15, "fat": 1, "sugar": 2, "fiber": 2}]
    )
    mixed = await parse_meal(db, user["id"], "2 eggs and toast", toast_ai)

    assert toast_ai.calls == ["toast"]
    assert [f["source"] for f in mixed] == ["dictionary", "ai"]


@requires_db
async def test_saved_foods_never_shared_between_users(db, new_email):
    from backend.app.modules.auth import service as auth_service

    owner = auth_service.register(db, new_email(), "Owner", "a long test passphrase")
    other = auth_service.register(db, new_email(), "Other", "a long test passphrase")
    await parse_meal(db, owner["id"], "2 eggs", _CountingAi([EGG_ITEM]))

    ai = _CountingAi([EGG_ITEM])
    result = await parse_meal(db, other["id"], "2 eggs", ai)

    assert len(ai.calls) == 1
    assert result[0]["source"] == "ai"
