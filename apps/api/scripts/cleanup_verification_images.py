#!/usr/bin/env python3
"""
Cleanup script for resident verification images.

Deletes ID/selfie images after verification + retention period.
Respects ID_RETENTION_DAYS environment variable (default: 30 days).

Usage:
    python apps/api/scripts/cleanup_verification_images.py [--dry-run]

Schedule:
    Run daily via cron or platform scheduler (Render/Railway)
"""

from apps.api.utils.time import utc_now
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from apps.api import create_app, db
from apps.api.models.user import User
from apps.api.models.admin_audit_log import AdminAuditLog
from apps.api.utils.storage_handler import delete_file
import click


@click.command()
@click.option('--dry-run', is_flag=True, help='Preview deletions without executing')
def cleanup_verification_images(dry_run):
    """Delete verification images past retention period."""
    app = create_app()

    with app.app_context():
        # Get retention period from env
        retention_days = int(os.getenv('ID_RETENTION_DAYS', '30'))
        cutoff_date = utc_now() - timedelta(days=retention_days)

        print(f"{'[DRY RUN] ' if dry_run else ''}Cleanup verification images")
        print(f"Retention period: {retention_days} days")
        print(f"Cutoff date: {cutoff_date.isoformat()}")
        print("-" * 60)

        # Find users eligible for cleanup
        # Criteria: (verified OR rejected) AND past retention period
        eligible_users = User.query.filter(
            db.or_(
                db.and_(User.admin_verified.is_(True), User.admin_verified_at < cutoff_date),
                db.and_(User.is_active.is_(False), User.updated_at < cutoff_date)
            )
        ).all()

        deleted_count = 0
        error_count = 0

        for user in eligible_users:
            doc_fields = ['valid_id_front', 'valid_id_back', 'selfie_with_id']
            user_deleted = 0

            for field in doc_fields:
                file_path = getattr(user, field, None)
                if not file_path:
                    continue

                try:
                    if not dry_run:
                        # Delete file
                        delete_file(file_path)

                        # Clear DB reference
                        setattr(user, field, None)
                        user_deleted += 1
                    else:
                        print(f"  Would delete: {file_path}")
                        user_deleted += 1

                except Exception as e:
                    print(f"  ERROR deleting {field} for user {user.id}: {e}")
                    error_count += 1

            if user_deleted > 0:
                if not dry_run:
                    # Log deletion to audit
                    log = AdminAuditLog(
                        admin_id=None,  # System action
                        admin_email='system@cleanup',
                        action='RESIDENT_DOCS_DELETED',
                        resource_type='resident',
                        resource_id=user.id,
                        details={
                            'reason': 'retention_policy_cleanup',
                            'retention_days': retention_days,
                            'deleted_count': user_deleted,
                            'verification_date': user.admin_verified_at.isoformat() if user.admin_verified_at else None
                        }
                    )
                    db.session.add(log)

                deleted_count += user_deleted
                print(f"User {user.id} ({user.email}): {user_deleted} files {'would be ' if dry_run else ''}deleted")

        if not dry_run:
            db.session.commit()
            print("-" * 60)
            print(f"✓ Cleanup complete: {deleted_count} files deleted")
            if error_count > 0:
                print(f"⚠ Errors encountered: {error_count}")
        else:
            print("-" * 60)
            print(f"[DRY RUN] Would delete {deleted_count} files from {len(eligible_users)} users")


if __name__ == '__main__':
    cleanup_verification_images()
