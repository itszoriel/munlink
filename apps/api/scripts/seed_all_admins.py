"""
Seed script to create one admin user per municipality across all Region 3 provinces.
This script is idempotent - safe to re-run without creating duplicates.

Usage:
    Local:
        cd apps/api
        python scripts/seed_all_admins.py

    Production (with environment override):
        python scripts/seed_all_admins.py --env .env.production

    Or set DATABASE_URL directly:
        $env:DATABASE_URL="postgresql://..." ; python scripts/seed_all_admins.py

Environment Variables:
    ADMIN_BASE_EMAIL      - Base Gmail for plus addressing (e.g., munlinkadmin@gmail.com)
    ADMIN_PASSWORD_SUFFIX - Suffix appended to municipality slug for password (e.g., @Munlink2026)
    DATABASE_URL          - Database connection string (defaults to local SQLite)
"""
import sys
import os
import argparse
from datetime import datetime, date
from pathlib import Path

# Ensure project root is importable so `apps.api.*` works
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def load_env_file(env_file: str = None):
    """Load environment variables from specified file or default .env"""
    from dotenv import load_dotenv
    
    if env_file:
        env_path = Path(env_file)
        if not env_path.is_absolute():
            env_path = Path(project_root) / env_file
        if env_path.exists():
            load_dotenv(env_path, override=True)
            print(f"Loaded environment from: {env_path}")
        else:
            print(f"Warning: Environment file not found: {env_path}")
            print("Using existing environment variables...")
    else:
        # Default: load .env from project root
        default_env = Path(project_root) / '.env'
        if default_env.exists():
            load_dotenv(default_env)
            print(f"Loaded environment from: {default_env}")


def get_config():
    """Get configuration from environment variables."""
    base_email = os.getenv('ADMIN_BASE_EMAIL', '')
    password_suffix = os.getenv('ADMIN_PASSWORD_SUFFIX', '@Munlink2026')
    
    if not base_email:
        print("\nERROR: ADMIN_BASE_EMAIL environment variable is required.")
        print("Example: ADMIN_BASE_EMAIL=munlinkadmin@gmail.com")
        print("\nThis email will be used with plus addressing:")
        print("  munlinkadmin+botolan@gmail.com")
        print("  munlinkadmin+iba@gmail.com")
        print("  etc.")
        sys.exit(1)
    
    # Validate email format
    if '@' not in base_email or not base_email.endswith('@gmail.com'):
        print("\nERROR: ADMIN_BASE_EMAIL must be a valid Gmail address.")
        print(f"Got: {base_email}")
        sys.exit(1)
    
    return {
        'base_email': base_email,
        'password_suffix': password_suffix,
    }


def generate_plus_email(base_email: str, slug: str) -> str:
    """Generate Gmail plus-addressed email for a municipality."""
    # Split base email: user@gmail.com -> user+slug@gmail.com
    username, domain = base_email.split('@')
    return f"{username}+{slug}@{domain}"


def generate_password(slug: str, suffix: str) -> str:
    """Generate password from municipality slug and suffix."""
    return f"{slug}{suffix}"


