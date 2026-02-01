"""
Force create all tables in production Supabase database.
This script directly creates tables using SQLAlchemy.
"""
import sys
import os
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

# Create app
app = create_app(ProductionConfig)

# Override config to use our URL
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

with app.app_context():
    # Import all models to register them
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
    
    print("\n" + "="*60)
    print("FORCE CREATING ALL TABLES")
    print("="*60)
    print(f"\nDatabase URL: {DATABASE_URL.split('@')[1] if DATABASE_URL and '@' in DATABASE_URL else '***'}")
    print("\nCreating all tables...")
    
    try:
        # Force create all tables
        db.create_all()
        print("\n[OK] All tables created!")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        print(f"\n[OK] Found {len(tables)} tables in database:")
        for table in sorted(tables):
            print(f"  - {table}")
        
        # Check if we're in the right schema
        from sqlalchemy import text
        result = db.session.execute(text("SELECT current_schema()"))
        schema = result.scalar()
        print(f"\n[INFO] Current schema: {schema}")
        
        # List tables in public schema
        result = db.session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """))
        public_tables = [row[0] for row in result]
        print(f"\n[INFO] Tables in 'public' schema: {len(public_tables)}")
        for table in public_tables:
            print(f"  - {table}")
        
        print("\n" + "="*60)
        print("[OK] TABLE CREATION COMPLETE!")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n[ERROR] Failed to create tables: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

