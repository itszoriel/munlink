"""
Analyze the impact of changing database IDs vs updating frontend IDs.
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Load environment variables from .env file
env_path = project_root / '.env'
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
from apps.api.models.user import User
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.document import DocumentRequest
from apps.api.models.marketplace import Item
from apps.api.models.issue import Issue
from apps.api.models.announcement import Announcement
from apps.api.models.benefit import BenefitProgram
from sqlalchemy import text

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("ANALYZING IMPACT: FRONTEND IDs vs DATABASE IDs")
print("="*70)

with app.app_context():
    from apps.api import db
    
    # Count records using municipality_id/barangay_id
    print("\n[ANALYSIS] Current database usage of location IDs:")
    print("-" * 70)
    
    # Users
    user_count = User.query.filter(User.municipality_id.isnot(None)).count()
    admin_count = User.query.filter(User.admin_municipality_id.isnot(None)).count()
    brgy_user_count = User.query.filter(User.barangay_id.isnot(None)).count()
    print(f"  Users with municipality_id: {user_count}")
    print(f"  Admin users with admin_municipality_id: {admin_count}")
    print(f"  Users with barangay_id: {brgy_user_count}")
    
    # Document Requests
    doc_count = db.session.execute(text("SELECT COUNT(*) FROM document_requests WHERE municipality_id IS NOT NULL")).scalar()
    print(f"  Document requests with municipality_id: {doc_count}")
    
    # Marketplace Items
    item_count = Item.query.filter(Item.municipality_id.isnot(None)).count()
    print(f"  Marketplace items with municipality_id: {item_count}")
    
    # Issues
    issue_count = Issue.query.filter(Issue.municipality_id.isnot(None)).count()
    print(f"  Issues with municipality_id: {issue_count}")
    
    # Announcements
    ann_count = Announcement.query.filter(Announcement.municipality_id.isnot(None)).count()
    print(f"  Announcements with municipality_id: {ann_count}")
    
    # Benefit Programs
    benefit_count = BenefitProgram.query.filter(BenefitProgram.municipality_id.isnot(None)).count()
    print(f"  Benefit programs with municipality_id: {benefit_count}")
    
    total_records = user_count + admin_count + doc_count + item_count + issue_count + ann_count + benefit_count
    
    print(f"\n  TOTAL records using location IDs: {total_records}")
    
    # Show sample of admin users we just created
    print("\n[EXAMPLE] Sample admin users (just created):")
    admins = User.query.filter(User.role == 'municipal_admin').limit(5).all()
    for admin in admins:
        mun = Municipality.query.get(admin.admin_municipality_id) if admin.admin_municipality_id else None
        print(f"  - {admin.username}: admin_municipality_id = {admin.admin_municipality_id} ({mun.name if mun else 'N/A'})")
    
    print("\n" + "="*70)
    print("RECOMMENDATION ANALYSIS")
    print("="*70)
    
    print("\n[OPTION 1] Use Frontend IDs (Change Database IDs)")
    print("  Pros:")
    print("    - Frontend IDs are already sequential (1-134)")
    print("    - No frontend code changes needed")
    print("  Cons:")
    print(f"    - Would need to update {total_records} existing database records")
    print("    - Would need to update ALL foreign key references:")
    print("      * users.municipality_id")
    print("      * users.barangay_id")
    print("      * users.admin_municipality_id")
    print("      * document_requests.municipality_id")
    print("      * items.municipality_id, items.barangay_id")
    print("      * issues.municipality_id")
    print("      * announcements.municipality_id")
    print("      * benefit_programs.municipality_id")
    print("      * barangays.municipality_id")
    print("    - RISK: High chance of data corruption")
    print("    - RISK: Breaking referential integrity")
    print("    - RISK: All 128 admin users would need ID updates")
    print("    - RISK: Any future data would be affected")
    print("    - Complexity: Very high (requires migration script)")
    
    print("\n[OPTION 2] Use Database IDs (Update Frontend)")
    print("  Pros:")
    print("    - Database IDs are the source of truth")
    print("    - No risk to existing data")
    print("    - No database changes needed")
    print("    - Simple: Just update locations.ts file")
    print("    - All existing records remain valid")
    print("    - All 128 admin users remain valid")
    print("  Cons:")
    print("    - Need to update locations.ts file")
    print("    - Frontend IDs won't be sequential (but that's OK)")
    
    print("\n" + "="*70)
    print("RECOMMENDATION")
    print("="*70)
    print("\n[RECOMMENDED] Use Database IDs (Update Frontend)")
    print("\nReasoning:")
    print("  1. Database IDs are already in use by {total_records} records")
    print("  2. Changing database IDs is HIGH RISK and could corrupt data")
    print("  3. Updating frontend is LOW RISK (just static data)")
    print("  4. Frontend IDs don't need to be sequential - they're just references")
    print("  5. Database is the source of truth for all data operations")
    print("\n" + "="*70 + "\n")