def seed_all_admins(dry_run: bool = False):
    """Create one admin user per municipality across all provinces."""
    import bcrypt
    from apps.api.app import create_app, db
    from apps.api.models.user import User
    from apps.api.models.municipality import Municipality
    from apps.api.models.province import Province
    
    config = get_config()
    base_email = config['base_email']
    password_suffix = config['password_suffix']
    
    app = create_app()
    
    with app.app_context():
        print("\n" + "=" * 60)
        print("MUNLINK REGION 3 - SEED ALL MUNICIPAL ADMINS")
        print("=" * 60)
        
        if dry_run:
            print("\n*** DRY RUN MODE - No changes will be made ***\n")
        
        # Check if provinces exist
        province_count = Province.query.count()
        municipality_count = Municipality.query.filter_by(is_active=True).count()
        
        if province_count == 0:
            print("\nERROR: No provinces found in database!")
            print("Please run seed_data.py first to populate provinces and municipalities.\n")
            return
        
        print(f"\nDatabase contains:")
        print(f"  - {province_count} provinces")
        print(f"  - {municipality_count} active municipalities")
        print(f"\nBase email: {base_email}")
        print(f"Password pattern: <slug>{password_suffix}")
        print()
        
        # Statistics
        total_created = 0
        total_skipped = 0
        total_errors = 0
        created_credentials = []
        
        # Get all provinces ordered by name
        provinces = Province.query.filter_by(is_active=True).order_by(Province.name).all()
        
        for province in provinces:
            print(f"\n{'-' * 50}")
            print(f"PROVINCE: {province.name}")
            print(f"{'-' * 50}")
            
            province_created = 0
            province_skipped = 0
            
            # Get municipalities for this province
            municipalities = Municipality.query.filter_by(
                province_id=province.id,
                is_active=True
            ).order_by(Municipality.name).all()
            
            if not municipalities:
                print("  No municipalities found.")
                continue
            
            for municipality in municipalities:
                # Check if admin already exists for this municipality
                existing_admin = User.query.filter_by(
                    role='municipal_admin',
                    admin_municipality_id=municipality.id
                ).first()
                
                if existing_admin:
                    print(f"  SKIP: {municipality.name} (admin exists: {existing_admin.username})")
                    province_skipped += 1
                    total_skipped += 1
                    continue
                
                # Generate username (truncate to 30 chars max)
                base_username = f"admin_{municipality.slug}"
                username = base_username[:30]  # Username column is varchar(30)
                
                # Also check if username already exists (edge case)
                if User.query.filter_by(username=username).first():
                    print(f"  SKIP: {municipality.name} (username '{username}' already taken)")
                    province_skipped += 1
                    total_skipped += 1
                    continue
                
                # Generate credentials
                email = generate_plus_email(base_email, municipality.slug)
                password = generate_password(municipality.slug, password_suffix)
                
                # Check if email already exists
                if User.query.filter_by(email=email.lower()).first():
                    print(f"  SKIP: {municipality.name} (email '{email}' already exists)")
                    province_skipped += 1
                    total_skipped += 1
                    continue
                
                if dry_run:
                    print(f"  WOULD CREATE: {municipality.name}")
                    print(f"    - Username: {username}")
                    print(f"    - Email: {email}")
                    province_created += 1
                    total_created += 1
                    continue
                
                try:
                    # Hash password
                    password_hash = bcrypt.hashpw(
                        password.encode('utf-8'),
                        bcrypt.gensalt()
                    ).decode('utf-8')
                    
                    # Create admin user
                    admin_user = User(
                        username=username,
                        email=email.lower(),
                        password_hash=password_hash,
                        first_name='Admin',
                        last_name=municipality.name,
                        date_of_birth=date(1990, 1, 1),  # Placeholder
                        role='municipal_admin',
                        admin_municipality_id=municipality.id,
                        municipality_id=municipality.id,
                        email_verified=True,
                        admin_verified=True,
                        email_verified_at=datetime.utcnow(),
                        admin_verified_at=datetime.utcnow(),
                        is_active=True
                    )
                    
                    db.session.add(admin_user)
                    db.session.flush()  # Get ID without committing
                    
                    print(f"  CREATED: {municipality.name}")
                    print(f"    - Username: {username}")
                    print(f"    - Email: {email}")
                    
                    # Store credentials for summary
                    created_credentials.append({
                        'province': province.name,
                        'municipality': municipality.name,
                        'username': username,
                        'email': email,
                        'password': password,
                    })
                    
                    province_created += 1
                    total_created += 1
                    
                except Exception as e:
                    print(f"  ERROR: {municipality.name} - {str(e)}")
                    total_errors += 1
                    db.session.rollback()
            
            # Commit after each province
            if not dry_run:
                db.session.commit()
            
            print(f"\n  Province summary: {province_created} created, {province_skipped} skipped")
        
        # Final summary
        print("\n" + "=" * 60)
        print("SEEDING COMPLETE")
        print("=" * 60)
        print(f"\nTotal admins created: {total_created}")
        print(f"Total admins skipped: {total_skipped}")
        if total_errors > 0:
            print(f"Total errors: {total_errors}")
        
        if created_credentials and not dry_run:
            print("\n" + "-" * 60)
            print("CREATED CREDENTIALS (save these securely!)")
            print("-" * 60)
            
            current_province = None
            for cred in created_credentials:
                if cred['province'] != current_province:
                    current_province = cred['province']
                    print(f"\n{current_province}:")
                
                print(f"  {cred['municipality']}:")
                print(f"    Username: {cred['username']}")
                print(f"    Email:    {cred['email']}")
                print(f"    Password: {cred['password']}")
            
            # Optionally export to file
            export_path = Path(project_root) / 'admin_credentials.txt'
            try:
                with open(export_path, 'w') as f:
                    f.write("MUNLINK REGION 3 - ADMIN CREDENTIALS\n")
                    f.write(f"Generated: {datetime.utcnow().isoformat()}\n")
                    f.write("=" * 60 + "\n\n")
                    f.write("WARNING: Delete this file after distributing credentials!\n\n")
                    
                    current_province = None
                    for cred in created_credentials:
                        if cred['province'] != current_province:
                            current_province = cred['province']
                            f.write(f"\n{current_province}\n")
                            f.write("-" * 40 + "\n")
                        
                        f.write(f"\n{cred['municipality']}:\n")
                        f.write(f"  Username: {cred['username']}\n")
                        f.write(f"  Email:    {cred['email']}\n")
                        f.write(f"  Password: {cred['password']}\n")
                
                print(f"\nCredentials exported to: {export_path}")
                print("WARNING: Delete this file after distributing credentials!")
            except Exception as e:
                print(f"\nNote: Could not export credentials to file: {e}")
        
        print("\nDone!\n")


def main():
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description='Seed admin users for all municipalities in Region 3',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/seed_all_admins.py                    # Use default .env
  python scripts/seed_all_admins.py --env .env.local  # Use local env file
  python scripts/seed_all_admins.py --env .env.production  # Use production env
  python scripts/seed_all_admins.py --dry-run         # Preview without changes
        """
    )
    
    parser.add_argument(
        '--env',
        type=str,
        help='Path to environment file (default: .env in project root)'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview what would be created without making changes'
    )
    
    args = parser.parse_args()
    
    # Load environment
    load_env_file(args.env)
    
    # Run seeding
    seed_all_admins(dry_run=args.dry_run)


if __name__ == '__main__':
    main()

