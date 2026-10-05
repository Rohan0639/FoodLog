"""
Parses a meal using the user's own saved foods first.

Known foods are answered from PostgreSQL with no AI call. Unknown fragments are
sent to the AI parser once, and the results are saved for next time. Ported from
server/src/modules/parsing/foodParsing.ts; keep the two in step if either changes.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypedDict

from ...db import Database, new_id

UNIT_WORDS = re.compile(
    r"\b(grams?|g|ml|liters?|l|pieces?|pcs?|slices?|cups?|tbsp|tsp|servings?|bowls?|glasses?)\b"
)


class AiFood(TypedDict):
    name: str
    quantity: float
    unit: str
    calories: float
    protein: float
    carbs: float
    fat: float
    sugar: float
    fiber: float


class ParsedFood(AiFood):
    source: str  # 'dictionary' | 'ai'


AiParser = Callable[[str], Awaitable[list[AiFood]]]


def split_fragments(text: str) -> list[str]:
    """Splits "2 eggs and toast" into fragments. Never splits on "with"."""
    parts = re.split(r"\band\b|,|\+", text, flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()]


def parse_fragment(fragment: str) -> dict:
    """Pulls the leading quantity and the food name out of one fragment."""
    match = re.match(r"^(?:i\s+(?:had|ate)\s+)?(\d+(?:\.\d+)?)?\s*(.*)$", fragment.lower())
    quantity = float(match.group(1)) if match and match.group(1) else 1.0
    raw_name = match.group(2) if match else fragment
    name = UNIT_WORDS.sub(" ", raw_name)
    name = re.sub(r"\s+", " ", name).strip()
    return {"quantity": quantity, "name": name}


def food_key(name: str) -> str:
    """
    The lookup key for a food name: lower case, singular, word order ignored.
    "2 Eggs" and "egg" both give "egg"; "brown rice" and "rice brown" agree.
    """
    words = [w for w in name.lower().split() if w]

    def singular(word: str) -> str:
        if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
            return word[:-1]
        return word

    return " ".join(sorted(singular(w) for w in words))


def _round(value: float, places: int = 1) -> float:
    factor = 10**places
    return round(value * factor) / factor


async def parse_meal(db: Database, user_id: str, text: str, ai: AiParser) -> list[ParsedFood]:
    fragments = [{"fragment": f, **parse_fragment(f)} for f in split_fragments(text)]
    keys = [k for k in (food_key(f["name"]) for f in fragments) if k]

    known: dict[str, dict] = {}
    if keys:
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT key, name, "baseUnit", "caloriesPerUnit", "proteinPerUnit",
                       "carbsPerUnit", "fatPerUnit", "sugarPerUnit", "fiberPerUnit"
                FROM "FoodDictionaryEntry"
                WHERE "userId" = %s AND key = ANY(%s)
                """,
                (user_id, keys),
            )
            for row in cur.fetchall():
                known[row["key"]] = row

    results: list[ParsedFood] = []
    misses: list[str] = []

    for f in fragments:
        entry = known.get(food_key(f["name"]))
        if not entry:
            misses.append(f["fragment"])
            continue
        qty = f["quantity"]
        results.append(
            {
                "name": entry["name"],
                "quantity": qty,
                "unit": entry["baseUnit"],
                "calories": _round(entry["caloriesPerUnit"] * qty, 0),
                "protein": _round(entry["proteinPerUnit"] * qty),
                "carbs": _round(entry["carbsPerUnit"] * qty),
                "fat": _round(entry["fatPerUnit"] * qty),
                "sugar": _round(entry["sugarPerUnit"] * qty),
                "fiber": _round(entry["fiberPerUnit"] * qty),
                "source": "dictionary",
            }
        )

    if misses:
        ai_items = await ai(" and ".join(misses))
        # The AI may rename foods ("eggs" -> "large eggs"), so when the counts match,
        # save each food under the name the user typed. That is what the next lookup uses.
        aligned = len(ai_items) == len(misses)
        for index, item in enumerate(ai_items):
            results.append({**item, "source": "ai"})
            typed_name = parse_fragment(misses[index])["name"] if aligned else None
            learn_food(db, user_id, item, typed_name)

    if known:
        with db.cursor() as cur:
            cur.execute(
                """
                UPDATE "FoodDictionaryEntry"
                SET "timesLogged" = "timesLogged" + 1, "lastUsedAt" = %s
                WHERE "userId" = %s AND key = ANY(%s)
                """,
                (datetime.now(timezone.utc), user_id, list(known.keys())),
            )

    return results


def learn_food(db: Database, user_id: str, item: AiFood, typed_name: str | None = None) -> None:
    """Saves one AI result as a per-unit entry, so any later quantity can be rescaled."""
    if item["quantity"] <= 0:
        return
    key = food_key(typed_name if typed_name is not None else item["name"])
    if not key:
        return

    qty = item["quantity"]
    per_unit = {
        "caloriesPerUnit": item["calories"] / qty,
        "proteinPerUnit": item["protein"] / qty,
        "carbsPerUnit": item["carbs"] / qty,
        "fatPerUnit": item["fat"] / qty,
        "sugarPerUnit": item["sugar"] / qty,
        "fiberPerUnit": item["fiber"] / qty,
    }
    now = datetime.now(timezone.utc)

    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "FoodDictionaryEntry"
                (id, "userId", key, name, "baseUnit", "caloriesPerUnit", "proteinPerUnit",
                 "carbsPerUnit", "fatPerUnit", "sugarPerUnit", "fiberPerUnit", source,
                 "timesLogged", "lastUsedAt", "createdAt", "updatedAt")
            VALUES (%(id)s, %(userId)s, %(key)s, %(name)s, %(baseUnit)s, %(caloriesPerUnit)s,
                    %(proteinPerUnit)s, %(carbsPerUnit)s, %(fatPerUnit)s, %(sugarPerUnit)s,
                    %(fiberPerUnit)s, 'AI', 1, %(now)s, %(now)s, %(now)s)
            ON CONFLICT ("userId", key) DO UPDATE SET
                "timesLogged" = "FoodDictionaryEntry"."timesLogged" + 1,
                "lastUsedAt" = EXCLUDED."lastUsedAt"
            """,
            {
                "id": new_id(),
                "userId": user_id,
                "key": key,
                "name": item["name"].lower(),
                "baseUnit": item["unit"],
                "now": now,
                **per_unit,
            },
        )
