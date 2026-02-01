"""
Enable Row Level Security (RLS) on all tables in the public schema.
This fixes the Security Advisor warnings.
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

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

from sqlalchemy import text, create_engine
from apps.api.config import get_engine_options

engine = create_engine(DATABASE_URL, **get_engine_options())

print("\n" + "="*60)
print("ENABLING ROW LEVEL SECURITY (RLS) ON ALL TABLES")
print("="*60)

with engine.connect() as conn:
    # Get all tables in public schema
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """))
    tables = [row[0] for row in result]
    
    print(f"\n[INFO] Found {len(tables)} tables to enable RLS on")
    
    enabled_count = 0
    already_enabled_count = 0
    failed_count = 0
    
    for table in tables:
        try:
            # Check if RLS is already enabled
            result = conn.execute(text(f"""
                SELECT relname, relrowsecurity 
                FROM pg_class 
                WHERE relname = '{table}' 
                AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            """))
            row = result.fetchone()
            
            if row and row[1]:  # relrowsecurity is True
                print(f"  [SKIP] {table} - RLS already enabled")
                already_enabled_count += 1
            else:
                # Enable RLS
                conn.execute(text(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY"))
                conn.commit()
                print(f"  [OK] {table} - RLS enabled")
                enabled_count += 1
        except Exception as e:
            print(f"  [ERROR] {table} - Failed to enable RLS: {e}")
            conn.rollback()
            failed_count += 1
    
    print("\n" + "="*60)
    print("RLS ENABLEMENT SUMMARY")
    print("="*60)
    print(f"  Total tables: {len(tables)}")
    print(f"  Enabled: {enabled_count}")
    print(f"  Already enabled: {already_enabled_count}")
    print(f"  Failed: {failed_count}")
    
    # Verify RLS status
    print("\n[INFO] Verifying RLS status on all tables...")
    result = conn.execute(text("""
        SELECT 
            c.relname as table_name,
            c.relrowsecurity as rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        ORDER BY c.relname
    """))
    
    print("\nRLS Status:")
    print("-" * 60)
    for row in result:
        status = "ENABLED" if row[1] else "DISABLED"
        marker = " [OK]" if row[1] else " [DISABLED]"
        print(f"  {status}{marker} {row[0]}")

print("\n" + "="*60)
print("RLS ENABLEMENT COMPLETE")
print("="*60)
print("\nNote: After enabling RLS, you may need to create policies")
print("to allow access to the tables. Without policies, tables will")
print("be inaccessible even to authenticated users.\n")

