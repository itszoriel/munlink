"""
Clear all data from database except documents and programs (benefit_programs),
then repopulate locations and admin users.
"""
import sys
import os
from datetime import datetime, date
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

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required. Please set it in .env file.")

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from apps.api import db
from apps.api.models.user import User
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.document import DocumentType, DocumentRequest
from apps.api.models.issue import IssueCategory, Issue
from apps.api.models.benefit import BenefitProgram, BenefitApplication
from apps.api.models.marketplace import Item, Transaction
from apps.api.models.announcement import Announcement
from apps.api.models.token_blacklist import TokenBlacklist
from apps.api.models.audit import AuditLog
from apps.api.scripts.seed_data import seed_provinces, seed_municipalities, get_slug
from sqlalchemy import text
import bcrypt

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("CLEARING DATABASE AND REPOPULATING LOCATIONS & ADMINS")
print("="*70)
print("\n[WARNING] This will delete ALL data including:")
print("  - Document Types (document_types)")
print("  - Document Requests (document_requests)")
print("  - Benefit Programs (benefit_programs)")
print("\nAll data will be deleted! Only locations and admins will be repopulated.")

with app.app_context():
    try:
        # Step 1: Delete data in correct order (respecting foreign keys)
        print("\n" + "="*70)
        print("[STEP 1] DELETING DATA (except documents and programs)")
        print("="*70)
        
        # Delete in order to respect foreign key constraints
        # Start with tables that have foreign keys to other tables
        
        # 1. Delete audit logs (references users, municipalities)
        print("\n[1.1] Deleting audit logs...")
        deleted = AuditLog.query.delete()
        print(f"  [OK] Deleted {deleted} audit log entries")
        
        # 2. Delete issues (references users, municipalities, issue_categories)
        print("\n[1.2] Deleting issues...")
        deleted = Issue.query.delete()
        print(f"  [OK] Deleted {deleted} issues")
        
        # 3. Delete issue categories
        print("\n[1.3] Deleting issue categories...")
        deleted = IssueCategory.query.delete()
        print(f"  [OK] Deleted {deleted} issue categories")
        
        # 4. Delete benefit applications (references benefit_programs, users)
        print("\n[1.4] Deleting benefit applications...")
        deleted = BenefitApplication.query.delete()
        print(f"  [OK] Deleted {deleted} benefit applications")
        
        # 5.1. Delete benefit programs
        print("\n[1.5.1] Deleting benefit programs...")
        deleted = BenefitProgram.query.delete()
        print(f"  [OK] Deleted {deleted} benefit programs")
        
        # 5.2. Delete document requests (references document_types, users)
        print("\n[1.5.2] Deleting document requests...")
        deleted = DocumentRequest.query.delete()
        print(f"  [OK] Deleted {deleted} document requests")
        
        # 4.3. Delete document types
        print("\n[1.4.3] Deleting document types...")
        deleted = DocumentType.query.delete()
        print(f"  [OK] Deleted {deleted} document types")
        
        # 5. Delete transactions (references items, users)
        print("\n[1.5] Deleting transactions...")
        deleted = Transaction.query.delete()
        print(f"  [OK] Deleted {deleted} transactions")
        
        # 8. Delete items (references users, municipalities, barangays)
        print("\n[1.8] Deleting marketplace items...")
        deleted = Item.query.delete()
        print(f"  [OK] Deleted {deleted} items")
        
        # 9. Delete announcements (references users, municipalities)
        print("\n[1.9] Deleting announcements...")
        deleted = Announcement.query.delete()
        print(f"  [OK] Deleted {deleted} announcements")
        
        # 10. Delete token blacklist
        print("\n[1.10] Deleting token blacklist...")
        deleted = TokenBlacklist.query.delete()
        print(f"  [OK] Deleted {deleted} blacklisted tokens")
        
        # 11. Delete all users EXCEPT those that are municipal admins
        # We'll delete residents and public users, but keep admins temporarily
        # Actually, let's delete ALL users - we'll recreate admins later
        print("\n[1.11] Deleting all users (admins will be recreated)...")
        deleted = User.query.delete()
        print(f"  [OK] Deleted {deleted} users")
        
        # 12. Delete barangays (references municipalities)
        print("\n[1.13] Deleting barangays...")
        deleted = Barangay.query.delete()
        print(f"  [OK] Deleted {deleted} barangays")
        
        # 14. Delete municipalities (references provinces)
        print("\n[1.14] Deleting municipalities...")
        deleted = Municipality.query.delete()
        print(f"  [OK] Deleted {deleted} municipalities")
        
        # 15. Delete provinces
        print("\n[1.15] Deleting provinces...")
        deleted = Province.query.delete()
        print(f"  [OK] Deleted {deleted} provinces")
        
        # Commit deletions
        db.session.commit()
        print("\n[OK] All deletions committed successfully!")
        
        # Step 2: Repopulate locations
        print("\n" + "="*70)
        print("[STEP 2] REPOPULATING LOCATIONS")
        print("="*70)
        
        try:
            seed_provinces()
            seed_municipalities()
            print("\n[OK] Locations (provinces, municipalities, barangays) seeded successfully!")
            
        except Exception as e:
            print(f"\n[ERROR] Location seeding failed: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()
            raise
        
        # Step 3: Create admin users
        print("\n" + "="*70)
        print("[STEP 3] CREATING ADMIN USERS")
        print("="*70)
        
        municipalities = Municipality.query.filter_by(is_active=True).order_by(Municipality.name).all()
        print(f"\nFound {len(municipalities)} municipalities")
        
        credentials = []
        created_count = 0
        
        for municipality in municipalities:
            # Generate credentials based on municipality slug
            mun_slug = municipality.slug
            username = f"{mun_slug.replace('-', '')}_admin"
            password = f"{mun_slug.replace('-', '')}@Munlink2026"
            email = f"{mun_slug.replace('-', '')}.munlink@gmail.com"
            
            try:
                # Hash password
                password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                # Create admin user
                admin_user = User(
                    username=username,
                    email=email,
                    password_hash=password_hash,
                    first_name='Admin',
                    last_name=municipality.name,
                    date_of_birth=date(1990, 1, 1),
                    role='municipal_admin',
                    admin_municipality_id=municipality.id,
                    municipality_id=municipality.id,
                    email_verified=True,
                    admin_verified=True,
            email_verified_at=datetime.now(),
            admin_verified_at=datetime.now(),
                    is_active=True
                )
                
                db.session.add(admin_user)
                print(f"  [OK] {municipality.name}")
                created_count += 1
                
                credentials.append({
                    'province': municipality.province.name if municipality.province else 'N/A',
                    'municipality': municipality.name,
                    'username': username,
                    'password': password,
                    'email': email
                })
            except Exception as e:
                print(f"  [ERROR] {municipality.name} - Failed: {e}")
                db.session.rollback()
                continue
        
        # Commit admin users
        db.session.commit()
        print(f"\n[OK] Created {created_count} admin users")
        
        # Step 4: Summary
        print("\n" + "="*70)
        print("SUMMARY")
        print("="*70)
        print(f"  Locations seeded: {Province.query.count()} provinces, {Municipality.query.count()} municipalities")
        print(f"  Admin users created: {created_count}")
        print(f"  Document types: {DocumentType.query.count()}")
        print(f"  Document requests: {DocumentRequest.query.count()}")
        print(f"  Benefit programs: {BenefitProgram.query.count()}")
        
        # Save credentials to file
        output_file = Path(project_root) / 'admin_credentials.txt'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("="*80 + "\n")
            f.write("MUNLINK REGION 3 - ADMIN CREDENTIALS\n")
            f.write("="*80 + "\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total municipalities: {len(municipalities)}\n")
            f.write(f"Created: {created_count}\n\n")
            f.write("="*80 + "\n")
            f.write("CREDENTIALS\n")
            f.write("="*80 + "\n\n")
            f.write("Format: Province | Municipality | Username | Password | Email\n")
            f.write("-" * 80 + "\n\n")
            
            for cred in credentials:
                f.write(f"{cred['province']:20s} | {cred['municipality']:30s} | {cred['username']:30s} | {cred['password']:30s} | {cred['email']}\n")
        
        print(f"\n[OK] Credentials saved to: {output_file}")
        
        print("\n" + "="*70)
        print("COMPLETE!")
        print("="*70)
        print("\nDatabase cleared and repopulated successfully!")
        print("All data has been deleted. Only locations and admin users have been repopulated.\n")
        
    except Exception as e:
        print(f"\n[ERROR] Operation failed: {e}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        raise

