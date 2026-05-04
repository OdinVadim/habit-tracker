"""Генерация, хранение и проверка одноразовых email-кодов."""
from __future__ import annotations

import hmac
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Literal, Optional

from sqlalchemy.orm import Session

from . import models
from .auth import SECRET_KEY
from .email_service import send_otp_email

Purpose = Literal["register", "login"]

OTP_LENGTH = 6
OTP_TTL_MINUTES = 10
OTP_RESEND_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_otp(code: str) -> str:
    digest = hmac.new(
        SECRET_KEY.encode("utf-8"),
        code.strip().encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest


def generate_otp_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_LENGTH))


def _latest_otp(
    db: Session, user_id: int, purpose: Purpose
) -> Optional[models.EmailOtp]:
    return (
        db.query(models.EmailOtp)
        .filter(
            models.EmailOtp.user_id == user_id,
            models.EmailOtp.purpose == purpose,
        )
        .order_by(models.EmailOtp.created_at.desc())
        .first()
    )


def can_resend_otp(db: Session, user_id: int, purpose: Purpose) -> bool:
    last = _latest_otp(db, user_id, purpose)
    if not last:
        return True
    delta = datetime.utcnow() - last.created_at.replace(tzinfo=None) if last.created_at else timedelta(0)
    return delta.total_seconds() >= OTP_RESEND_SECONDS


def create_send_otp(
    db: Session,
    user: models.User,
    purpose: Purpose,
    *,
    throttle: bool = True,
) -> bool:
    """
    Создаёт OTP и отправляет письмо. Если throttle=True и слишком рано повтор —
    код не отправляется (возвращает False). Если throttle=False — всегда шлём.
    """
    if throttle and not can_resend_otp(db, user.id, purpose):
        return False

    code = generate_otp_code()
    expires = datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)

    row = models.EmailOtp(
        user_id=user.id,
        purpose=purpose,
        code_hash=hash_otp(code),
        expires_at=expires,
        attempts_left=OTP_MAX_ATTEMPTS,
        sent_to_email=user.email,
    )
    db.add(row)
    try:
        send_otp_email(
            user.email,
            code,
            subject="Код для входа" if purpose == "login" else "Код подтверждения регистрации",
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True


def verify_otp(
    db: Session,
    user: models.User,
    purpose: Purpose,
    code: str,
) -> bool:
    """Проверяет активный код, уменьшает attempts при неверном вводе."""
    code = "".join(c for c in code if c.isdigit())
    row = (
        db.query(models.EmailOtp)
        .filter(
            models.EmailOtp.user_id == user.id,
            models.EmailOtp.purpose == purpose,
            models.EmailOtp.consumed_at.is_(None),
        )
        .order_by(models.EmailOtp.created_at.desc())
        .first()
    )

    now = datetime.utcnow()
    if not row:
        return False
    exp = row.expires_at.replace(tzinfo=None) if row.expires_at.tzinfo else row.expires_at
    if now > exp:
        return False
    if row.attempts_left <= 0:
        return False

    if hash_otp(code) == row.code_hash:
        row.consumed_at = now
        db.commit()
        return True

    row.attempts_left -= 1
    db.commit()
    return False
