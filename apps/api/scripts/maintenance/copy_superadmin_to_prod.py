#!/usr/bin/env python3
"""
Copy superadmin account from DEV to PROD.

This script:
1. Finds the superadmin in DEV database
2. Creates/updates the superadmin in PROD database
3. Copies all necessary fields including password hash

Usage:
    python apps/api/scripts/copy_superadmin_to_prod.py --confirm
"""
import argparse
import sys
import json
from pathlib import Path
from sqlalchemy import create_engine, text
from datetime import datetime

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT_ROOT))

# Database URLs
DEV_URL = "postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
PROD_URL = "postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"


def get_superadmin_from_dev():
    """Get superadmin account from DEV database."""
    engine = create_engine(DEV_URL)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id, username, email, password_hash, first_name, middle_name, last_name, suffix, role,
                       admin_municipality_id, admin_barangay_id,
                       permissions, created_via, require_ip_allowlist,
                       mobile_number, notify_email_enabled, notify_sms_enabled,
                       created_at, updated_at
                FROM users
                WHERE role = 'superadmin'
                LIMIT 1
            """))
            row = result.fetchone()
            if row:
                return {
                    'id': row[0],
                    'username': row[1],
                    'email': row[2],
                    'password_hash': row[3],
                    'first_name': row[4],
                    'middle_name': row[5],
                    'last_name': row[6],
                    'suffix': row[7],
                    'role': row[8],
                    'admin_municipality_id': row[9],
                    'admin_barangay_id': row[10],
                    'permissions': row[11],
                    'created_via': row[12],
                    'require_ip_allowlist': row[13],
                    'mobile_number': row[14],
                    'notify_email_enabled': row[15],
                    'notify_sms_enabled': row[16],
                    'created_at': row[17],
                    'updated_at': row[18],
                }
            return None
    finally:
        engine.dispose()


def check_superadmin_in_prod():
    """Check if superadmin already exists in PROD."""
    engine = create_engine(PROD_URL)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id, email FROM users WHERE role = 'superadmin' LIMIT 1
            """))
            row = result.fetchone()
            if row:
                return {'id': row[0], 'email': row[1]}
            return None
    finally:
        engine.dispose()


