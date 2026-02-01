"""Utilities for generating claim tickets (QR + code + token) for pickup.

Reuses existing DocumentRequest.qr_code (string path) and qr_data (JSON dict).
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Tuple, Dict, Any
import base64
import hashlib

import bcrypt
import qrcode
import jwt
from flask import current_app
from cryptography.fernet import Fernet, InvalidToken


ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no O/0/I/1


def _uploads_base() -> Path:
    up = current_app.config.get("UPLOAD_FOLDER")
    return Path(up)


def generate_pickup_code(length: int = 8) -> str:
    """Generate a human-friendly pickup code like ABCD-2345.

    Returns uppercase code with a hyphen for readability.
    """
    import random

    chars = [random.choice(ALPHABET) for _ in range(length)]
    code = "".join(chars)
    return f"{code[:4]}-{code[4:]}"


def hash_code(code: str) -> bytes:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(code.encode("utf-8"), salt)


def verify_code(code: str, hashed: bytes) -> bool:
    try:
        return bcrypt.checkpw(code.encode("utf-8"), hashed)
    except Exception:
        return False


def sign_claim_token(request_obj) -> Dict[str, Any]:
    """Create a short-lived JWT token for claim verification.

    Includes minimal non-PII claims and a jti for revocation checks.
    """
    secret = (
        current_app.config.get("CLAIM_JWT_SECRET")
        or current_app.config.get("JWT_SECRET_KEY")
        or "change-me"
    )
    lifetime_days = int(current_app.config.get("CLAIM_TOKEN_DAYS", 14))
    now = datetime.utcnow()
    jti = str(uuid.uuid4())
    payload = {
        "sub": f"request:{getattr(request_obj, 'id', None)}",
        "mun_id": getattr(request_obj, "municipality_id", None),
        "doctype_id": getattr(request_obj, "document_type_id", None),
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=lifetime_days)).timestamp()),
        "ver": 1,
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    return {"token": token, "jti": jti, "exp": payload["exp"]}


def _generate_qr_bytes(data: str) -> bytes:
    """Generate QR code as PNG bytes in memory."""
    from io import BytesIO
    
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def _is_production() -> bool:
    """Check if running in production."""
    flask_env = current_app.config.get('FLASK_ENV') or os.getenv('FLASK_ENV', 'development')
    return flask_env == 'production'


def build_qr_png(data: str, request_id: int, municipality_slug: str) -> Tuple[Path, str]:
    """Generate QR PNG and upload to Supabase Storage (production) or filesystem (dev).

    Returns:
        In production: (None, public_url)
        In development: (absolute_path, relative_path)
    """
    # Generate QR code bytes in memory
    qr_bytes = _generate_qr_bytes(data)
    
    # In production, upload to Supabase Storage
    if _is_production():
        try:
            from utils.storage_handler import save_bytes
            
            public_url = save_bytes(
                data=qr_bytes,
                category='claims',
                municipality_slug=municipality_slug,
                filename=f"claim_{request_id}.png",
                subcategory=None,
                user_type='system',
                content_type='image/png'
            )
            
            # Return None for path, URL for storage reference
            return None, public_url
            
        except Exception as e:
            current_app.logger.error(f"Failed to upload claim QR to Supabase: {e}")
            # Fall back to filesystem
    
    # Development or fallback: save to filesystem
    base = _uploads_base()
    out_dir = base / "claims" / municipality_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    png_path = out_dir / f"{request_id}.png"
    
    with open(str(png_path), 'wb') as f:
        f.write(qr_bytes)

    rel = os.path.relpath(png_path, base)
    return png_path, rel.replace("\\", "/")


def masked(code: str) -> str:
    code = (code or "").strip().upper()
    if len(code) <= 2:
        return "**"
    return code[:2] + "*" * max(0, len(code) - 4) + code[-2:]


def get_municipality_slug(name: str) -> str:
    return (name or "").strip().lower().replace(" ", "-").replace("_", "-")


# --- Encryption helpers for pickup code (owner-only reveal) ---
def _derive_fernet_key_from_secret(secret: str) -> bytes:
    """Derive a urlsafe base64 32-byte key for Fernet from an arbitrary secret.

    We use SHA-256 and urlsafe_b64encode to obtain a stable key.
    """
    digest = hashlib.sha256((secret or "change-me").encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    """Return a Fernet instance using CLAIM_CODE_ENC_KEY or derived JWT secret.

    If CLAIM_CODE_ENC_KEY is provided and already looks like a valid Fernet key
    (urlsafe base64 32 bytes), we use it directly; otherwise derive from secret.
    """
    key = current_app.config.get("CLAIM_CODE_ENC_KEY") or current_app.config.get("JWT_SECRET_KEY") or "change-me"
    # Try to interpret as base64 key first
    fernet_key: bytes
    try:
        decoded = base64.urlsafe_b64decode((key or "").encode("utf-8"))
        if len(decoded) == 32:
            fernet_key = base64.urlsafe_b64encode(decoded)
        else:
            fernet_key = _derive_fernet_key_from_secret(key)
    except Exception:
        fernet_key = _derive_fernet_key_from_secret(key)
    return Fernet(fernet_key)


def encrypt_code(plain: str) -> str:
    """Encrypt the pickup code using Fernet and return a string token."""
    f = _get_fernet()
    token = f.encrypt((plain or "").encode("utf-8"))
    return token.decode("utf-8")


def decrypt_code(token: str) -> str:
    """Decrypt the pickup code token using Fernet and return plaintext.

    Returns empty string on failure (invalid token or decoding issues).
    """
    if not token:
        return ""
    f = _get_fernet()
    try:
        plain = f.decrypt(token.encode("utf-8"))
        return plain.decode("utf-8")
    except (InvalidToken, Exception):
        return ""

