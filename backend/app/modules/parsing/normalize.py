"""Ported from shared/normalize.ts."""

from __future__ import annotations

import re

_REPLACEMENTS = [
    (re.compile(r"\bgms\b", re.IGNORECASE), "grams"),
    (re.compile(r"\bgm\b", re.IGNORECASE), "grams"),
    (re.compile(r"\bg\b", re.IGNORECASE), "grams"),
    (re.compile(r"\bkgs?\b", re.IGNORECASE), "kilograms"),
    (re.compile(r"\bml\b", re.IGNORECASE), "ml"),
    (re.compile(r"\bl\b", re.IGNORECASE), "liters"),
    (re.compile(r"\bpcs?\b", re.IGNORECASE), "pieces"),
]


def normalize_food_input(text: str) -> str:
    if not text:
        return ""
    result = text.lower().strip()
    for pattern, replacement in _REPLACEMENTS:
        result = pattern.sub(replacement, result)
    return result