def create_or_update_superadmin_in_prod(superadmin_data):
    """Create or update superadmin in PROD database."""
    engine = create_engine(PROD_URL)
    try:
        with engine.begin() as conn:
            # Check if superadmin exists
            existing = conn.execute(text("""
                SELECT id FROM users WHERE role = 'superadmin' LIMIT 1
            """)).fetchone()

            # Serialize permissions to JSON string
            perms_json = json.dumps(superadmin_data['permissions']) if superadmin_data['permissions'] else None

            if existing:
                # Update existing superadmin
                conn.execute(text("""
                    UPDATE users
                    SET username = :username,
                        email = :email,
                        password_hash = :password_hash,
                        first_name = :first_name,
                        middle_name = :middle_name,
                        last_name = :last_name,
                        suffix = :suffix,
                        admin_municipality_id = :admin_municipality_id,
                        admin_barangay_id = :admin_barangay_id,
                        permissions = :permissions,
                        created_via = :created_via,
                        require_ip_allowlist = :require_ip_allowlist,
                        mobile_number = :mobile_number,
                        notify_email_enabled = :notify_email_enabled,
                        notify_sms_enabled = :notify_sms_enabled,
                        updated_at = :updated_at
                    WHERE role = 'superadmin'
                """), {
                    'username': superadmin_data['username'],
                    'email': superadmin_data['email'],
                    'password_hash': superadmin_data['password_hash'],
                    'first_name': superadmin_data['first_name'],
                    'middle_name': superadmin_data['middle_name'],
                    'last_name': superadmin_data['last_name'],
                    'suffix': superadmin_data['suffix'],
                    'admin_municipality_id': superadmin_data['admin_municipality_id'],
                    'admin_barangay_id': superadmin_data['admin_barangay_id'],
                    'permissions': perms_json,
                    'created_via': superadmin_data['created_via'] or 'migration',
                    'require_ip_allowlist': superadmin_data['require_ip_allowlist'] or False,
                    'mobile_number': superadmin_data['mobile_number'],
                    'notify_email_enabled': superadmin_data.get('notify_email_enabled', True),
                    'notify_sms_enabled': superadmin_data.get('notify_sms_enabled', False),
                    'updated_at': datetime.utcnow(),
                })
                return 'updated', existing[0]
            else:
                # Insert new superadmin
                result = conn.execute(text("""
                    INSERT INTO users (
                        username, email, password_hash, first_name, middle_name, last_name, suffix, role,
                        admin_municipality_id, admin_barangay_id,
                        permissions, created_via, require_ip_allowlist,
                        mobile_number, notify_email_enabled, notify_sms_enabled,
                        created_at, updated_at
                    ) VALUES (
                        :username, :email, :password_hash, :first_name, :middle_name, :last_name, :suffix, 'superadmin',
                        :admin_municipality_id, :admin_barangay_id,
                        :permissions, :created_via, :require_ip_allowlist,
                        :mobile_number, :notify_email_enabled, :notify_sms_enabled,
                        :created_at, :updated_at
                    ) RETURNING id
                """), {
                    'username': superadmin_data['username'],
                    'email': superadmin_data['email'],
                    'password_hash': superadmin_data['password_hash'],
                    'first_name': superadmin_data['first_name'],
                    'middle_name': superadmin_data['middle_name'],
                    'last_name': superadmin_data['last_name'],
                    'suffix': superadmin_data['suffix'],
                    'admin_municipality_id': superadmin_data['admin_municipality_id'],
                    'admin_barangay_id': superadmin_data['admin_barangay_id'],
                    'permissions': perms_json,
                    'created_via': superadmin_data['created_via'] or 'migration',
                    'require_ip_allowlist': superadmin_data['require_ip_allowlist'] or False,
                    'mobile_number': superadmin_data['mobile_number'],
                    'notify_email_enabled': superadmin_data.get('notify_email_enabled', True),
                    'notify_sms_enabled': superadmin_data.get('notify_sms_enabled', False),
                    'created_at': superadmin_data['created_at'],
                    'updated_at': datetime.utcnow(),
                })
                new_id = result.fetchone()[0]
                return 'created', new_id
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(
        description="Copy superadmin account from DEV to PROD"
    )
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without doing it")
    args = parser.parse_args()

    print("="*80)
    print("COPY SUPERADMIN: DEV -> PROD")
    print("="*80)
    print()

    # Get superadmin from DEV
    print("Fetching superadmin from DEV...")
    dev_superadmin = get_superadmin_from_dev()

    if not dev_superadmin:
        print("[ERROR] No superadmin found in DEV database!")
        sys.exit(1)

    print(f"[OK] Found superadmin in DEV:")
    print(f"   Email: {dev_superadmin['email']}")
    name_parts = [dev_superadmin.get('first_name'), dev_superadmin.get('middle_name'), dev_superadmin.get('last_name'), dev_superadmin.get('suffix')]
    full_name = ' '.join(filter(None, name_parts))
    print(f"   Name: {full_name}")
    print(f"   Permissions: {dev_superadmin['permissions']}")
    print(f"   Require IP Allowlist: {dev_superadmin['require_ip_allowlist']}")
    print()

    # Check if superadmin exists in PROD
    print("Checking PROD database...")
    prod_superadmin = check_superadmin_in_prod()

    if prod_superadmin:
        print(f"[WARNING] Superadmin already exists in PROD:")
        print(f"   ID: {prod_superadmin['id']}")
        print(f"   Email: {prod_superadmin['email']}")
        print("   This superadmin will be UPDATED with DEV data.")
    else:
        print("[INFO] No superadmin in PROD. A new one will be created.")
    print()

    if args.dry_run:
        print("[DRY RUN] Would copy superadmin but not executing.")
        return

    if not args.confirm:
        print("This will copy/update the superadmin account in PROD with DEV data.")
        reply = input("Type COPY SUPERADMIN to proceed: ").strip()
        if reply != "COPY SUPERADMIN":
            print("Cancelled.")
            sys.exit(1)

    # Copy superadmin to PROD
    print("Copying superadmin to PROD...")
    action, user_id = create_or_update_superadmin_in_prod(dev_superadmin)

    print(f"[OK] Superadmin {action} in PROD!")
    print(f"   User ID: {user_id}")
    print(f"   Email: {dev_superadmin['email']}")
    print()
    print("You can now log in to PROD with this superadmin account.")
    print("Remember to configure IP allowlist if require_ip_allowlist is True.")


if __name__ == "__main__":
    main()
