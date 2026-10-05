from __future__ import annotations

import re

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, ValidationError, field_validator

from ...errors import ApiError
from ...logging_utils import log
from ..auth.routes import require_auth
from . import gemini_client
from .food_parsing import AiFood, ParsedFood, parse_meal

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_IMAGE_BASE64 = 6 * 1024 * 1024


class ParseInput(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    image: str | None = Field(default=None, max_length=MAX_IMAGE_BASE64)
    mime_type: str | None = Field(default=None, alias="mimeType")

    model_config = {"populate_by_name": True}

    @field_validator("text")
    @classmethod
    def _trim_and_require_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Describe what you ate")
        return trimmed


def _split_quantity(quantity: str) -> tuple[float, str]:
    """Reads "2 piece", "200 g", "1 serving" into a number and a unit."""
    match = re.match(r"^(\d+(?:\.\d+)?)\s*(.*)$", quantity.strip())
    qty = float(match.group(1)) if match and match.group(1) else 1.0
    unit = (match.group(2) if match else "").strip() or "piece"
    return qty, unit


async def _gemini_ai_parser(text: str) -> list[AiFood]:
    """The production AI parser: Gemini, reshaped into the food_parsing item format."""
    response = await gemini_client.call_gemini(text)
    if response.get("status") != "valid" or not response.get("items"):
        return []
    foods: list[AiFood] = []
    for item in response["items"]:
        qty, unit = _split_quantity(str(item.get("quantity", "1")))
        foods.append(
            {
                "name": item["name"],
                "quantity": qty,
                "unit": unit,
                "calories": item["calories"],
                "protein": item["protein"],
                "carbs": item["carbs"],
                "fat": item["fat"],
                "sugar": item["sugar"],
                "fiber": item["fiber"],
            }
        )
    return foods


def _format_number(value: float) -> str:
    """Python floats always carry a decimal (1.0); whole numbers should read as "1", not "1.0"."""
    return str(int(value)) if value == int(value) else str(value)


def _to_client_item(food: ParsedFood) -> dict:
    """The item shape the frontend's review table already uses."""
    return {
        "name": food["name"],
        "quantity": f"{_format_number(food['quantity'])} {food['unit']}",
        "calories": food["calories"],
        "protein": food["protein"],
        "carbs": food["carbs"],
        "fat": food["fat"],
        "sugar": food["sugar"],
        "fiber": food["fiber"],
        "source": food["source"],
        "baseFoodName": food["name"],
        "baseUnit": food["unit"],
        "baseQty": food["quantity"],
    }


def _totals_of(foods: list[ParsedFood]) -> dict:
    def total(key: str) -> float:
        return round(sum(f[key] for f in foods) * 10) / 10

    return {
        "calories": round(total("calories")),
        "protein": total("protein"),
        "carbs": total("carbs"),
        "fat": total("fat"),
        "sugar": total("sugar"),
        "fiber": total("fiber"),
    }


@router.post("/parse-food")
async def parse_food_route(request: Request):
    user_id = require_auth(request)
    body = await request.json()
    try:
        data = ParseInput.model_validate(body)
    except ValidationError as exc:
        raise ApiError(422, "VALIDATION_ERROR", exc.errors()[0]["msg"])

    db = request.app.state.db
    ai = request.app.state.ai_parser or _gemini_ai_parser

    try:
        if data.image:
            if not data.mime_type or data.mime_type not in ALLOWED_IMAGE_TYPES:
                raise ApiError(422, "VALIDATION_ERROR", "Unsupported image type.")
            labelled = await gemini_client.parse_with_label(data.text, data.image, data.mime_type)
            items = [{**item, "source": "label"} for item in labelled.get("items", [])]
            return {"success": True, "data": {**labelled, "items": items}}

        foods = await parse_meal(db, user_id, data.text, ai)
        if not foods:
            return {"success": True, "data": {"status": "invalid", "reason": "Input is not a valid food item"}}

        items = [_to_client_item(f) for f in foods]
        reply = "Recognised " + " and ".join(f"{i['quantity']} of {i['name']}" for i in items) + "."
        return {
            "success": True,
            "data": {"status": "valid", "reply": reply, "items": items, "totals": _totals_of(foods)},
        }
    except ApiError:
        raise
    except Exception as err:  # noqa: BLE001 -- deliberately broad: the AI or database failed
        log("error", "food parse failed", error_name=type(err).__name__)
        raise ApiError(503, "PARSER_UNAVAILABLE", "The food parser is unavailable right now. Try again shortly.")
