"""
Gemini text parsing and nutrition-label reading. Ported from
backend/services/gemini.ts and backend/services/labelReader.ts (the original
TypeScript backend) so the prompts, retry behaviour and validation are unchanged.
"""

from __future__ import annotations

import json
import os
import re

import httpx

from .normalize import normalize_food_input
from .validator import validate_gemini_response

MODEL_NAME = "gemini-3.1-flash-lite"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"

TEXT_TIMEOUT_SECONDS = 20
LABEL_TIMEOUT_SECONDS = 30
MAX_ATTEMPTS = 2
RETRY_BACKOFF_SECONDS = 0.6

TEXT_PROMPT_TEMPLATE = """You are an advanced food parsing and nutrition extraction engine.

Your task is to convert natural language food input into accurate structured food items with correct quantities and realistic nutritional values.

## CRITICAL RULES

1. NEVER oversimplify food items.
   - "KFC rice bowl" must NOT become "rice"
   - "peri peri chicken strips" must NOT become "chicken breast"
   - Preserve brand, preparation style, and dish type in the name

2. Treat multi-word foods as SINGLE entities when appropriate.
   - "fried rice", "rice bowl", "chicken strips", "burger", "pizza slice"

3. Detect brand and restaurant foods.
   - KFC, McDonald's, Domino's, Subway, etc.
   - These are COMPOSITE FOODS -> estimate realistic macros for the whole dish

4. Handle quantities correctly:
   - Extract numbers (300g, 2 pieces, 1 cup, etc.)
   - Normalize units: g, ml, piece, slice, serving

5. If weight is given (like 300g):
   - Calculate nutrition proportionally based on weight
   - Do NOT ignore weight

6. If food is complex or branded:
   - Estimate macros based on real-world nutritional data
   - DO NOT fallback to generic base ingredients

7. Split multiple items on "and", ",", "+" only.
   - DO NOT split on "with" if it describes a single dish (e.g. "burger with cheese" is ONE item)

## INPUT VALIDATION

First, check if the input describes real, edible food or drink.
If the input is not food (e.g., objects, people, jokes, unrealistic items like "my friend", "stone", "car"), respond ONLY with:
{{
  "status": "invalid",
  "reason": "Input is not a valid food item"
}}

## OUTPUT FORMAT (for valid food)

Respond ONLY in JSON format. No explanation.

{{
  "status": "valid",
  "reply": "A friendly confirmation summarizing the food items and a helpful tip.",
  "items": [
    {{
      "name": "full food name (preserve brand and preparation)",
      "quantity": "string quantity description (e.g. '1 serving', '300g', '2 pieces')",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "sugar": number,
      "fiber": number,
      "baseFoodName": "normalized base name (singular, lowercase, e.g. 'kfc rice bowl', 'pizza', 'banana')",
      "baseName": "short normalized name without brand (e.g. 'rice bowl', 'chicken strips')",
      "brand": "brand name or null (e.g. 'KFC', 'McDonald\\'s', null)",
      "baseUnit": "base unit of lookup (e.g. 'serving', 'piece', 'grams', 'ml')",
      "baseQty": number,
      "caloriesPerUnit": number,
      "proteinPerUnit": number,
      "carbsPerUnit": number,
      "fatPerUnit": number,
      "sugarPerUnit": number,
      "fiberPerUnit": number,
      "aliases": ["array of common string aliases"]
    }}
  ],
  "totals": {{
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "sugar": number,
    "fiber": number
  }}
}}

Use realistic values for macros, sugar, fiber and calories:
- Max calories per gram <= 9 kcal
- Ensure macros match calories:
  calories ~= (protein*4 + carbs*4 + fat*9)

No explanation. Only JSON.

Sentence to analyze: "{sentence}"
"""

LABEL_PROMPT = """You are logging a meal. You are given what the user says they ate,
and a photograph of the nutrition label from that product.

## DIVISION OF EVIDENCE -- this is the important part

From the USER'S TEXT, take:
  - the food name
  - how much they ate (quantity and unit)

From the LABEL PHOTO, take:
  - every nutrition figure

NEVER estimate a nutrition figure that the label shows. NEVER let a typical
value for this kind of food override what is printed. The label wins.

## READING THE LABEL

Find the serving the panel's figures refer to -- "per 2 slices", "per 100g",
"per serving (30g)". Then scale those figures to the amount the USER ate.

Example:
  user says     "I ate 3 slices of brown bread"
  label says    "per 2 slices: 132 kcal, 5g protein"
  you return    quantity "3 slices", calories 198, protein 7.5
                (because 3/2 x the panel figures)

Energy printed in kJ converts to kcal by dividing by 4.184.

## IF THE LABEL IS UNREADABLE

If the image is blurred, cropped, not a nutrition panel, or you cannot read the
figures with confidence, DO NOT GUESS. Respond only with:
{"status":"label_unreadable"}

## OUTPUT

Respond ONLY with JSON:
{
  "status": "valid",
  "reply": "a short friendly confirmation mentioning you used the label",
  "items": [
    {
      "name": "food name, from the user's words, including brand if stated",
      "quantity": "what the user ate, e.g. '3 slices'",
      "calories": number,
      "protein": number, "carbs": number, "fat": number,
      "sugar": number, "fiber": number,
      "baseFoodName": "normalised name, lowercase",
      "brand": "brand from the label, or null",
      "baseUnit": "the unit the label's own figures use: slice, grams, ml, piece, serving",
      "baseQty": number,
      "caloriesPerUnit": number,
      "proteinPerUnit": number, "carbsPerUnit": number, "fatPerUnit": number,
      "sugarPerUnit": number, "fiberPerUnit": number,
      "aliases": ["other names the user might type for this"]
    }
  ],
  "totals": { "calories": number, "protein": number, "carbs": number,
              "fat": number, "sugar": number, "fiber": number }
}

If the user mentions foods the label does not cover, include them too, using
your own knowledge for those items only."""


