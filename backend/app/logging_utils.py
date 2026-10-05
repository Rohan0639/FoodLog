"""
Structured (JSON-lines) logger. Fields whose names suggest a secret are redacted,
so a careless log call cannot leak a password, token or key.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

SECRET_KEYS = re.compile(r"pass(word)?|token|secret|authorization|cookie|key|passphrase", re.IGNORECASE)


def _redact(fields: dict[str, Any]) -> dict[str, Any]:
    return {k: ("[REDACTED]" if SECRET_KEYS.search(k) else v) for k, v in fields.items()}


def log(level: str, message: str, **fields: Any) -> None:
    line = json.dumps(
        {
            "time": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "message": message,
            **_redact(fields),
        },
        default=str,
    )
    print(line)
