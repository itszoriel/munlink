#!/usr/bin/env python3
"""Interactive notification diagnostics for MunLink.

Run from repository root:
    python apps/api/scripts/test_notifications_interactive.py

Run from apps/api:
    python scripts/test_notifications_interactive.py
"""
from __future__ import annotations

import getpass
import secrets
import sys
from pathlib import Path
from typing import Dict, List, Tuple


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")
except Exception:
    pass

try:
    from app import create_app
except Exception:
    from apps.api.app import create_app

from apps.api import db
from apps.api.models.notification import NotificationOutbox
from apps.api.models.user import User
from apps.api.utils.email_sender import _send_email
from apps.api.utils.notification_delivery import process_batch
from apps.api.utils.sms_provider import normalize_sms_number, send_sms
from apps.api.utils.time import utc_now


def _prompt_text(label: str, default: str | None = None, required: bool = False) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"{label}{suffix}: ").strip()
        if not value and default is not None:
            return default
        if value:
            return value
        if not required:
            return ""
        print("Value is required.")


def _prompt_yes_no(label: str, default_yes: bool = True) -> bool:
    suffix = "Y/n" if default_yes else "y/N"
    while True:
        value = input(f"{label} ({suffix}): ").strip().lower()
        if not value:
            return default_yes
        if value in ("y", "yes"):
            return True
        if value in ("n", "no"):
            return False
        print("Please answer y or n.")


def _mask_email(email: str | None) -> str:
    if not email or "@" not in email:
        return "<none>"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        local_masked = "*" * len(local)
    else:
        local_masked = local[0] + ("*" * (len(local) - 2)) + local[-1]
    return f"{local_masked}@{domain}"


def _mask_phone(raw: str | None) -> str:
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if not digits:
        return "<none>"
    if len(digits) <= 4:
        return "*" * len(digits)
    return ("*" * (len(digits) - 4)) + digits[-4:]


def _find_user(username: str) -> User | None:
    if not username:
        return None
    return User.query.filter(db.func.lower(User.username) == username.lower()).first()


def _print_user_summary(user: User, title: str):
    print(f"\n{title}")
    print("-" * len(title))
    print(f"id: {user.id}")
    print(f"username: {user.username}")
    print(f"role: {user.role}")
    print(f"email: {_mask_email(user.email)}")
    print(f"mobile: {_mask_phone(user.mobile_number)}")
    print(f"notify_email_enabled: {bool(user.notify_email_enabled)}")
    print(f"notify_sms_enabled: {bool(user.notify_sms_enabled)}")
    print(f"is_active: {bool(user.is_active)}")
    print(f"email_verified: {bool(user.email_verified)}")
    print(f"admin_verified: {bool(user.admin_verified)}")
    print(f"municipality_id: {user.municipality_id}")
    print(f"barangay_id: {user.barangay_id}")
    print(f"admin_municipality_id: {user.admin_municipality_id}")
    print(f"admin_barangay_id: {user.admin_barangay_id}")


def _test_login(client, path: str, username: str, password: str) -> Tuple[bool, str]:
    try:
        resp = client.post(path, json={"username": username, "password": password})
        body = resp.get_json(silent=True) or {}
        if resp.status_code == 200:
            role = ((body.get("user") or {}).get("role")) or "unknown"
            return True, f"status=200 role={role}"
        error = body.get("error") or body.get("message") or str(body)
        return False, f"status={resp.status_code} error={error}"
    except Exception as exc:
        return False, f"exception={exc}"


def _send_direct_email_test(user: User) -> Tuple[bool, str]:
    if not user.email:
        return False, "missing email"
    ts = utc_now().strftime("%Y-%m-%d %H:%M:%S UTC")
    ref = secrets.token_hex(3)
    subject = f"MunLink interactive email test ({ref})"
    body = (
        "This is an interactive notification test email.\n"
        f"time: {ts}\n"
        f"reference: {ref}\n"
    )
    try:
        _send_email(user.email, subject, body)
        return True, f"sent to {_mask_email(user.email)} ref={ref}"
    except Exception as exc:
        return False, str(exc)


def _send_direct_sms_test(user: User) -> Tuple[bool, str]:
    number = normalize_sms_number(user.mobile_number)
    if not number:
        return False, "missing/invalid mobile number"
    ts = utc_now().strftime("%Y-%m-%d %H:%M:%S UTC")
    ref = secrets.token_hex(3)
    message = f"Interactive SMS test {ts} ref:{ref}"
    try:
        result = send_sms([number], message)
        ok = (result.get("status") == "sent")
        return ok, f"result={result} number={_mask_phone(number)} ref={ref}"
    except Exception as exc:
        return False, str(exc)


def _queue_outbox_row(user: User, channel: str) -> int:
    ts = utc_now().strftime("%Y-%m-%d %H:%M:%S UTC")
    ref = secrets.token_hex(4)
    if channel == "email":
        payload = {
            "subject": f"MunLink outbox email test ({ref})",
            "body": f"Outbox email test\nTime: {ts}\nReference: {ref}",
        }
    else:
        payload = {"message": f"Outbox SMS test {ts} ref:{ref}"}

    row = NotificationOutbox(
        resident_id=user.id,
        channel=channel,
        event_type="interactive_notify_test",
        entity_id=user.id,
        payload=payload,
        status="pending",
        attempts=0,
        next_attempt_at=utc_now(),
        dedupe_key=f"interactive_notify_test:{channel}:{user.id}:{ref}",
    )
    db.session.add(row)
    db.session.commit()
    return int(row.id)


