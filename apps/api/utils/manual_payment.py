"""Manual QR payment helpers (Payment ID generation + email)."""
from __future__ import annotations

import random
import string
from typing import Optional

import bcrypt
from flask import current_app

from apps.api.utils.email_sender import _send_email


def _normalize_last_name(last_name: Optional[str]) -> str:
    """Return a 3-letter uppercase prefix from the user's last name."""
    raw = (last_name or "").strip()
    letters = [c for c in raw.upper() if c.isalpha()]
    prefix = "".join(letters)[:3]
    return prefix.ljust(3, "X")


def generate_payment_id(last_name: Optional[str]) -> str:
    """Generate Payment ID: LLL + lll + ddd (case-insensitive validation)."""
    prefix = _normalize_last_name(last_name)
    rand_letters = "".join(random.choice(string.ascii_lowercase) for _ in range(3))
    rand_digits = "".join(random.choice(string.digits) for _ in range(3))
    return f"{prefix}{rand_letters}{rand_digits}"


def _normalize_payment_id(payment_id: str) -> str:
    """Normalize Payment ID for case-insensitive comparison."""
    return (payment_id or "").strip().lower()


def hash_payment_id(payment_id: str) -> str:
    """Hash a Payment ID using bcrypt."""
    norm = _normalize_payment_id(payment_id)
    hashed = bcrypt.hashpw(norm.encode("utf-8"), bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def verify_payment_id(payment_id: str, hashed: str) -> bool:
    """Verify a Payment ID against a bcrypt hash."""
    try:
        norm = _normalize_payment_id(payment_id)
        return bcrypt.checkpw(norm.encode("utf-8"), (hashed or "").encode("utf-8"))
    except Exception:
        return False


def send_payment_id_email(
    to_email: str,
    first_name: Optional[str],
    request_number: Optional[str],
    payment_id: str,
    amount: Optional[float],
    instructions: Optional[str] = None,
    pay_to_number: Optional[str] = None,
) -> None:
    """Send Payment ID via email for manual QR confirmation."""
    app_name = current_app.config.get("APP_NAME", "MunLink Zambales")
    subject = f"{app_name}: Manual payment verification code"
    greeting = f"Hi {first_name or 'resident'},"
    amount_line = f"Amount due: PHP {float(amount or 0):.2f}" if amount is not None else None
    request_line = f"Request number: {request_number}" if request_number else None
    pay_to_line = f"Pay-to number: {pay_to_number}" if pay_to_number else None
    instructions_line = instructions or "Scan the QR, pay the exact amount, then submit this Payment ID."

    lines = [
        greeting,
        "",
        "Your manual payment verification code is:",
        payment_id,
        "",
    ]
    for extra in (request_line, amount_line, pay_to_line):
        if extra:
            lines.append(extra)
    lines.extend([
        "",
        instructions_line,
        "",
        "Do not share this code with anyone.",
    ])
    body = "\n".join(lines)
    _send_email(to_email, subject, body)
