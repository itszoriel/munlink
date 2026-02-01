"""Notification outbox worker.

Runs in a loop (or once with --once) to deliver queued email/SMS notifications.
"""
from __future__ import annotations
import time
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy import or_

from apps.api.app import create_app
from apps.api import db
from apps.api.models.notification import NotificationOutbox
from apps.api.models.user import User
from apps.api.utils.email_sender import send_generic_email
from apps.api.utils.sms_provider import normalize_sms_number, send_sms


MAX_ATTEMPTS_DEFAULT = 5


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
        item.next_attempt_at = datetime.utcnow() + timedelta(minutes=_backoff_minutes(item.attempts))


def _process_email_item(item: NotificationOutbox, user: User, max_attempts: int):
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
        send_generic_email(to_email, subject, body)
        _mark_sent(item)
    except Exception as exc:  # pragma: no cover - best effort
        _mark_failed(item, str(exc), max_attempts)


def _prepare_sms_items(items: List[NotificationOutbox], user_map: Dict[int, User], max_attempts: int):
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
        if not getattr(user, 'mobile_number', None):
            _mark_skipped(item, 'missing_mobile')
            continue
        normalized = normalize_sms_number(user.mobile_number)
        if not normalized:
            _mark_skipped(item, 'invalid_mobile')
            continue
        payload = item.payload or {}
        message = payload.get('message')
        if not message:
            _mark_skipped(item, 'missing_message')
            continue
        entry = {'item': item, 'number': normalized, 'message': message, 'batch_key': payload.get('batch_key')}
        if entry['batch_key']:
            batches.setdefault(entry['batch_key'], []).append(entry)
        else:
            singles.append(entry)
    return singles, batches


def _apply_sms_result(entry_items: List[Dict[str, Any]], result: Dict[str, Any], max_attempts: int):
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


def _process_sms_items(items: List[NotificationOutbox], user_map: Dict[int, User], max_attempts: int):
    if not items:
        return
    singles, batches = _prepare_sms_items(items, user_map, max_attempts)

    # Process batchable groups (e.g., announcement blasts) in chunks of 1000 numbers
    for batch_entries in batches.values():
        message = batch_entries[0]['message']
        for idx in range(0, len(batch_entries), 1000):
            chunk = batch_entries[idx:idx + 1000]
            numbers = [e['number'] for e in chunk]
            result = send_sms(numbers, message)
            _apply_sms_result(chunk, result, max_attempts)

    # Process single/unique messages
    for entry in singles:
        result = send_sms([entry['number']], entry['message'])
        _apply_sms_result([entry], result, max_attempts)


def process_batch(max_items: int = 200, max_attempts: int = MAX_ATTEMPTS_DEFAULT) -> int:
    """Process pending notification outbox rows. Returns count processed."""
    now = datetime.utcnow()
    pending = NotificationOutbox.query.filter(
        NotificationOutbox.status == 'pending',
        or_(NotificationOutbox.next_attempt_at == None, NotificationOutbox.next_attempt_at <= now)
    ).order_by(NotificationOutbox.attempts.asc(), NotificationOutbox.created_at.asc()).limit(max_items).all()
    if not pending:
        return 0

    user_ids = {p.resident_id for p in pending}
    users = User.query.filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}

    sms_items: List[NotificationOutbox] = []
    for item in pending:
        if item.channel == 'email':
            _process_email_item(item, user_map.get(item.resident_id), max_attempts)
        elif item.channel == 'sms':
            sms_items.append(item)
        else:
            _mark_skipped(item, 'unknown_channel')

    _process_sms_items(sms_items, user_map, max_attempts)
    db.session.commit()
    return len(pending)


def run_loop(interval: int = 10, max_items: int = 200, max_attempts: int = MAX_ATTEMPTS_DEFAULT):
    """Run worker continuously."""
    while True:
        try:
            processed = process_batch(max_items=max_items, max_attempts=max_attempts)
            if processed < max_items:
                time.sleep(interval)
        except Exception:
            # Keep running even if a batch fails
            db.session.rollback()
            time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="Notification outbox worker")
    parser.add_argument('--once', action='store_true', help='Process a single batch then exit')
    parser.add_argument('--interval', type=int, default=10, help='Seconds to wait between batches (loop mode)')
    parser.add_argument('--max-items', type=int, default=200, help='Max outbox rows per batch')
    parser.add_argument('--max-attempts', type=int, default=MAX_ATTEMPTS_DEFAULT, help='Max retry attempts before marking failed')
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        if args.once:
            process_batch(max_items=args.max_items, max_attempts=args.max_attempts)
        else:
            run_loop(interval=args.interval, max_items=args.max_items, max_attempts=args.max_attempts)


if __name__ == '__main__':
    main()
