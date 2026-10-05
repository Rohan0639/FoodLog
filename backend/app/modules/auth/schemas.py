from __future__ import annotations

import os

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator

# `email_validator` rejects RFC 2606 reserved domains (example.com, *.test, ...)
# by default -- correct for production, but it would also reject every address
# this project's own tests use. Only relaxed outside production.
_IS_PRODUCTION = (os.environ.get("ENV") or os.environ.get("NODE_ENV") or "development") == "production"


def _validate_email(value: str) -> str:
    try:
        result = validate_email(value, check_deliverability=False, test_environment=not _IS_PRODUCTION)
    except EmailNotValidError as exc:
        raise ValueError(str(exc)) from exc
    return result.normalized.lower()


class RegisterInput(BaseModel):
    email: str = Field(max_length=255)
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=200)

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("name")
    @classmethod
    def _trim_name(cls, value: str) -> str:
        return value.strip()


class LoginInput(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _validate_email(value)
