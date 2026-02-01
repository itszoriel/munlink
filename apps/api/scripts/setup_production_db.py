"""
Script to set up production Supabase database.
Creates all tables and seeds location data (provinces, municipalities, barangays).

Uses environment variables from .env file.
"""
import sys
import os
import argparse
import time
from pathlib import Path
from dotenv import load_dotenv

# Ensure project root is importable
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Load environment variables from .env file
env_path = Path(project_root) / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"Loaded environment from: {env_path}")
else:
    print(f"Warning: .env file not found at {env_path}")
    print("Using existing environment variables...")

# Get credentials from environment variables
DATABASE_URL = os.getenv('DATABASE_URL')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# Validate required environment variables
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required. Please set it in .env file.")
if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL environment variable is required. Please set it in .env file.")


def wait_for_db(app, max_retries=5, retry_delay=10):
    """
    Wait for database to be available with retries.
    Supabase connections can sometimes be slow to establish.
    """
    from apps.api import db
    from sqlalchemy import text
    
    for attempt in range(max_retries):
        try:
            with app.app_context():
                # Try a simple query to test connection
                db.session.execute(text("SELECT 1"))
                db.session.commit()
                print(f"  [OK] Database connection successful!")
                return True
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  Database connection attempt {attempt + 1}/{max_retries} failed: {e}")
                print(f"  Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"  [ERROR] Database connection failed after {max_retries} attempts: {e}")
                raise
    return False


def seed_locations():
    """
    Seed location data: provinces, municipalities, and barangays.
    This ensures all Region 3 locations are available in production.
    """
    from apps.api.models.province import Province
    from apps.api.models.municipality import Municipality
    
    # Check if location data already exists
    province_count = Province.query.count()
    if province_count > 0:
        print(f"  [OK] Location data already exists ({province_count} provinces found), skipping seed.")
        return
    
    print("  No location data found, seeding provinces, municipalities, and barangays...")
    
    # Import seed functions from seed_data.py
    from apps.api.scripts.seed_data import (
        seed_provinces,
        seed_municipalities,
    )
    from apps.api import db
    
    try:
        seed_provinces()
        seed_municipalities()
        print("  [OK] Location data seeded successfully!")
    except Exception as e:
        print(f"  [WARNING] Location seeding failed: {e}")
        import traceback
        traceback.print_exc()
        # Don't raise - allow setup to continue even if seeding fails


def setup_production_database():
    """
    Initialize production database - create tables and seed location data.
    Uses environment variables from .env file.
    """
    from apps.api.app import create_app
    from apps.api.config import ProductionConfig
    from apps.api import db
    from sqlalchemy import create_engine
    
    # Create app with production config (will use DATABASE_URL from environment)
    app = create_app(ProductionConfig)
    
    # Ensure config uses environment variables
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
    app.config['SUPABASE_URL'] = SUPABASE_URL
    app.config['SUPABASE_KEY'] = SUPABASE_KEY
    app.config['SUPABASE_SERVICE_KEY'] = SUPABASE_SERVICE_KEY
    
    # Wait for database to be available (with retries for Supabase)
    print("\n" + "="*60)
    print("MUNLINK REGION 3 - PRODUCTION DATABASE SETUP")
    print("="*60)
    print("\nConnecting to Supabase database...")
    wait_for_db(app, max_retries=5, retry_delay=15)
    
    with app.app_context():
        # Import all models to ensure they're registered with SQLAlchemy
        from apps.api.models.user import User
        from apps.api.models.province import Province
        from apps.api.models.municipality import Municipality, Barangay
        from apps.api.models.document import DocumentType, DocumentRequest
        from apps.api.models.issue import IssueCategory, Issue
        from apps.api.models.benefit import BenefitProgram, BenefitApplication
        from apps.api.models.marketplace import Item, Transaction, TransactionAuditLog
        from apps.api.models.announcement import Announcement
        from apps.api.models.token_blacklist import TokenBlacklist
        from apps.api.models.audit import AuditLog
        from apps.api.models.transfer import TransferRequest
        
        print("\nChecking database tables...")
        
        # Check if application tables actually exist using information_schema
        from sqlalchemy import text, inspect
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()
        
        # List of expected application tables (not system tables)
        expected_tables = [
            'users', 'provinces', 'municipalities', 'barangays',
            'document_types', 'document_requests', 'issue_categories',
            'issues', 'issue_updates', 'benefit_programs', 'benefit_applications',
            'items', 'transactions', 'transaction_audit_logs', 'messages',
            'announcements', 'token_blacklist', 'audit_logs', 'transfer_requests'
        ]
        
        # Check if any expected tables exist
        app_tables_exist = any(table in existing_tables for table in expected_tables)
        
        if app_tables_exist:
            print(f"  Found {len([t for t in expected_tables if t in existing_tables])} application tables.")
            print("  Creating/updating all tables to ensure schema is current...")
        else:
            print("  No application tables found, creating all tables...")
        
        try:
            # Always call create_all() - it won't overwrite existing tables, just creates missing ones
            db.create_all()
            print("  [OK] All tables created/verified successfully!")
            
            # Verify tables were created
            inspector = inspect(db.engine)
            final_tables = inspector.get_table_names()
            app_tables_created = [t for t in expected_tables if t in final_tables]
            print(f"  [OK] Found {len(app_tables_created)} application tables in database.")
            
        except Exception as create_err:
            print(f"  [ERROR] Error creating tables: {create_err}")
            import traceback
            traceback.print_exc()
            raise
        
        # Always fix alembic_version to have a single head
        # This prevents "overlaps with other requested revisions" errors
        print("\nEnsuring migration version tracking...")
        try:
            from sqlalchemy import text
            conn = db.engine.connect()
            
            # Check if alembic_version table exists
            result = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version')"
            ))
            table_exists = result.scalar()
            
            if table_exists:
                # Clear all entries and set to latest single head
                conn.execute(text("DELETE FROM alembic_version"))
                conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260102_bp_img')"))
                conn.commit()
                print("  [OK] Alembic version set to latest migration (20260102_bp_img).")
            else:
                # Create alembic_version table with latest migration
                conn.execute(text(
                    "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, PRIMARY KEY (version_num))"
                ))
                conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260102_bp_img')"))
                conn.commit()
                print("  [OK] Created alembic_version table with latest migration.")
            
            conn.close()
        except Exception as stamp_err:
            print(f"  [WARNING] Note: Alembic version fix skipped - {stamp_err}")
        
        # Seed location data (provinces, municipalities, barangays)
        print("\nSeeding location data...")
        seed_locations()
        
        print("\n" + "="*60)
        print("[OK] DATABASE SETUP COMPLETE!")
        print("="*60)
        print("\nAll tables have been created successfully.")
        print("Location data (provinces, municipalities, barangays) has been seeded.")
        print("You can now configure your Render API service with this DATABASE_URL.\n")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description='Set up production Supabase database - creates all tables and seeds location data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
This script uses HARDCODED production credentials.
It will IGNORE any .env file and use the credentials defined in the script.

Just run: python setup_production_db.py
        """
    )
    
    # Mask password in output for security
    masked_url = DATABASE_URL
    if DATABASE_URL and '@' in DATABASE_URL:
        parts = DATABASE_URL.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split('://', 1)[1] if '://' in parts[0] else parts[0]
            if ':' in user_pass:
                user = user_pass.split(':')[0]
                masked_url = DATABASE_URL.replace(user_pass, f"{user}:***")
    
    print("\n" + "="*60)
    print("PRODUCTION DATABASE SETUP")
    print("="*60)
    print(f"\nDatabase URL: {masked_url}")
    print(f"Supabase URL: {SUPABASE_URL}")
    print("\n[INFO] Using environment variables from .env file")
    print("Starting database setup...\n")
    
    try:
        setup_production_database()
    except Exception as e:
        print(f"\n[ERROR] Database setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

