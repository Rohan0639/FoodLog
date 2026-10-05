from __future__ import annotations

from starlette.testclient import TestClient

from backend.app.main import create_app
from backend.app.modules.parsing.food_parsing import food_key

from .conftest import ORIGIN, requires_db

pytestmark = requires_db

PASSWORD = "a long test passphrase"


class _CallCounter:
    def __init__(self):
        self.calls = 0

    async def __call__(self, _text: str):
        self.calls += 1
        return [{"name": "egg", "quantity": 2, "unit": "piece", "calories": 140, "protein": 12, "carbs": 1, "fat": 10, "sugar": 0, "fiber": 0}]


def _make_client(db, settings, ai=None):
    app = create_app(cors_origin=ORIGIN, db=db, ping_database=db.ping, settings=settings, ai_parser=ai)
    return TestClient(app)


def test_register_hashes_the_password_and_sets_an_httponly_cookie(db, settings, new_email):
    client = _make_client(db, settings)
    email = new_email()

    res = client.post("/api/auth/register", json={"email": email, "name": "Ana", "password": PASSWORD})

    assert res.status_code == 201
    user = res.json()["data"]["user"]
    assert user == {"id": user["id"], "email": email, "name": "Ana"}
    assert "passwordHash" not in user

    set_cookie = res.headers.get("set-cookie", "")
    assert "foodlog_session=" in set_cookie
    assert "httponly" in set_cookie.lower()

    with db.cursor() as cur:
        cur.execute('SELECT "passwordHash" FROM "User" WHERE email = %s', (email,))
        stored = cur.fetchone()
    assert PASSWORD not in stored["passwordHash"]
    assert stored["passwordHash"].startswith("$argon2id$")


def test_rejects_a_duplicate_email_with_409(db, settings, new_email):
    client = _make_client(db, settings)
    email = new_email()
    client.post("/api/auth/register", json={"email": email, "name": "A", "password": PASSWORD})
    again = client.post("/api/auth/register", json={"email": email, "name": "B", "password": PASSWORD})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "EMAIL_TAKEN"


def test_rejects_bad_input_with_field_messages_not_stack_traces(db, settings):
    client = _make_client(db, settings)
    res = client.post("/api/auth/register", json={"email": "not-an-email", "name": "", "password": "x"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_same_generic_error_for_wrong_password_and_unknown_email(db, settings, new_email):
    client = _make_client(db, settings)
    email = new_email()
    client.post("/api/auth/register", json={"email": email, "name": "C", "password": PASSWORD})

    wrong_password = client.post("/api/auth/login", json={"email": email, "password": "wrong password 1"})
    unknown_email = client.post("/api/auth/login", json={"email": new_email(), "password": "wrong password 1"})

    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    assert wrong_password.json()["error"]["message"] == unknown_email.json()["error"]["message"]


def test_logs_in_with_the_right_password(db, settings, new_email):
    client = _make_client(db, settings)
    email = new_email()
    client.post("/api/auth/register", json={"email": email, "name": "D", "password": PASSWORD})
    res = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200
    assert "set-cookie" in res.headers


def test_me_requires_a_session():
    db_none_client = TestClient(create_app(cors_origin=ORIGIN))
    res = db_none_client.get("/api/auth/me")
    assert res.status_code in (401, 404)  # 404 when no db is wired at all (routers unmounted)


def test_me_rejects_a_forged_token(db, settings):
    client = _make_client(db, settings)
    client.cookies.set("foodlog_session", "not.a.real.token")
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_returns_the_current_user_and_logout_ends_the_session(db, settings, new_email):
    client = _make_client(db, settings)
    email = new_email()
    client.post("/api/auth/register", json={"email": email, "name": "E", "password": PASSWORD})

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["data"]["user"]["email"] == email

    client.post("/api/auth/logout")
    after = client.get("/api/auth/me")
    assert after.status_code == 401


def test_parse_refuses_without_a_session(db, settings):
    client = _make_client(db, settings)
    res = client.post("/api/parse-food", json={"text": "2 eggs"})
    assert res.status_code == 401


def test_parse_validates_the_text(db, settings, new_email):
    client = _make_client(db, settings)
    client.post("/api/auth/register", json={"email": new_email(), "name": "F", "password": PASSWORD})
    res = client.post("/api/parse-food", json={"text": "   "})
    assert res.status_code == 422


def test_parse_calls_ai_once_then_answers_the_repeat_from_saved_foods(db, settings, new_email):
    ai = _CallCounter()
    client = _make_client(db, settings, ai=ai)
    email = new_email()
    reg = client.post("/api/auth/register", json={"email": email, "name": "G", "password": PASSWORD})
    user_id = reg.json()["data"]["user"]["id"]

    first = client.post("/api/parse-food", json={"text": "2 eggs"})
    assert first.status_code == 200
    assert first.json()["data"]["items"][0]["source"] == "ai"
    assert first.json()["data"]["items"][0]["calories"] == 140
    assert ai.calls == 1

    second = client.post("/api/parse-food", json={"text": "3 eggs"})
    assert second.status_code == 200
    assert second.json()["data"]["items"][0]["source"] == "dictionary"
    assert second.json()["data"]["items"][0]["calories"] == 210
    assert ai.calls == 1

    with db.cursor() as cur:
        cur.execute(
            'SELECT 1 FROM "FoodDictionaryEntry" WHERE "userId"=%s AND key=%s', (user_id, food_key("egg"))
        )
        assert cur.fetchone() is not None


def test_parse_reports_unavailable_without_leaking_the_cause(db, settings, new_email):
    async def broken(_text: str):
        raise RuntimeError("upstream secret detail")

    client = _make_client(db, settings, ai=broken)
    client.post("/api/auth/register", json={"email": new_email(), "name": "H", "password": PASSWORD})
    res = client.post("/api/parse-food", json={"text": "mystery pastry"})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "PARSER_UNAVAILABLE"
    assert "secret detail" not in res.text
