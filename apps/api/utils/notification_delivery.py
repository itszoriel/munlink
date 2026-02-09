"""Concurrency-safe notification delivery with claim+lease pattern.

Shared by both the inline flush (called after admin actions) and the
background notification_worker.py.  Row-level locking (FOR UPDATE SKIP
LOCKED on Postgres) ensures that concurrent callers never double-deliver.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Dict, Any, List

from sqlalchemy import or_

from apps.api import db
from apps.api.models.notification import NotificationOutbox
from apps.api.models.user import User
from apps.api.utils.email_sender import _send_email
from apps.api.utils.sms_provider import normalize_sms_number, send_sms
from apps.api.utils.time import utc_now


MAX_ATTEMPTS_DEFAULT = 5


def _sms_target_number(user: User) -> str | None:
    return getattr(user, 'mobile_number', None) or getattr(user, 'phone_number', None)


def _backoff_minutes(attempts: int) -> int:
    return min(60, 2 ** max(attempts, 1))


def _mark_sent(item: NotificationOutbox):
    item.status = 'sent'
    item.attempts = (item.attempts or 0) + 1
    item.last_error = None
    item.next_attempt_at = None


def _mark_skipped(item: NotificationOutbox, reason: str | None = None):
    item.status = 'skipped'
    item.attempts = (item.attempts or 0) + 1
    item.last_error = reason
    item.next_attempt_at = None


def _mark_failed(item: NotificationOutbox, reason: str, max_attempts: int):
    item.attempts = (item.attempts or 0) + 1
    item.last_error = reason[:240] if reason else None
    if item.attempts >= max_attempts:
        item.status = 'failed'
        item.next_attempt_at = None
    else:
        item.status = 'pending'
        item.next_attempt_at = utc_now() + timedelta(minutes=_backoff_minutes(item.attempts))


# -- Email delivery ----------------------------------------------------------

def _process_email_item(item: NotificationOutbox, user: User | None, max_attempts: int):
    if not user:
        _mark_skipped(item, 'user_missing')
        return
    if not getattr(user, 'email', None):
        _mark_skipped(item, 'missing_email')
        return
    if getattr(user, 'notify_email_enabled', True) is False:
        _mark_skipped(item, 'email_disabled')
        return
    payload = item.payload or {}
    subject = payload.get('subject') or f"MunLink notification ({item.event_type})"
    body = payload.get('body') or payload.get('message') or 'You have a new notification in MunLink.'
    to_email = payload.get('to_email') or user.email
    try:
        _send_email(to_email, subject, body)
        _mark_sent(item)
    except Exception as exc:
        _mark_failed(item, str(exc), max_attempts)


# -- SMS delivery -------------------------------------------------------------

def _prepare_sms_items(
    items: List[NotificationOutbox],
    user_map: Dict[int, User],
    max_attempts: int,
):
    """Validate SMS items and bucket them by batch_key."""
    singles: List[Dict[str, Any]] = []
    batches: Dict[str, List[Dict[str, Any]]] = {}

    for item in items:
        user = user_map.get(item.resident_id)
        if not user:
            _mark_skipped(item, 'user_missing')
            continue
        if getattr(user, 'notify_sms_enabled', False) is False:
            _mark_skipped(item, 'sms_disabled')
            continue
        raw_number = _sms_target_number(user)
        if not raw_number:
            _mark_skipped(item, 'missing_mobile')
            continue
        normalized = normalize_sms_number(raw_number)
        if not normalized:
            _mark_skipped(item, 'invalid_mobile')
            continue
        payload = item.payload or {}
        message = payload.get('message')
        if not message:
            _mark_skipped(item, 'missing_message')
            continue
        entry = {
            'item': item,
            'number': normalized,
            'message': message,
            'batch_key': payload.get('batch_key'),
        }
        if entry['batch_key']:
            batches.setdefault(entry['batch_key'], []).append(entry)
        else:
            singles.append(entry)
    return singles, batches


def _apply_sms_result(
    entry_items: List[Dict[str, Any]],
    result: Dict[str, Any],
    max_attempts: int,
):
    for entry in entry_items:
        item = entry['item']
        status = result.get('status')
        reason = result.get('reason')
        error = result.get('error')
        if status == 'sent':
            _mark_sent(item)
        elif status == 'skipped':
            _mark_skipped(item, reason)
        else:
            _mark_failed(item, error or reason or 'sms_failed', max_attempts)


def _process_sms_items(
    items: List[NotificationOutbox],
    user_map: Dict[int, User],
    max_attempts: int,
):
    if not items:
        return
    singles, batches = _prepare_sms_items(items, user_map, max_attempts)

    for batch_entries in batches.values():
        message = batch_entries[0]['message']
        for idx in range(0, len(batch_entries), 1000):
            chunk = batch_entries[idx:idx + 1000]
            numbers = [e['number'] for e in chunk]
            result = send_sms(numbers, message)
            _apply_sms_result(chunk, result, max_attempts)

    for entry in singles:
        result = send_sms([entry['number']], entry['message'])
        _apply_sms_result([entry], result, max_attempts)


# -- Main entry point ---------------------------------------------------------

def process_batch(
    max_items: int = 200,
    lease_seconds: int = 300,
    max_attempts: int = MAX_ATTEMPTS_DEFAULT,
    newest_first: bool = False,
) -> int:
    """Claim and deliver pending notification rows.

    Uses a claim+lease pattern so that concurrent callers (inline flush
    and background worker) never double-deliver the same row.

    Args:
        newest_first: When True, prioritize recently created rows so
            that an inline flush delivers just-queued notifications
            even when older pending rows exist in the backlog.

    Flow:
      1. Recover abandoned claims (stale 'processing' rows past lease).
      2. Claim rows with FOR UPDATE SKIP LOCKED (Postgres) to prevent
         concurrent callers from grabbing the same rows.
      3. Deliver emails and SMS for claimed rows.
      4. Finalize each row -> sent / failed / pending-retry.
    """
    now = utc_now()

    # Step 1: Recover abandoned claims
    NotificationOutbox.query.filter(
        NotificationOutbox.status == 'processing',
        NotificationOutbox.next_attempt_at <= now,
    ).update({'status': 'pending'}, synchronize_session=False)
    db.session.commit()

    # Step 2: Claim rows with row-level locking
    q = NotificationOutbox.query.filter(
        NotificationOutbox.status == 'pending',
        or_(
            NotificationOutbox.next_attempt_at == None,
            NotificationOutbox.next_attempt_at <= now,
        ),
    ).order_by(
        NotificationOutbox.attempts.asc(),
        NotificationOutbox.created_at.desc() if newest_first else NotificationOutbox.created_at.asc(),
    )

    # Postgres: FOR UPDATE SKIP LOCKED prevents concurrent callers
    # from grabbing the same rows.  SQLite (dev) has no support for
    # this but single-process is fine there.
    try:
        dialect = db.engine.dialect.name
    except Exception:
        dialect = ''
    if dialect == 'postgresql':
        q = q.with_for_update(skip_locked=True)

    rows = q.limit(max_items).all()
    if not rows:
        return 0

    # Mark claimed rows as 'processing' with a lease timeout
    lease_until = now + timedelta(seconds=lease_seconds)
    for r in rows:
        r.status = 'processing'
        r.next_attempt_at = lease_until
    db.session.commit()

    # Step 3: Deliver
    user_ids = {r.resident_id for r in rows}
    users = User.query.filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}

    sms_items: List[NotificationOutbox] = []
    for item in rows:
        if item.channel == 'email':
            _process_email_item(item, user_map.get(item.resident_id), max_attempts)
        elif item.channel == 'sms':
            sms_items.append(item)
        else:
            _mark_skipped(item, 'unknown_channel')

    _process_sms_items(sms_items, user_map, max_attempts)

    # Step 4: Finalize
    db.session.commit()
    return len(rows)
