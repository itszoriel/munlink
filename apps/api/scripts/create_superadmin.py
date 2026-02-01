#!/usr/bin/env python3
"""
MunLink Super Admin Account Setup Script

Creates a super admin account for the MunLink platform.
Run this script once to set up your super admin credentials.

Usage (interactive):
    cd apps/api
    python scripts/create_superadmin.py

Usage (non-interactive):
    cd apps/api
    python scripts/create_superadmin.py --email your@email.com --password YourPass123

The script will prompt for email and password interactively if not provided.
"""
import os
import sys
import getpass
import re
import argparse

# Add the parent directory to the path so we can import from the app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()


def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one digit"
    return True, ""


def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Create a MunLink super admin account')
    parser.add_argument('--email', '-e', help='Super admin email address')
    parser.add_argument('--password', '-p', help='Super admin password (min 8 chars, must include uppercase, lowercase, and digit)')
    parser.add_argument('--force', '-f', action='store_true', help='Skip confirmation if super admin already exists')
    args = parser.parse_args()

    print("\n" + "=" * 50)
    print("  MunLink Super Admin Account Setup")
    print("=" * 50 + "\n")

    # Import Flask app and models after path setup
    try:
        from app import create_app
        from apps.api import db
        from apps.api.models.user import User
    except ImportError:
        from app import create_app
        from __init__ import db
        from models.user import User

    import bcrypt

    app = create_app()

    with app.app_context():
        # Check if a super admin already exists
        existing = User.query.filter(User.role == 'superadmin').first()
        if existing:
            print(f"A super admin account already exists: {existing.email}")
            if not args.force:
                try:
                    response = input("\nDo you want to create another one? (y/N): ").strip().lower()
                    if response != 'y':
                        print("Cancelled.")
                        sys.exit(0)
                except EOFError:
                    print("Non-interactive mode. Use --force to skip this check.")
                    sys.exit(1)

        # Get email (from args or prompt)
        email = args.email
        if email:
            email = email.strip().lower()
            if not validate_email(email):
                print("  Invalid email format.")
                sys.exit(1)
            if User.query.filter_by(email=email).first():
                print("  This email is already registered.")
                sys.exit(1)
        else:
            while True:
                try:
                    email = input("Enter your email: ").strip().lower()
                except EOFError:
                    print("Email is required. Use --email flag for non-interactive mode.")
                    sys.exit(1)
                if not email:
                    print("  Email is required.")
                    continue
                if not validate_email(email):
                    print("  Invalid email format.")
                    continue
                # Check if email already exists
                if User.query.filter_by(email=email).first():
                    print("  This email is already registered.")
                    continue
                break

        # Get password (from args or prompt)
        password = args.password
        if password:
            valid, error = validate_password(password)
            if not valid:
                print(f"  {error}")
                sys.exit(1)
        else:
            while True:
                try:
                    password = getpass.getpass("Enter password (min 8 characters): ")
                except EOFError:
                    print("Password is required. Use --password flag for non-interactive mode.")
                    sys.exit(1)
                valid, error = validate_password(password)
                if not valid:
                    print(f"  {error}")
                    continue

                password_confirm = getpass.getpass("Confirm password: ")
                if password != password_confirm:
                    print("  Passwords do not match.")
                    continue
                break

        # Create the account
        print("\nCreating super admin account...")

        # Hash password with bcrypt
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Generate a simple username from email
        username = email.split('@')[0].lower()
        # Ensure username is unique
        base_username = username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{counter}"
            counter += 1

        try:
            user = User(
                username=username,
                email=email,
                password_hash=password_hash,
                first_name='Super',
                last_name='Admin',
                role='superadmin',
                is_active=True,
                email_verified=True,
                admin_verified=True,
                created_via='setup_script',
                permissions=['*']  # Superadmin gets all permissions
            )
            db.session.add(user)
            db.session.commit()

            print("\n" + "=" * 50)
            print("  SUCCESS!")
            print("=" * 50)
            print(f"\n  Email: {email}")
            print(f"  Username: {username}")
            print(f"  Role: superadmin")
            print("\n  You can now log in at /admin/superadmin/login")
            print("  (Login requires email + password + 2FA code)")
            print("\n" + "=" * 50 + "\n")

        except Exception as e:
            db.session.rollback()
            print(f"\nError creating account: {e}")
            sys.exit(1)


if __name__ == '__main__':
    main()
