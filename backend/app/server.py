"""Local development entry point: `python backend/app/server.py`."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

# The root .env holds DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, CORS_ORIGIN, PORT.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import uvicorn  # noqa: E402

from backend.app.config import load_env  # noqa: E402
from backend.app.db import Database  # noqa: E402
from backend.app.main import create_app  # noqa: E402
from backend.app.logging_utils import log  # noqa: E402

settings = load_env()
db = Database(settings.database_url)

app = create_app(
    cors_origin=settings.cors_origin,
    db=db,
    ping_database=db.ping,
    settings=settings,
)

if __name__ == "__main__":
    log("info", "server started", port=settings.port, env=settings.env)
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
