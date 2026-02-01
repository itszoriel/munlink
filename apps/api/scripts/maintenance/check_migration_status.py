#!/usr/bin/env python3
"""
Check which migrations have been applied to DEV and PROD databases.

Usage:
    python apps/api/scripts/check_migration_status.py
"""
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT_ROOT))

# Database URLs
DEV_URL = "postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
PROD_URL = "postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Critical migrations that need to be in PROD
CRITICAL_MIGRATIONS = [
    '20260118_superadmin_2fa_audit',
    '20260118_sa_security',
    '20260119_add_user_permissions',
    '20260117_sharing',
    '20260120_document_locality',
    '20260306_scoped_announcements',
]


def get_applied_migrations(db_url):
    """Get list of applied migrations from alembic_version table."""
    engine = create_engine(db_url)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            versions = [row[0] for row in result]
            return versions
    except Exception as e:
        print(f"Error querying migrations: {e}")
        return []
    finally:
        engine.dispose()


def main():
    print("="*80)
    print("MIGRATION STATUS CHECK")
    print("="*80)
    print()

    print("Checking DEV database...")
    dev_migrations = get_applied_migrations(DEV_URL)
    print(f"DEV has {len(dev_migrations)} migrations applied")

    print("Checking PROD database...")
    prod_migrations = get_applied_migrations(PROD_URL)
    print(f"PROD has {len(prod_migrations)} migrations applied")
    print()

    # Check which critical migrations are missing in PROD
    dev_set = set(dev_migrations)
    prod_set = set(prod_migrations)

    missing_in_prod = dev_set - prod_set
    extra_in_prod = prod_set - dev_set

    if missing_in_prod:
        print("[MISSING IN PROD] These migrations are in DEV but not in PROD:")
        for migration in sorted(missing_in_prod):
            is_critical = any(migration.startswith(cm) for cm in CRITICAL_MIGRATIONS)
            marker = "[CRITICAL]" if is_critical else ""
            print(f"   - {migration} {marker}")
        print()

    if extra_in_prod:
        print("[EXTRA IN PROD] These migrations are in PROD but not in DEV:")
        for migration in sorted(extra_in_prod):
            print(f"   - {migration}")
        print()

    # Check critical migrations specifically
    print("="*80)
    print("CRITICAL MIGRATIONS STATUS")
    print("="*80)
    for migration in CRITICAL_MIGRATIONS:
        in_dev = any(m.startswith(migration) for m in dev_migrations)
        in_prod = any(m.startswith(migration) for m in prod_migrations)

        dev_status = "[OK]" if in_dev else "[MISSING]"
        prod_status = "[OK]" if in_prod else "[MISSING]"

        print(f"{migration}:")
        print(f"   DEV:  {dev_status}")
        print(f"   PROD: {prod_status}")
    print()

    # Summary
    if not missing_in_prod:
        print("[OK] PROD is up to date with DEV migrations!")
    else:
        print(f"[ACTION REQUIRED] {len(missing_in_prod)} migration(s) need to be applied to PROD")
        print("Run: flask db upgrade")


if __name__ == "__main__":
    main()
