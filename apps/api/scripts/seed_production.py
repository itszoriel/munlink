"""
Seed production Supabase database with required data.
Run this locally with production DATABASE_URL to seed provinces, municipalities, etc.

Usage:
  1. Set your Supabase DATABASE_URL environment variable:
     $env:DATABASE_URL = "postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
  
  2. Run this script:
     python apps/api/scripts/seed_production.py
"""
import sys
import os

# Ensure project root is importable
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def check_database_url():
    """Verify DATABASE_URL is set and looks like a Supabase/PostgreSQL URL."""
    db_url = os.getenv('DATABASE_URL', '')
    
    if not db_url:
        print("ERROR: DATABASE_URL environment variable is not set!")
        print("\nTo seed production, set your Supabase DATABASE_URL:")
        print("  PowerShell: $env:DATABASE_URL = 'postgresql://...'")
        print("  Bash: export DATABASE_URL='postgresql://...'")
        print("\nYou can find this in Supabase Dashboard > Settings > Database > Connection string (Transaction pooler)")
        return False
    
    if 'supabase' in db_url.lower() or 'postgresql' in db_url.lower() or 'postgres://' in db_url.lower():
        print(f"Database URL detected (production)")
        return True
    
    if 'sqlite' in db_url.lower():
        print("WARNING: You're using SQLite (local). Make sure this is intentional.")
        response = input("Continue with SQLite? (y/N): ").strip().lower()
        return response == 'y'
    
    return True


def seed_production():
    """Seed the production database."""
    print("\n" + "="*60)
    print("MUNLINK REGION 3 - PRODUCTION DATABASE SEEDING")
    print("="*60 + "\n")
    
    if not check_database_url():
        return
    
    from apps.api.app import create_app
    from apps.api import db
    from sqlalchemy import text
    
    app = create_app()
    
    with app.app_context():
        # Test connection
        print("Testing database connection...")
        try:
            result = db.session.execute(text("SELECT 1"))
            db.session.commit()
            print("  ✓ Database connection successful!\n")
        except Exception as e:
            print(f"  ✗ Database connection failed: {e}")
            return
        
        # Check current state
        print("Checking current database state...")
        from apps.api.models.province import Province
        from apps.api.models.municipality import Municipality, Barangay
        from apps.api.models.document import DocumentType
        from apps.api.models.issue import IssueCategory
        
        province_count = Province.query.count()
        municipality_count = Municipality.query.count()
        barangay_count = Barangay.query.count()
        doctype_count = DocumentType.query.count()
        category_count = IssueCategory.query.count()
        
        print(f"  - Provinces: {province_count}")
        print(f"  - Municipalities: {municipality_count}")
        print(f"  - Barangays: {barangay_count}")
        print(f"  - Document Types: {doctype_count}")
        print(f"  - Issue Categories: {category_count}")
        print()
        
        if province_count > 0:
            print("Data already exists! Listing provinces:")
            for p in Province.query.all():
                mun_count = Municipality.query.filter_by(province_id=p.id).count()
                print(f"  - {p.name} ({mun_count} municipalities, active={p.is_active})")
            
            reseed = input("\nDo you want to reseed? This will skip existing records. (y/N): ").strip().lower()
            if reseed != 'y':
                print("Aborted.")
                return
        
        # Run seeding
        print("\nStarting database seeding...")
        from apps.api.scripts.seed_data import (
            seed_provinces,
            seed_municipalities,
            seed_document_types,
            seed_issue_categories
        )
        
        try:
            print("\n[1/4] Seeding provinces...")
            seed_provinces()
            
            print("[2/4] Seeding municipalities and barangays...")
            seed_municipalities()
            
            print("[3/4] Seeding document types...")
            seed_document_types()
            
            print("[4/4] Seeding issue categories...")
            seed_issue_categories()
            
            # Final verification
            print("\n" + "-"*40)
            print("VERIFICATION - Final counts:")
            print("-"*40)
            print(f"  Provinces: {Province.query.count()}")
            print(f"  Municipalities: {Municipality.query.count()}")
            print(f"  Barangays: {Barangay.query.count()}")
            print(f"  Document Types: {DocumentType.query.count()}")
            print(f"  Issue Categories: {IssueCategory.query.count()}")
            
            print("\n" + "="*60)
            print("✓ SEEDING COMPLETE!")
            print("="*60)
            print("\nYour registration form should now load provinces correctly.")
            print("Refresh the page: https://munlink-web-y9lj.onrender.com/register")
            
        except Exception as e:
            print(f"\n✗ ERROR during seeding: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()


if __name__ == '__main__':
    seed_production()

