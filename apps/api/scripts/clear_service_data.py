#!/usr/bin/env python3
"""
Clear service data (requests/content) while keeping users and locations.

Deletes:
- Document requests and document types
- Issues and issue categories
- Benefit applications and benefit programs
- Marketplace items, transactions, and transaction audit logs
- Announcements

Keeps:
- Users, provinces, municipalities, barangays, and other reference data

Usage:
    python apps/api/scripts/clear_service_data.py --confirm

Options:
    --dry-run   Show row counts only; no deletions.
    --confirm   Skip the interactive prompt.
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment variables early
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    load_dotenv(env_path)

try:
    from apps.api.app import create_app
    from apps.api.config import ProductionConfig
    from apps.api import db
    from sqlalchemy import inspect, text
except ImportError as exc:  # pragma: no cover
    print(f"Import error: {exc}")
    sys.exit(1)


# Table names in FK-safe order
DELETION_ORDER = [
    ("transaction_audit_logs", "transaction_audit_logs"),
    ("transactions", "transactions"),
    ("items", "items"),
    ("benefit_applications", "benefit_applications"),
    ("benefit_programs", "benefit_programs"),
    ("document_requests", "document_requests"),
    ("document_types", "document_types"),
    ("issues", "issues"),
    ("issue_categories", "issue_categories"),
    ("announcements", "announcements"),
]


def build_app():
    """Create the Flask app configured with DATABASE_URL."""
    app = create_app(ProductionConfig)
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    return app


def confirm_or_abort():
    """Prompt user before destructive action."""
    reply = input("Type CLEAR SERVICES to proceed: ").strip().lower()
    if reply != "clear services":
        print("Cancelled.")
        sys.exit(1)


def table_exists(inspector, table_name: str) -> bool:
    """Check if a table exists."""
    try:
        return inspector.has_table(table_name)
    except Exception:
        return False


def safe_count(table_name: str):
    """Return row count using raw SQL to avoid model/column mismatches."""
    try:
        result = db.session.execute(text(f'SELECT count(*) FROM "{table_name}"'))
        return result.scalar()
    except Exception as exc:
        db.session.rollback()
        return f"error: {exc}"


def main():
    parser = argparse.ArgumentParser(
        description="Clear service data (documents, issues, announcements, programs, marketplace)."
    )
    parser.add_argument("--dry-run", action="store_true", help="Show counts only; do not delete.")
    parser.add_argument("--confirm", action="store_true", help="Skip the confirmation prompt.")
    args = parser.parse_args()

    app = build_app()
    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        print("DATABASE_URL is required. Set it in .env or the environment.")
        sys.exit(1)

    with app.app_context():
        inspector = inspect(db.engine)

        planned = {}
        for label, table_name in DELETION_ORDER:
            if not table_exists(inspector, table_name):
                planned[label] = "skip (table missing)"
                continue
            planned[label] = safe_count(table_name)

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
            for label, table_name in DELETION_ORDER:
                if not table_exists(inspector, table_name):
                    deleted[label] = "skipped (table missing)"
                    continue
                try:
                    db.session.execute(text(f'DELETE FROM "{table_name}"'))
                    deleted[label] = "ok"
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
        print("Users and location tables were left intact.")


if __name__ == "__main__":
    main()
