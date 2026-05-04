"""Простейшие добавления столбцов для существующих БД (без Alembic)."""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import DATABASE_URL, engine


def ensure_users_email_verified_column(eng: Engine) -> None:
    insp = inspect(eng)
    if not insp.has_table("users"):
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "email_verified" in cols:
        return

    with eng.begin() as conn:
        if "sqlite" in DATABASE_URL.lower():
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN email_verified BOOLEAN "
                    "NOT NULL DEFAULT 0"
                )
            )
        else:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN email_verified BOOLEAN "
                    "NOT NULL DEFAULT FALSE"
                )
            )
        # Уже существовавшие пользователи не должны потерять доступ после появления поля
        conn.execute(text("UPDATE users SET email_verified = TRUE"))


def apply_schema_hotfixes() -> None:
    ensure_users_email_verified_column(engine)
