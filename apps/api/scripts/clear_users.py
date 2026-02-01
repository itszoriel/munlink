#!/usr/bin/env python3
"""
Delete all user accounts and user-linked records while keeping location tables.

What it deletes:
- Notifications, verification codes, token artifacts
- Document requests, benefit applications, issues
- Marketplace items, transactions, and their audit logs
- Announcements, transfer requests, audit logs
- All users

What it keeps:
- Provinces, municipalities, barangays
- Reference data such as document types, issue categories, benefit programs

Usage:
    python apps/api/scripts/clear_users.py --confirm

Options:
    --dry-run   Show counts only; do not delete.
    --confirm   Skip the interactive safety prompt.
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Make project root importable
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment variables before importing config
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    load_dotenv(env_path)

try:
    from apps.api.app import create_app
    from apps.api.config import ProductionConfig
    from apps.api import db
    from apps.api.models.user import User
    from apps.api.models.document import DocumentRequest
    from apps.api.models.issue import Issue
    from apps.api.models.benefit import BenefitApplication
    from apps.api.models.marketplace import Item, Transaction, TransactionAuditLog
    from apps.api.models.token_blacklist import TokenBlacklist
    from apps.api.models.refresh_token import RefreshTokenFamily, RefreshToken
    from apps.api.models.notification import NotificationOutbox
    from apps.api.models.email_verification_code import EmailVerificationCode
    from apps.api.models.announcement import Announcement
    from apps.api.models.audit import AuditLog
    from apps.api.models.admin_audit_log import AdminAuditLog
    from apps.api.models.transfer import TransferRequest
    from sqlalchemy import inspect
except ImportError as exc:  # pragma: no cover
    print(f"Import error: {exc}")
    sys.exit(1)


DELETION_ORDER = [
    ("notification_outbox", NotificationOutbox),
    ("email_verification_codes", EmailVerificationCode),
    ("token_blacklist", TokenBlacklist),
    ("refresh_tokens", RefreshToken),
    ("refresh_token_families", RefreshTokenFamily),
    ("benefit_applications", BenefitApplication),
    ("document_requests", DocumentRequest),
    ("issues", Issue),
    ("transaction_audit_logs", TransactionAuditLog),
    ("transactions", Transaction),
    ("items", Item),
    ("announcements", Announcement),
    ("transfer_requests", TransferRequest),
    ("audit_logs", AuditLog),
    ("admin_audit_logs", AdminAuditLog),
    ("users", User),
]


def build_app():
    """Create the Flask app with the database URL from the environment."""
    app = create_app(ProductionConfig)
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    return app


def confirm_or_abort():
    """Ask for a destructive-action acknowledgement."""
    prompt = "Type DELETE USERS to remove all users (locations stay intact): "
    reply = input(prompt).strip().lower()
    if reply != "delete users":
        print("Cancelled.")
        sys.exit(1)


def table_exists(inspector, table_name: str) -> bool:
    """Return True if the table exists in the connected database."""
    try:
        return inspector.has_table(table_name)
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Delete all users and user-linked records while keeping location data."
    )
    parser.add_argument("--confirm", action="store_true", help="Skip the interactive prompt.")
    parser.add_argument("--dry-run", action="store_true", help="Show counts only; do not delete.")
    args = parser.parse_args()

    app = build_app()
    db_url = app.config.get("SQLALCHEMY_DATABASE_URI")
    if not db_url:
        print("DATABASE_URL is required. Set it in .env or the environment.")
        sys.exit(1)

    with app.app_context():
        inspector = inspect(db.engine)
        planned = {}
        for label, model in DELETION_ORDER:
            table_name = model.__tablename__
            if not table_exists(inspector, table_name):
                planned[label] = "skip (table missing)"
                continue
            try:
                planned[label] = model.query.count()
            except Exception as exc:  # pragma: no cover
                db.session.rollback()
                planned[label] = f"error: {exc}"

        print("Planned deletions (rows):")
        for label, count in planned.items():
            print(f"- {label}: {count}")

        if args.dry_run:
            print("Dry run only. Nothing was deleted.")
            return

        if not args.confirm:
            confirm_or_abort()

        deleted = {}
        try:
            for label, model in DELETION_ORDER:
                table_name = model.__tablename__
                if not table_exists(inspector, table_name):
                    deleted[label] = "skipped (table missing)"
                    continue
                try:
                    deleted[label] = model.query.delete(synchronize_session=False)
                except Exception as exc:
                    db.session.rollback()
                    deleted[label] = f"error: {exc}"
            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            print(f"Error while deleting: {exc}")
            sys.exit(1)

        print("Deletion complete (rows removed):")
        for label, count in deleted.items():
            print(f"- {label}: {count}")
        print("Location tables (provinces, municipalities, barangays) were not touched.")


if __name__ == "__main__":
    main()
