"""
Enable Row Level Security (RLS) on refresh token tables.
These tables should only be accessed by the backend service, not directly by clients.
"""
import sys
import os
from pathlib import Path

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import psycopg2
from urllib.parse import urlparse

# SQL to enable RLS and create policies
ENABLE_RLS_SQL = """
-- Enable RLS on refresh_token_families
ALTER TABLE refresh_token_families ENABLE ROW LEVEL SECURITY;

-- Enable RLS on refresh_tokens  
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (extra security)
ALTER TABLE refresh_token_families FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

-- Create policy: Only service role (backend) can access refresh_token_families
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role only" ON refresh_token_families;
CREATE POLICY "Service role only" ON refresh_token_families
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Create policy: Only service role (backend) can access refresh_tokens
DROP POLICY IF EXISTS "Service role only" ON refresh_tokens;
CREATE POLICY "Service role only" ON refresh_tokens
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Note: The backend connects via DATABASE_URL which bypasses RLS
-- These policies block direct access via Supabase client (anon key)
"""

def fix_rls_in_database(database_url: str, db_name: str):
    """Enable RLS on refresh token tables."""
    print(f"\n{'='*60}")
    print(f"Enabling RLS: {db_name}")
    print(f"{'='*60}")
    
    parsed = urlparse(database_url)
    
    try:
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            sslmode='require'
        )
        conn.autocommit = False
        cursor = conn.cursor()
        print(f"[OK] Connected to database")
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        return False
    
    try:
        # Execute RLS commands
        print("[INFO] Enabling RLS on tables...")
        cursor.execute(ENABLE_RLS_SQL)
        
        # Verify RLS is enabled
        cursor.execute("""
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('refresh_token_families', 'refresh_tokens')
        """)
        results = cursor.fetchall()
        
        for table, rls_enabled in results:
            status = "[OK] RLS ENABLED" if rls_enabled else "[WARN] RLS NOT ENABLED"
            print(f"  {table}: {status}")
        
        # Check policies exist
        cursor.execute("""
            SELECT tablename, policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename IN ('refresh_token_families', 'refresh_tokens')
        """)
        policies = cursor.fetchall()
        
        print(f"\n[INFO] Policies created:")
        for table, policy in policies:
            print(f"  {table}: {policy}")
        
        conn.commit()
        print(f"\n[OK] RLS enabled successfully for {db_name}!")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Failed: {e}")
        return False
    finally:
        cursor.close()
        conn.close()
        print(f"[OK] Connection closed")


def main():
    print("\n" + "="*60)
    print("ENABLE ROW LEVEL SECURITY ON REFRESH TOKEN TABLES")
    print("="*60)
    
    DEV_DATABASE_URL = os.getenv(
        'DEV_DATABASE_URL',
        'postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
    )
    
    PROD_DATABASE_URL = os.getenv(
        'PROD_DATABASE_URL', 
        'postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
    )
    
    results = {}
    results['dev'] = fix_rls_in_database(DEV_DATABASE_URL, "munlink-dev")
    results['prod'] = fix_rls_in_database(PROD_DATABASE_URL, "munlink-prod")
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for db, success in results.items():
        status = "[OK] SUCCESS" if success else "[X] FAILED"
        print(f"  {db}: {status}")
    print("="*60 + "\n")
    
    return all(results.values())


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

