#!/usr/bin/env python3
"""
Validate that PROD database is correctly synced with DEV.

This script performs smoke tests to ensure:
1. All critical tables exist
2. Superadmin account exists and has correct permissions
3. Schema matches expected structure
4. No data corruption

Usage:
    python apps/api/scripts/validate_prod_sync.py
"""
import sys
from pathlib import Path
from sqlalchemy import create_engine, text, inspect

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT_ROOT))

# Database URL
PROD_URL = "postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Critical tables that must exist
CRITICAL_TABLES = [
    'users',
    'admin_audit_logs',
    'email_verification_codes',
    'superadmin_sessions',
    'superadmin_ip_allowlist',
    'announcements',
    'document_types',
    'provinces',
    'municipalities',
    'barangays',
]

# Critical columns in users table
CRITICAL_USER_COLUMNS = [
    'id',
    'email',
    'password_hash',
    'role',
    'admin_barangay_id',
    'admin_municipality_id',
    'permissions',
    'created_via',
    'last_ip',
    'last_user_agent',
    'failed_login_attempts',
    'account_locked_until',
    'require_ip_allowlist',
    'mobile_number',
    'notify_email_enabled',
    'notify_sms_enabled',
]

# Critical columns in announcements table
CRITICAL_ANNOUNCEMENT_COLUMNS = [
    'id',
    'title',
    'municipality_id',
    'barangay_id',
    'scope',
    'status',
    'pinned',
    'pinned_until',
    'publish_at',
    'expire_at',
    'created_by_staff_id',
    'shared_with_municipalities',
]


def check_table_exists(inspector, table_name):
    """Check if a table exists."""
    return inspector.has_table(table_name)


def check_column_exists(inspector, table_name, column_name):
    """Check if a column exists in a table."""
    columns = inspector.get_columns(table_name)
    return any(col['name'] == column_name for col in columns)


def validate_superadmin(conn):
    """Validate that superadmin exists and has correct setup."""
    result = conn.execute(text("""
        SELECT id, email, role, permissions, require_ip_allowlist
        FROM users
        WHERE role = 'superadmin'
        LIMIT 1
    """))
    superadmin = result.fetchone()

    if not superadmin:
        return False, "No superadmin found in PROD"

    # Check permissions
    permissions = superadmin[3]
    if not permissions or (isinstance(permissions, list) and '*' not in permissions and '["*"]' not in str(permissions)):
        return False, f"Superadmin has incorrect permissions: {permissions}"

    return True, f"Superadmin OK (email: {superadmin[1]})"


def validate_location_data(conn):
    """Validate that location data exists."""
    # Check provinces
    result = conn.execute(text("SELECT COUNT(*) FROM provinces"))
    province_count = result.scalar()

    # Check municipalities
    result = conn.execute(text("SELECT COUNT(*) FROM municipalities"))
    municipality_count = result.scalar()

    # Check barangays
    result = conn.execute(text("SELECT COUNT(*) FROM barangays"))
    barangay_count = result.scalar()

    if province_count == 0 or municipality_count == 0 or barangay_count == 0:
        return False, f"Missing location data: {province_count} provinces, {municipality_count} municipalities, {barangay_count} barangays"

    # Check for Zambales (province_id = 6)
    result = conn.execute(text("SELECT COUNT(*) FROM provinces WHERE id = 6"))
    has_zambales = result.scalar() > 0

    if not has_zambales:
        return False, "Zambales province (ID 6) not found"

    return True, f"Location data OK: {province_count} provinces, {municipality_count} municipalities, {barangay_count} barangays"


def main():
    print("="*80)
    print("PROD DATABASE VALIDATION")
    print("="*80)
    print()

    engine = create_engine(PROD_URL)
    inspector = inspect(engine)
    all_passed = True

    # 1. Check critical tables
    print("[1] Checking critical tables...")
    for table in CRITICAL_TABLES:
        exists = check_table_exists(inspector, table)
        status = "[OK]" if exists else "[FAIL]"
        print(f"   {status} {table}")
        if not exists:
            all_passed = False
    print()

    # 2. Check users table columns
    print("[2] Checking users table columns...")
    if check_table_exists(inspector, 'users'):
        for column in CRITICAL_USER_COLUMNS:
            exists = check_column_exists(inspector, 'users', column)
            status = "[OK]" if exists else "[FAIL]"
            print(f"   {status} users.{column}")
            if not exists:
                all_passed = False
    else:
        print("   [SKIP] users table doesn't exist")
        all_passed = False
    print()

    # 3. Check announcements table columns
    print("[3] Checking announcements table columns...")
    if check_table_exists(inspector, 'announcements'):
        for column in CRITICAL_ANNOUNCEMENT_COLUMNS:
            exists = check_column_exists(inspector, 'announcements', column)
            status = "[OK]" if exists else "[FAIL]"
            print(f"   {status} announcements.{column}")
            if not exists:
                all_passed = False
    else:
        print("   [SKIP] announcements table doesn't exist")
        all_passed = False
    print()

    # 4. Check superadmin
    print("[4] Validating superadmin account...")
    try:
        with engine.connect() as conn:
            passed, message = validate_superadmin(conn)
            status = "[OK]" if passed else "[FAIL]"
            print(f"   {status} {message}")
            if not passed:
                all_passed = False
    except Exception as e:
        print(f"   [FAIL] Error checking superadmin: {e}")
        all_passed = False
    print()

    # 5. Check location data
    print("[5] Validating location data...")
    try:
        with engine.connect() as conn:
            passed, message = validate_location_data(conn)
            status = "[OK]" if passed else "[FAIL]"
            print(f"   {status} {message}")
            if not passed:
                all_passed = False
    except Exception as e:
        print(f"   [FAIL] Error checking location data: {e}")
        all_passed = False
    print()

    # 6. Check for any user data (should be only superadmin)
    print("[6] Checking user count...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()

            result = conn.execute(text("SELECT COUNT(*) FROM users WHERE role = 'superadmin'"))
            superadmin_count = result.scalar()

            if user_count == 1 and superadmin_count == 1:
                print(f"   [OK] Only superadmin exists ({user_count} total user)")
            elif user_count == superadmin_count:
                print(f"   [WARNING] {user_count} superadmin(s) exist (expected 1)")
            else:
                print(f"   [WARNING] {user_count} total users, {superadmin_count} superadmin(s)")
                print(f"             Expected: clean database with only 1 superadmin")
    except Exception as e:
        print(f"   [FAIL] Error checking user count: {e}")
        all_passed = False
    print()

    # Summary
    print("="*80)
    if all_passed:
        print("[SUCCESS] All validation checks passed!")
        print("PROD database is correctly synced and ready to use.")
    else:
        print("[FAILED] Some validation checks failed.")
        print("Review the errors above and fix them before using PROD.")
        sys.exit(1)
    print("="*80)

    engine.dispose()


if __name__ == "__main__":
    main()
