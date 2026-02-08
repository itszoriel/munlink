"""Notification helpers for queuing announcements and request updates."""
from __future__ import annotations
from apps.api.utils.time import utc_now
from datetime import datetime
from typing import Dict, Any, List, Tuple, Set
from flask import current_app
from sqlalchemy import or_

from apps.api import db
from apps.api.models.notification import NotificationOutbox
from apps.api.models.user import User
from apps.api.utils.zambales_scope import (
    ZAMBALES_MUNICIPALITY_IDS,
    is_valid_zambales_municipality,
)


DEFAULT_EMAIL_PREF = True
DEFAULT_SMS_PREF = False


def _prefers_email(user: User) -> bool:
    val = getattr(user, 'notify_email_enabled', None)
    return DEFAULT_EMAIL_PREF if val is None else bool(val)


def _prefers_sms(user: User) -> bool:
    val = getattr(user, 'notify_sms_enabled', None)
    return DEFAULT_SMS_PREF if val is None else bool(val)


def _build_dedupe_key(event_type: str, entity_id: int | None, resident_id: int, channel: str, extra: str | None = None) -> str:
    base = f"{event_type}:{entity_id}:{resident_id}:{channel}"
    return f"{base}:{extra}" if extra else base


def queue_notification_for_user(
    user: User,
    channel: str,
    event_type: str,
    entity_id: int | None,
    payload: Dict[str, Any],
    dedupe_extra: str | None = None,
    schedule_at: datetime | None = None,
) -> str:
    """Queue a single notification respecting user preferences."""
    if not user:
        return 'skipped_no_user'

    if channel == 'email':
        if not _prefers_email(user):
            return 'skipped_email_disabled'
        if not (payload.get('to_email') or getattr(user, 'email', None)):
            return 'skipped_no_email'
    elif channel == 'sms':
        if not _prefers_sms(user):
            return 'skipped_sms_disabled'
        if not getattr(user, 'mobile_number', None):
            return 'skipped_no_mobile'
    else:
        return 'skipped_unknown_channel'

    dedupe_key = _build_dedupe_key(event_type, entity_id, user.id, channel, dedupe_extra)
    existing = NotificationOutbox.query.filter_by(dedupe_key=dedupe_key).first()
    if existing:
        return 'duplicate'

    entry = NotificationOutbox(
        resident_id=user.id,
        channel=channel,
        event_type=event_type,
        entity_id=entity_id,
        payload=payload,
        status='pending',
        attempts=0,
        next_attempt_at=schedule_at or utc_now(),
        dedupe_key=dedupe_key,
    )
    db.session.add(entry)
    return 'queued'


def _doc_status_templates(new_status: str, req, doc_name: str, reason: str | None = None) -> Tuple[str, str]:
    """Return subject/body for document status updates."""
    status_label = new_status.replace('_', ' ').title()
    subject = f"MunLink: {doc_name} request {status_label}"
    lines = [
        f"Request number: {getattr(req, 'request_number', '')}",
        f"Document: {doc_name}",
        f"Current status: {status_label}",
    ]
    if new_status == 'rejected' and reason:
        lines.append(f"Reason: {reason}")
    if new_status == 'ready':
        pickup_hint = "Your document is ready for release."
        if getattr(req, 'delivery_method', '').lower() in ('physical', 'pickup'):
            pickup_hint = (
                "Your document is ready for pickup.\n"
                "Please log in to your MunLink account and view your claim ticket.\n"
                "Bring the claim ticket QR code (or fallback code) and your valid ID to the office."
            )
        lines.append(pickup_hint)
    if new_status == 'completed':
        lines.append("Your digital copy is available in your account.")
    body = "\n".join(lines)
    return subject, body


def queue_document_request_created(user: User, req, doc_name: str) -> Dict[str, int]:
    """Queue notifications for a newly submitted document request."""
    results = {'queued': 0, 'skipped': 0}
    event_type = 'document_request_submitted'
    subject = f"MunLink: We received your {doc_name} request"
    body = (
        f"Hi {user.first_name or 'resident'},\n\n"
        f"We received your request for {doc_name}.\n"
        f"Request number: {getattr(req, 'request_number', '')}\n"
        f"Status: Pending\n"
        f"We'll notify you as soon as it is processed."
    )
    sms_message = f"{doc_name} request received. Ref: {getattr(req, 'request_number', '')}. We'll update you once it's processing."
    schedule_at = utc_now()

    email_state = queue_notification_for_user(
        user,
        'email',
        event_type,
        getattr(req, 'id', None),
        {'subject': subject, 'body': body},
        schedule_at=schedule_at,
    )
    results['queued' if email_state == 'queued' else 'skipped'] += 1

    sms_state = queue_notification_for_user(
        user,
        'sms',
        event_type,
        getattr(req, 'id', None),
        {'message': sms_message},
        schedule_at=schedule_at,
    )
    results['queued' if sms_state == 'queued' else 'skipped'] += 1
    return results


