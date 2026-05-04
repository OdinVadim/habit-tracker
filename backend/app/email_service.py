"""Отправка email через SMTP (переменные окружения)."""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage


def _smtp_tls() -> bool:
    return os.getenv("SMTP_TLS", "true").strip().lower() in ("1", "true", "yes")


def send_otp_email(to_email: str, code: str, subject: str | None = None) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", user).strip()

    if not host:
        raise RuntimeError(
            "Не задан SMTP_HOST. Укажите переменные SMTP_* в .env или окружении "
            "(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_TLS)."
        )

    msg = EmailMessage()
    msg["Subject"] = subject or "Код подтверждения"
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(
        f"Ваш код подтверждения: {code}\n\nКод действует ограниченное время. "
        "Если это не вы — проигнорируйте письмо."
    )

    use_tls = _smtp_tls()
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
