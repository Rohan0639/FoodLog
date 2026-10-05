"""
Physical nutrition & macro validator. Ported from backend/utils/validator.ts.
LLM outputs are rejected here before they ever reach the user.
"""

from __future__ import annotations

import re


class ValidationFailure(Exception):
    pass


def _extract_weight(quantity: str) -> tuple[float, str] | None:
    if not quantity:
        return None
    clean = quantity.lower().strip()

    m = re.match(r"^(\d+(?:\.\d+)?)\s*(?:g|gm|gms|grams?)$", clean)
    if m:
        return float(m.group(1)), "weight"

    m = re.match(r"^(\d+(?:\.\d+)?)\s*(?:ml|milliliters?)$", clean)
    if m:
        return float(m.group(1)), "volume"

    m = re.match(r"^(\d+(?:\.\d+)?)\s*(?:l|liters?)$", clean)
    if m:
        return float(m.group(1)) * 1000, "volume"

    return None


def validate_gemini_response(data: dict) -> None:
    if not isinstance(data, dict):
        raise ValidationFailure("Invalid structure: response data is not an object")

    if data.get("status") == "invalid":
        reason = data.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            raise ValidationFailure("Invalid structure: missing reason for invalid status")
        return

    if data.get("status") != "valid":
        raise ValidationFailure("Invalid structure: missing or invalid status field")

    items = data.get("items")
    if not isinstance(items, list):
        raise ValidationFailure("Invalid structure: missing items array")
    totals = data.get("totals")
    if not isinstance(totals, dict):
        raise ValidationFailure("Invalid structure: missing totals object")

    for field in ("calories", "protein", "carbs", "fat", "sugar", "fiber"):
        if totals.get(field, 0) < 0:
            raise ValidationFailure("Logical limit failure: negative macro or nutrient values in totals")
    if totals.get("calories", 0) > 5000:
        raise ValidationFailure(f"Logical limit failure: total calories ({totals['calories']}) exceed 5000 kcal")

    if totals.get("calories", 0) > 20:
        expected = totals["protein"] * 4 + totals["carbs"] * 4 + totals["fat"] * 9
        diff_pct = abs(expected - totals["calories"]) / totals["calories"]
        if diff_pct >= 0.20:
            raise ValidationFailure(
                f"Macro consistency failure on totals: expected {expected} kcal but reported "
                f"{totals['calories']} kcal (diff: {round(diff_pct * 100)}% >= 20%)"
            )

    for item in items:
        name = item.get("name")
        for field in ("calories", "protein", "carbs", "fat", "sugar", "fiber"):
            if not isinstance(item.get(field), (int, float)):
                raise ValidationFailure(f'Validation failure on item "{name}": nutrient values must be numbers')
            if item[field] < 0:
                raise ValidationFailure(f'Logical limit failure on item "{name}": negative nutrient values')

        if item["calories"] > 20:
            expected_item = item["protein"] * 4 + item["carbs"] * 4 + item["fat"] * 9
            diff_pct = abs(expected_item - item["calories"]) / item["calories"]
            if diff_pct >= 0.20:
                raise ValidationFailure(
                    f'Macro consistency failure on item "{name}": expected {expected_item} kcal but '
                    f"reported {item['calories']} kcal (diff: {round(diff_pct * 100)}% >= 20%)"
                )

        weight_info = _extract_weight(str(item.get("quantity", "")))
        if weight_info:
            weight_value, kind = weight_info
            if weight_value > 0:
                density = item["calories"] / weight_value
                if density > 9:
                    unit = "g" if kind == "weight" else "ml"
                    raise ValidationFailure(
                        f'Calorie density failure on item "{name}": {item["calories"]} kcal for '
                        f"{weight_value} {unit} has density {density:.2f} kcal/unit (exceeds 9 kcal/unit limit)"
                    )
                if kind == "weight":
                    macro_sum = item["protein"] + item["carbs"] + item["fat"]
                    if macro_sum > weight_value * 1.05:
                        raise ValidationFailure(
                            f'Weight consistency failure on item "{name}": sum of macros '
                            f"({macro_sum}g) exceeds total weight ({weight_value}g)"
                        )
