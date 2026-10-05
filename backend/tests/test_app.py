from __future__ import annotations

from starlette.testclient import TestClient

from backend.app.main import create_app
from .conftest import ORIGIN

app = create_app(cors_origin=ORIGIN)
client = TestClient(app)


def test_health_returns_success_envelope():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"success": True, "data": {"status": "ok"}}


def test_health_db_not_configured_without_a_database():
    res = client.get("/api/health/db")
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "DB_NOT_CONFIGURED"


def test_health_db_ok_when_ping_succeeds():
    app2 = create_app(cors_origin=ORIGIN, ping_database=lambda: None)
    res = TestClient(app2).get("/api/health/db")
    assert res.status_code == 200
    assert res.json() == {"success": True, "data": {"database": "ok"}}


def test_health_db_reports_unavailable_without_leaking_the_cause():
    def failing():
        raise RuntimeError("connect ECONNREFUSED 10.0.0.1:5432 password=secret")

    app2 = create_app(cors_origin=ORIGIN, ping_database=failing)
    res = TestClient(app2).get("/api/health/db")
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "DB_UNAVAILABLE"
    assert "secret" not in res.text and "ECONNREFUSED" not in res.text


def test_security_headers_are_set():
    res = client.get("/api/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "server" not in res.headers or "uvicorn" not in res.headers.get("server", "").lower()


def test_unknown_api_route_returns_safe_404_envelope():
    res = client.get("/api/does-not-exist")
    assert res.status_code == 404
    assert res.json()["success"] is False
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_cors_allows_only_the_configured_origin():
    allowed = client.get("/api/health", headers={"Origin": ORIGIN})
    assert allowed.headers.get("access-control-allow-origin") == ORIGIN
    assert allowed.headers.get("access-control-allow-credentials") == "true"

    other = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in other.headers


def test_oversized_body_is_rejected_with_413():
    big = "x" * (9 * 1024 * 1024)
    res = client.post("/api/health", content=big.encode())
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
