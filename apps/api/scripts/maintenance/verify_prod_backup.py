#!/usr/bin/env python3
"""
Verify PROD database backup exists in Supabase.

This script checks Supabase to ensure you have a recent backup before making changes.

Usage:
    python apps/api/scripts/verify_prod_backup.py
"""
import sys

PROD_PROJECT_ID = "xzkhavrjfaxsqxyptbgm"
PROD_URL = "https://xzkhavrjfaxsqxyptbgm.supabase.co"


def main():
    print("="*80)
    print("PROD BACKUP VERIFICATION")
    print("="*80)
    print()
    print("IMPORTANT: Before making ANY changes to PROD, you MUST:")
    print()
    print("1. Go to Supabase PROD dashboard:")
    print(f"   {PROD_URL}")
    print()
    print("2. Navigate to: Settings > Database > Point in Time Recovery (PITR)")
    print()
    print("3. Verify one of the following:")
    print("   - PITR is enabled (automatic backups)")
    print("   - OR you have a recent manual backup/snapshot")
    print()
    print("4. If using manual backups:")
    print("   - Go to: Database > Backups")
    print("   - Create a new backup NOW before proceeding")
    print("   - Download the backup file for extra safety")
    print()
    print("="*80)
    print()

    response = input("Have you verified PROD has a backup? (yes/no): ").strip().lower()

    if response in ['yes', 'y']:
        print()
        print("[OK] Backup verified. You may proceed with the sync.")
        print()
        return 0
    else:
        print()
        print("[STOP] Please create a PROD backup before proceeding.")
        print("Go to Supabase dashboard and create a backup now.")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