def queue_document_status_change(user: User, req, doc_name: str, new_status: str, reason: str | None = None) -> Dict[str, int]:
    """Queue notifications for document status transitions."""
    results = {'queued': 0, 'skipped': 0}
    status_normalized = (new_status or '').lower()
    subject, body = _doc_status_templates(status_normalized, req, doc_name, reason)
    sms_message = body.splitlines()[2] if len(body.splitlines()) >= 3 else f"{doc_name} request update: {status_normalized}"
    if status_normalized == 'rejected' and reason:
        sms_message = f"{doc_name} request rejected: {reason}"
    event_type = 'document_request_status'

    email_state = queue_notification_for_user(
        user,
        'email',
        event_type,
        getattr(req, 'id', None),
        {'subject': subject, 'body': body},
        dedupe_extra=status_normalized,
    )
    results['queued' if email_state == 'queued' else 'skipped'] += 1

    sms_state = queue_notification_for_user(
        user,
        'sms',
        event_type,
        getattr(req, 'id', None),
        {'message': f"{doc_name} request {status_normalized}. Ref: {getattr(req, 'request_number', '')}"},
        dedupe_extra=status_normalized,
    )
    results['queued' if sms_state == 'queued' else 'skipped'] += 1
    return results


def _announcement_recipients(announcement) -> List[User]:
    """Return verified residents eligible for this announcement scope."""
    scope = (getattr(announcement, 'scope', 'MUNICIPALITY') or 'MUNICIPALITY').upper()
    query = User.query.filter(
        User.role == 'resident',
        User.admin_verified == True,
        or_(User.is_active == True, User.is_active.is_(None)),
        User.municipality_id.isnot(None),
    )

    if scope == 'PROVINCE':
        query = query.filter(User.municipality_id.in_(ZAMBALES_MUNICIPALITY_IDS))
    elif scope == 'MUNICIPALITY':
        muni_ids = []
        if announcement.municipality_id and is_valid_zambales_municipality(announcement.municipality_id):
            muni_ids.append(int(announcement.municipality_id))
        shared = getattr(announcement, 'shared_with_municipalities', []) or []
        for mid in shared:
            try:
                mid_int = int(mid)
                if is_valid_zambales_municipality(mid_int):
                    muni_ids.append(mid_int)
            except Exception:
                continue
        if not muni_ids:
            return []
        query = query.filter(User.municipality_id.in_(muni_ids))
    elif scope == 'BARANGAY':
        if not getattr(announcement, 'barangay_id', None):
            return []
        query = query.filter(User.barangay_id == announcement.barangay_id)
    else:
        return []

    return query.all()


def queue_announcement_notifications(announcement) -> Dict[str, int]:
    """Queue notifications for a published announcement."""
    results = {'queued': 0, 'skipped': 0}
    status = (getattr(announcement, 'status', '') or '').upper()
    now = utc_now()

    publish_at = getattr(announcement, 'publish_at', None)
    expire_at = getattr(announcement, 'expire_at', None)
    if status != 'PUBLISHED':
        return results
    if expire_at and expire_at <= now:
        return results

    schedule_at = publish_at if publish_at and publish_at > now else now
    recipients = _announcement_recipients(announcement)
    if not recipients:
        return results

    web_url = (current_app.config.get('WEB_URL') or '').rstrip('/') or 'http://localhost:5173'
    link = f"{web_url}/announcements/{announcement.id}"
    subject = f"New announcement: {announcement.title}"
    body = (
        f"{announcement.title}\n\n"
        f"{(announcement.content or '')[:240]}...\n\n"
        f"View details: {link}"
    )
    sms_message = f"Announcement: {announcement.title}. See details in MunLink."
    batch_key = f"announcement:{announcement.id}"

    # Bulk dedupe check for performance
    keys: Set[str] = set()
    for user in recipients:
        if _prefers_email(user):
            keys.add(_build_dedupe_key('announcement_published', announcement.id, user.id, 'email'))
        if _prefers_sms(user) and getattr(user, 'mobile_number', None):
            keys.add(_build_dedupe_key('announcement_published', announcement.id, user.id, 'sms'))
    if keys:
        existing = db.session.query(NotificationOutbox.dedupe_key).filter(NotificationOutbox.dedupe_key.in_(list(keys))).all()
        existing_keys = {row[0] for row in existing}
    else:
        existing_keys = set()

    for user in recipients:
        # Email
        if _prefers_email(user):
            dedupe_key = _build_dedupe_key('announcement_published', announcement.id, user.id, 'email')
            if dedupe_key not in existing_keys:
                db.session.add(NotificationOutbox(
                    resident_id=user.id,
                    channel='email',
                    event_type='announcement_published',
                    entity_id=announcement.id,
                    payload={'subject': subject, 'body': body},
                    status='pending',
                    attempts=0,
                    next_attempt_at=schedule_at,
                    dedupe_key=dedupe_key,
                ))
                results['queued'] += 1
            else:
                results['skipped'] += 1
        else:
            results['skipped'] += 1

        # SMS
        if _prefers_sms(user) and getattr(user, 'mobile_number', None):
            dedupe_key = _build_dedupe_key('announcement_published', announcement.id, user.id, 'sms')
            if dedupe_key not in existing_keys:
                db.session.add(NotificationOutbox(
                    resident_id=user.id,
                    channel='sms',
                    event_type='announcement_published',
                    entity_id=announcement.id,
                    payload={'message': sms_message, 'batch_key': batch_key},
                    status='pending',
                    attempts=0,
                    next_attempt_at=schedule_at,
                    dedupe_key=dedupe_key,
                ))
                results['queued'] += 1
            else:
                results['skipped'] += 1
        else:
            results['skipped'] += 1

    return results


