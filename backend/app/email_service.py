"""Отправка email через SMTP (переменные окружения)."""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger(__name__)


def _smtp_tls() -> bool:
    return os.getenv("SMTP_TLS", "true").strip().lower() in ("1", "true", "yes")


def send_otp_email(to_email: str, code: str, subject: str | None = None) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", user).strip()

    if not host:
        if os.getenv("OTP_DEV_LOG_CODE", "").strip().lower() in ("1", "true", "yes"):
            print(f"[DEV OTP] Код для {to_email}: {code}")
            return
        raise RuntimeError(
            "Не задан SMTP_HOST. Укажите SMTP_* в .env или OTP_DEV_LOG_CODE=true для вывода кода в консоль backend."
        )

    if user and from_addr.lower() != user.lower():
        from_addr = user

    msg = EmailMessage()
    msg["Subject"] = subject or "Код подтверждения"
    msg["From"] = formataddr(("Habit Tracker", from_addr))
    msg["To"] = to_email
    msg.set_content(
        f"Ваш код подтверждения: {code}\n\nКод действует ограниченное время. "
        "Если это не вы — проигнорируйте письмо."
    )

    use_tls = _smtp_tls()
    try:
        if use_tls and port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
            return

        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.ehlo()
            if use_tls:
                smtp.starttls()
                smtp.ehlo()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
    except smtplib.SMTPException as exc:
        raise RuntimeError(f"Не удалось отправить письмо: {exc}") from exc

    logger.info("SMTP: письмо отправлено на %s", to_email)
    if os.getenv("OTP_DEV_LOG_CODE", "").strip().lower() in ("1", "true", "yes"):
        print(f"[DEV OTP] Код для {to_email}: {code}")
