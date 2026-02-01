"""SMS provider utilities (PhilSMS + console fallback).

IMPORTANT: PhilSMS currently delivers to Globe/TM/GOMO networks only.
Smart/TNT users will NOT receive SMS (verified 2026-01-26).
Email notifications work for all users regardless of carrier.

To enable Smart/TNT delivery:
- Contact PhilSMS support to enable Smart network on your account
- Or implement dual-provider setup (PhilSMS for Globe, Semaphore for Smart)
"""
from __future__ import annotations
import time
from typing import List, Dict, Any
from datetime import datetime
import requests
from flask import current_app


_capability_cache: Dict[str, Any] = {
    'expires_at': 0,
    'data': None,
}


def mask_number(number: str) -> str:
    """Mask all but last 4 digits of a phone number."""
    digits = ''.join(ch for ch in str(number or '') if ch.isdigit())
    if not digits:
        return '***'
    if len(digits) <= 4:
        return '*' * len(digits)
    return f"{'*' * (len(digits) - 4)}{digits[-4:]}"


def normalize_sms_number(number: str | None) -> str | None:
    """Normalize to digits-only format accepted by PhilSMS (63XXXXXXXXXX)."""
    if not number:
        return None
    digits = ''.join(ch for ch in str(number) if ch.isdigit())
    if not digits:
        return None
    if digits.startswith('09') and len(digits) == 11:
        digits = '63' + digits[1:]
    elif digits.startswith('9') and len(digits) == 10:
        digits = '63' + digits
    elif digits.startswith('63') and len(digits) == 12:
        pass
    elif digits.startswith('0') and len(digits) == 10:
        digits = '63' + digits[1:]
    else:
        return None
    return digits


def _sanitize_message(text: str) -> str:
    """Ensure message is not rejected for starting with TEST and carries branding."""
    try:
        brand = (current_app.config.get('APP_NAME') or 'MunLink Zambales')
    except Exception:
        brand = 'MunLink Zambales'
    brand = brand.strip() or 'MunLink'
    brand_lower = brand.lower()
    trimmed = (text or '').lstrip()
    if not trimmed:
        return ''
    if trimmed.upper().startswith('TEST'):
        trimmed = f"{brand}: {trimmed}"
    if not trimmed.lower().startswith(brand_lower):
        trimmed = f"{brand}: {trimmed}"
    return trimmed


def get_philsms_capability(force: bool = False, ttl_seconds: int | None = None) -> Dict[str, Any]:
    """Check PhilSMS account status with short-lived caching."""
    provider = (current_app.config.get('SMS_PROVIDER') or 'disabled').lower()
    if provider != 'philsms':
        return {
            'provider': provider,
            'available': provider == 'console',
            'reason': None if provider == 'console' else 'sms_disabled',
            'credit_balance': None,
            'status': None,
        }

    api_key = current_app.config.get('PHILSMS_API_KEY', '')
    base_url = (current_app.config.get('PHILSMS_BASE_URL') or 'https://dashboard.philsms.com/api/v3').rstrip('/')
    ttl = ttl_seconds or int(current_app.config.get('SMS_CAPABILITY_CACHE_SECONDS', 90) or 90)
    now = time.time()

    if not force and _capability_cache['data'] and _capability_cache['expires_at'] > now:
        return _capability_cache['data']

    if not api_key:
        data = {
            'provider': 'philsms',
            'available': False,
            'reason': 'not_configured',
            'credit_balance': None,
            'status': None,
        }
        _capability_cache['data'] = data
        _capability_cache['expires_at'] = now + ttl
        return data

    # PhilSMS doesn't have a separate account status endpoint
    # Assume available if API key is configured
    # The actual availability will be determined when sending
    data = {
        'provider': 'philsms',
        'available': True,
        'reason': None,
        'credit_balance': None,  # PhilSMS doesn't expose balance via API
        'status': 'active',
        'checked_at': datetime.utcnow(),
    }
    _capability_cache['data'] = data
    _capability_cache['expires_at'] = now + ttl
    return data


def send_sms(numbers: List[str], message: str) -> Dict[str, Any]:
    """Send SMS using configured provider. Returns dict with status and optional reason/error."""
    provider = (current_app.config.get('SMS_PROVIDER') or 'disabled').lower()
    payload_numbers = [n for n in numbers if n]
    if not payload_numbers:
        return {'status': 'skipped', 'reason': 'no_numbers'}

    sanitized_message = _sanitize_message(message)
    if not sanitized_message:
        return {'status': 'skipped', 'reason': 'empty_message'}

    if provider == 'disabled':
        return {'status': 'skipped', 'reason': 'sms_disabled'}

    if provider == 'console':
        try:
            masked = [mask_number(n) for n in payload_numbers]
            current_app.logger.info("[SMS console] to=%s message=%s", masked, sanitized_message[:240])
        except Exception:
            pass
        return {'status': 'sent'}

    if provider != 'philsms':
        return {'status': 'skipped', 'reason': 'unknown_provider'}

    api_key = current_app.config.get('PHILSMS_API_KEY', '')
    sender_id = current_app.config.get('PHILSMS_SENDER_ID', '')
    base_url = (current_app.config.get('PHILSMS_BASE_URL') or 'https://dashboard.philsms.com/api/v3').rstrip('/')

    capability = get_philsms_capability()
    if not capability.get('available'):
        return {'status': 'skipped', 'reason': capability.get('reason') or 'philsms_unavailable'}

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }

    # PhilSMS API v3 accepts single recipient per request
    # Send to each number individually
    failed_count = 0
    last_error = None

    for recipient in payload_numbers:
        payload: Dict[str, Any] = {
            'recipient': recipient,
            'message': sanitized_message,
        }
        if sender_id:
            payload['sender_id'] = sender_id

        try:
            resp = requests.post(f"{base_url}/sms/send", json=payload, headers=headers, timeout=15)
            if resp.status_code not in (200, 201, 202):
                failed_count += 1
                detail = None
                try:
                    detail = resp.json()
                except Exception:
                    detail = resp.text[:200]
                last_error = detail
                current_app.logger.error(f"[PhilSMS] Send failed to {mask_number(recipient)}: status={resp.status_code} detail={detail}")
        except requests.exceptions.RequestException as exc:
            failed_count += 1
            last_error = str(exc)[:200]
            current_app.logger.error(f"[PhilSMS] Network error to {mask_number(recipient)}: {exc}")

    # Return success if at least one message was sent
    if failed_count == len(payload_numbers):
        return {'status': 'failed', 'reason': 'all_failed', 'error': last_error}
    elif failed_count > 0:
        return {'status': 'sent', 'warning': f'{failed_count} of {len(payload_numbers)} failed'}
    return {'status': 'sent'}


def get_provider_status() -> Dict[str, Any]:
    """Lightweight capability snapshot for APIs/UI."""
    data = get_philsms_capability()
    return {
        'provider': data.get('provider'),
        'available': data.get('available'),
        'reason': data.get('reason'),
        'credit_balance': data.get('credit_balance'),
        'status': data.get('status'),
    }
