"""Quick script to list all tables in the database."""
import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from sqlalchemy import inspect, text

# HARDCODED PRODUCTION CREDENTIALS
database_url = "postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
SUPABASE_MCP_URL = "https://mcp.supabase.com/mcp?project_ref=xzkhavrjfaxsqxyptbgm"
os.environ['DATABASE_URL'] = database_url

app = create_app(ProductionConfig)

with app.app_context():
    from apps.api import db
    
    inspector = inspect(db.engine)
    all_tables = inspector.get_table_names()
    
    print(f"\nTotal tables found: {len(all_tables)}\n")
    print("All tables in database:")
    print("-" * 60)
    for table in sorted(all_tables):
        print(f"  - {table}")
    
    # Check for application tables
    expected_tables = [
        'users', 'provinces', 'municipalities', 'barangays',
        'document_types', 'document_requests', 'issue_categories',
        'issues', 'issue_updates', 'benefit_programs', 'benefit_applications',
        'items', 'transactions', 'transaction_audit_logs', 'messages',
        'announcements', 'token_blacklist', 'audit_logs', 'transfer_requests'
    ]
    
    print("\n" + "-" * 60)
    print("Application tables status:")
    print("-" * 60)
    for table in expected_tables:
        status = "[OK]" if table in all_tables else "[MISSING]"
        print(f"  {status} {table}")
    
    print("\n")