def _benefit_program_recipients(program) -> List[User]:
    """Return verified residents in the program's municipality."""
    if not getattr(program, 'municipality_id', None):
        return []

    if not is_valid_zambales_municipality(program.municipality_id):
        return []

    query = User.query.filter(
        User.role == 'resident',
        User.admin_verified == True,
        or_(User.is_active == True, User.is_active.is_(None)),
        User.municipality_id == program.municipality_id,
    )
    return query.all()


def queue_benefit_program_notifications(program) -> Dict[str, int]:
    """Queue notifications when a benefit program is created or becomes active."""
    results = {'queued': 0, 'skipped': 0}

    is_active = getattr(program, 'is_active', False)
    is_accepting = getattr(program, 'is_accepting_applications', False)

    if not is_active or not is_accepting:
        return results

    recipients = _benefit_program_recipients(program)
    if not recipients:
        return results

    program_name = getattr(program, 'name', 'Benefit Program')
    web_url = (current_app.config.get('WEB_URL') or '').rstrip('/') or 'http://localhost:5173'
    link = f"{web_url}/benefits"

    subject = f"New benefit program: {program_name}"
    body = (
        f"A new benefit program is now available: {program_name}\n\n"
        f"{(getattr(program, 'description', '') or '')[:240]}...\n\n"
        f"Apply now: {link}"
    )
    sms_message = f"New benefit program available: {program_name}. Check MunLink to apply."
    batch_key = f"benefit_program:{program.id}"
    schedule_at = utc_now()

    # Bulk dedupe check
    keys: Set[str] = set()
    for user in recipients:
        if _prefers_email(user):
            keys.add(_build_dedupe_key('benefit_program_created', program.id, user.id, 'email'))
        if _prefers_sms(user) and getattr(user, 'mobile_number', None):
            keys.add(_build_dedupe_key('benefit_program_created', program.id, user.id, 'sms'))

    if keys:
        existing = db.session.query(NotificationOutbox.dedupe_key).filter(NotificationOutbox.dedupe_key.in_(list(keys))).all()
        existing_keys = {row[0] for row in existing}
    else:
        existing_keys = set()

    for user in recipients:
        # Email
        if _prefers_email(user):
            dedupe_key = _build_dedupe_key('benefit_program_created', program.id, user.id, 'email')
            if dedupe_key not in existing_keys:
                db.session.add(NotificationOutbox(
                    resident_id=user.id,
                    channel='email',
                    event_type='benefit_program_created',
                    entity_id=program.id,
                    payload={'subject': subject, 'body': body},
                    status='pending',
                    attempts=0,
                    next_attempt_at=schedule_at,
                    dedupe_key=dedupe_key,
                ))
                results['queued'] += 1
            else:
                results['skipped'] += 1
        else:
            results['skipped'] += 1

        # SMS
        if _prefers_sms(user) and getattr(user, 'mobile_number', None):
            dedupe_key = _build_dedupe_key('benefit_program_created', program.id, user.id, 'sms')
            if dedupe_key not in existing_keys:
                db.session.add(NotificationOutbox(
                    resident_id=user.id,
                    channel='sms',
                    event_type='benefit_program_created',
                    entity_id=program.id,
                    payload={'message': sms_message, 'batch_key': batch_key},
                    status='pending',
                    attempts=0,
                    next_attempt_at=schedule_at,
                    dedupe_key=dedupe_key,
                ))
                results['queued'] += 1
            else:
                results['skipped'] += 1
        else:
            results['skipped'] += 1

    return results