def _run_outbox_test(user: User, channels: List[str]) -> Dict[str, str]:
    results: Dict[str, str] = {}
    if not channels:
        return results

    pending_before = NotificationOutbox.query.filter_by(status="pending").count()
    processing_before = NotificationOutbox.query.filter_by(status="processing").count()
    print(
        f"\nQueue state before outbox test: pending={pending_before}, processing={processing_before}"
    )

    row_ids: List[int] = []
    for channel in channels:
        row_ids.append(_queue_outbox_row(user, channel))

    try:
        processed = process_batch(max_items=len(row_ids), newest_first=True)
        print(f"process_batch called with max_items={len(row_ids)} -> processed={processed}")
    except Exception as exc:
        db.session.rollback()
        for rid, channel in zip(row_ids, channels):
            results[channel] = f"row_id={rid} flush_exception={exc}"
        return results

    for rid, channel in zip(row_ids, channels):
        row = db.session.get(NotificationOutbox, rid)
        if not row:
            results[channel] = f"row_id={rid} missing_after_flush"
            continue
        results[channel] = (
            f"row_id={row.id} status={row.status} attempts={row.attempts} "
            f"last_error={row.last_error or '<none>'}"
        )
    return results


def _print_recent_outbox(user: User, limit: int = 10):
    rows = (
        NotificationOutbox.query.filter_by(resident_id=user.id)
        .order_by(NotificationOutbox.id.desc())
        .limit(limit)
        .all()
    )
    print(f"\nRecent outbox rows for {user.username} (latest {len(rows)}):")
    for row in rows:
        print(
            f"id={row.id} channel={row.channel} event={row.event_type} "
            f"status={row.status} attempts={row.attempts} "
            f"last_error={row.last_error or '<none>'}"
        )


def main() -> int:
    print("=" * 64)
    print("MunLink Interactive Notification Test")
    print("=" * 64)
    print("This script can send real email/SMS and write outbox test rows.")
    print()

    resident_username = _prompt_text("Resident username", default="princhprays", required=True)
    admin_username = _prompt_text("Admin username", default="masinloc_admin", required=True)

    app = create_app()
    client = app.test_client()
    summary: Dict[str, Tuple[bool, str]] = {}

    with app.app_context():
        resident = _find_user(resident_username)
        admin = _find_user(admin_username)

        if not resident:
            print(f"Resident user not found: {resident_username}")
            return 1
        if not admin:
            print(f"Admin user not found: {admin_username}")
            return 1

        _print_user_summary(resident, "Resident Account")
        _print_user_summary(admin, "Admin Account")

        print("\nProvider config")
        print("---------------")
        print(f"SMS_PROVIDER: {app.config.get('SMS_PROVIDER')}")
        print(f"PHILSMS_API_KEY set: {bool(app.config.get('PHILSMS_API_KEY'))}")
        print(f"SENDGRID_API_KEY set: {bool(app.config.get('SENDGRID_API_KEY'))}")
        print(f"SMTP_SERVER: {app.config.get('SMTP_SERVER') or '<not set>'}")

        run_login_test = _prompt_yes_no("\nRun login test for resident and admin?", default_yes=True)
        run_direct_email = _prompt_yes_no("Send direct email test to resident?", default_yes=True)
        run_direct_sms = _prompt_yes_no("Send direct SMS test to resident?", default_yes=True)
        run_outbox_email = _prompt_yes_no("Queue outbox email test + flush?", default_yes=True)
        run_outbox_sms = _prompt_yes_no("Queue outbox SMS test + flush?", default_yes=True)
        show_recent_outbox = _prompt_yes_no("Show recent outbox rows at end?", default_yes=True)

        if not _prompt_yes_no("\nProceed with selected actions?", default_yes=False):
            print("Cancelled.")
            return 0

        if run_login_test:
            resident_password = getpass.getpass("Resident password: ")
            admin_password = getpass.getpass("Admin password: ")

            ok, details = _test_login(client, "/api/auth/login", resident.username, resident_password)
            summary["resident_login"] = (ok, details)
            print(f"resident_login: {'PASS' if ok else 'FAIL'} ({details})")

            ok, details = _test_login(client, "/api/auth/admin/login", admin.username, admin_password)
            summary["admin_login"] = (ok, details)
            print(f"admin_login: {'PASS' if ok else 'FAIL'} ({details})")

        if run_direct_email:
            ok, details = _send_direct_email_test(resident)
            summary["direct_email"] = (ok, details)
            print(f"direct_email: {'PASS' if ok else 'FAIL'} ({details})")

        if run_direct_sms:
            ok, details = _send_direct_sms_test(resident)
            summary["direct_sms"] = (ok, details)
            print(f"direct_sms: {'PASS' if ok else 'FAIL'} ({details})")

        outbox_channels: List[str] = []
        if run_outbox_email:
            outbox_channels.append("email")
        if run_outbox_sms:
            outbox_channels.append("sms")
        if outbox_channels:
            outbox_results = _run_outbox_test(resident, outbox_channels)
            for channel in outbox_channels:
                details = outbox_results.get(channel, "no result")
                ok = "status=sent" in details
                summary[f"outbox_{channel}"] = (ok, details)
                print(f"outbox_{channel}: {'PASS' if ok else 'FAIL'} ({details})")

        if show_recent_outbox:
            _print_recent_outbox(resident, limit=10)

    print("\nSummary")
    print("-------")
    if not summary:
        print("No tests were run.")
        return 0

    any_fail = False
    for key, (ok, details) in summary.items():
        print(f"{key}: {'PASS' if ok else 'FAIL'} - {details}")
        if not ok:
            any_fail = True

    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
