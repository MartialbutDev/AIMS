
"""SMTP transport for password reset and verification emails."""

import smtplib
from email.message import EmailMessage
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.core.config import settings


def email_is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.EMAIL_FROM)


def _link_with_token(base_url: str, token: str) -> str:
    if not base_url:
        raise RuntimeError("Email action URL is not configured")

    parts = urlsplit(base_url)

    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise RuntimeError(
            "Email action URL must be an absolute HTTP(S) URL"
        )

    query = [
        (k, v)
        for k, v in parse_qsl(parts.query)
        if k != "token"
    ]
    query.append(("token", token))

    return urlunsplit((
        parts.scheme,
        parts.netloc,
        parts.path,
        urlencode(query),
        parts.fragment
    ))


def send_action_email(
    recipient: str,
    subject: str,
    message: str,
    action_url: str,
    token: str
) -> None:
    if not email_is_configured():
        raise RuntimeError("SMTP is not configured")

    link = _link_with_token(action_url, token)

    mail = EmailMessage()
    mail["Subject"] = subject
    mail["From"] = settings.EMAIL_FROM
    mail["To"] = recipient

    mail.set_content(
        f"{message}\n\n{link}\n\n"
        "If you did not request this, ignore this email."
    )

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        timeout=15
    ) as smtp:
        smtp.ehlo()

        if settings.SMTP_USE_TLS:
            smtp.starttls()
            smtp.ehlo()

        if settings.SMTP_USERNAME:
            smtp.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD or ""
            )

        smtp.send_message(mail)