class GeminiError(Exception):
    pass


def _api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise GeminiError("Missing Gemini API Key in server environment variables! Please configure GEMINI_API_KEY.")
    return key


def _extract_json(raw_text: str) -> dict:
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise GeminiError(f"Could not find valid JSON object markers in response text: {raw_text[:200]}")
    return json.loads(raw_text[start : end + 1])


def _retryable(status: int) -> bool:
    return status == 429 or status >= 500


async def call_gemini(food_text: str) -> dict:
    normalized = normalize_food_input(food_text)
    prompt = TEXT_PROMPT_TEMPLATE.format(sentence=normalized.replace('"', '\\"'))

    url = f"{API_URL}?key={_api_key()}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    last_error: Exception | None = None
    response: httpx.Response | None = None

    async with httpx.AsyncClient(timeout=TEXT_TIMEOUT_SECONDS) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = await client.post(url, json=body)
                if response.status_code < 400:
                    break
                last_error = GeminiError(f"Gemini API returned status {response.status_code}: {response.text[:300]}")
                if not _retryable(response.status_code) or attempt == MAX_ATTEMPTS:
                    raise last_error
            except httpx.TimeoutException:
                last_error = GeminiError(f"Gemini API timed out after {TEXT_TIMEOUT_SECONDS}s")
                if attempt == MAX_ATTEMPTS:
                    raise last_error
            if attempt < MAX_ATTEMPTS:
                import asyncio

                await asyncio.sleep(RETRY_BACKOFF_SECONDS)

        if response is None or response.status_code >= 400:
            raise last_error or GeminiError("Gemini API request failed.")

        data = response.json()

    candidates = data.get("candidates")
    if not candidates:
        raise GeminiError("Gemini API did not return any candidates.")

    raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
    if not raw_text:
        raise GeminiError("Gemini API returned an empty response.")

    try:
        parsed = _extract_json(raw_text.strip())
    except json.JSONDecodeError as exc:
        raise GeminiError(f"JSON parsing failed: {exc}. Raw text: {raw_text[:300]}")

    validate_gemini_response(parsed)
    return parsed


def _is_implausible(items: list[dict]) -> str | None:
    """Looser than the text validator: a real label can legitimately look extreme."""
    for item in items:
        match = re.match(r"^(\d+(?:\.\d+)?)\s*(g|grams?|ml)\b", str(item.get("quantity", "")), re.IGNORECASE)
        if not match:
            continue
        weight = float(match.group(1))
        if weight <= 0:
            continue
        calories = float(item.get("calories", 0) or 0)
        protein = float(item.get("protein", 0) or 0)
        carbs = float(item.get("carbs", 0) or 0)
        fat = float(item.get("fat", 0) or 0)
        if calories > weight * 9.5:
            return f'{item.get("name")}: {calories} kcal is impossible for {weight}g.'
        if protein + carbs + fat > weight * 1.1:
            return f'{item.get("name")}: the macros exceed the stated weight.'
    return None


async def parse_with_label(text: str, image_base64: str, mime_type: str) -> dict:
    key = _api_key()
    url = f"{API_URL}?key={key}"
    body = {
        "contents": [
            {
                "parts": [
                    {"text": LABEL_PROMPT},
                    {"text": f'\n\nThe user said: "{normalize_food_input(text).replace(chr(34), chr(92) + chr(34))}"'},
                    {"inline_data": {"mime_type": mime_type, "data": image_base64}},
                ]
            }
        ],
        # Zero temperature: reading printed digits is not a creative task.
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
    }

    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=LABEL_TIMEOUT_SECONDS) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = await client.post(url, json=body)
                if not response.is_success:
                    last_error = GeminiError(f"Gemini returned {response.status_code}: {response.text[:300]}")
                    if response.status_code < 500 and response.status_code != 429:
                        raise last_error
                    if attempt == MAX_ATTEMPTS:
                        raise last_error
                    import asyncio

                    await asyncio.sleep(0.7)
                    continue

                data = response.json()
                raw = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
                if not raw:
                    raise GeminiError("Gemini returned an empty response.")

                start, end = raw.find("{"), raw.rfind("}")
                if start == -1 or end == -1:
                    raise GeminiError("No JSON object in the response.")
                parsed = json.loads(raw[start : end + 1])

                if parsed.get("status") == "label_unreadable":
                    return {"status": "invalid", "labelRead": False, "labelNote": "unreadable"}
                if parsed.get("status") != "valid" or not parsed.get("items"):
                    return {"status": "invalid", "labelRead": False, "labelNote": "no-items"}

                implausible = _is_implausible(parsed["items"])
                if implausible:
                    return {"status": "invalid", "labelRead": False, "labelNote": "implausible"}

                parsed["labelRead"] = True
                return parsed
            except httpx.TimeoutException:
                last_error = GeminiError(f"Reading the label timed out after {LABEL_TIMEOUT_SECONDS}s")
                if attempt == MAX_ATTEMPTS:
                    raise last_error
                import asyncio

                await asyncio.sleep(0.7)

    raise last_error or GeminiError("Could not read the label.")
