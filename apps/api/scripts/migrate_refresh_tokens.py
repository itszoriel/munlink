"""
Migrate refresh token tables to both dev and prod databases.
Creates the refresh_token_families and refresh_tokens tables for token rotation.
"""
import sys
import os
from pathlib import Path

# Ensure project root is importable
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import psycopg2
from urllib.parse import urlparse

# SQL to create the refresh token tables
CREATE_TABLES_SQL = """
-- Refresh Token Families table
CREATE TABLE IF NOT EXISTS refresh_token_families (
    id SERIAL PRIMARY KEY,
    family_id VARCHAR(36) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    invalidated_reason VARCHAR(50),
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invalidated_at TIMESTAMP
);

-- Refresh Tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(36) UNIQUE NOT NULL,
    family_id INTEGER NOT NULL REFERENCES refresh_token_families(id) ON DELETE CASCADE,
    is_revoked BOOLEAN DEFAULT FALSE,
    is_used BOOLEAN DEFAULT FALSE,
    revoked_reason VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    revoked_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rtf_user ON refresh_token_families(user_id);
CREATE INDEX IF NOT EXISTS idx_rtf_family ON refresh_token_families(family_id);
CREATE INDEX IF NOT EXISTS idx_rtf_active ON refresh_token_families(is_active);
CREATE INDEX IF NOT EXISTS idx_rt_jti ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_rt_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_rt_expires ON refresh_tokens(expires_at);
"""

def migrate_database(database_url: str, db_name: str):
    """Run migration on the given database."""
    print(f"\n{'='*60}")
    print(f"Migrating: {db_name}")
    print(f"{'='*60}")
    
    # Parse the database URL
    parsed = urlparse(database_url)
    
    # Connect to database
    try:
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            database=parsed.path[1:],  # Remove leading '/'
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
        # Check if tables already exist
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('refresh_token_families', 'refresh_tokens')
        """)
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        if existing_tables:
            print(f"[INFO] Existing tables found: {existing_tables}")
        
        # Run the migration
        print("[INFO] Creating tables...")
        cursor.execute(CREATE_TABLES_SQL)
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('refresh_token_families', 'refresh_tokens')
            ORDER BY table_name
        """)
        created_tables = [row[0] for row in cursor.fetchall()]
        
        print(f"[OK] Tables verified: {created_tables}")
        
        # Check indexes
        cursor.execute("""
            SELECT indexname FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_rt%'
        """)
        indexes = [row[0] for row in cursor.fetchall()]
        print(f"[OK] Indexes created: {indexes}")
        
        # Commit the transaction
        conn.commit()
        print(f"\n[OK] Migration completed successfully for {db_name}!")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Migration failed: {e}")
        return False
    finally:
        cursor.close()
        conn.close()
        print(f"[OK] Connection closed")


def main():
    print("\n" + "="*60)
    print("REFRESH TOKEN TABLES MIGRATION")
    print("Creates tables for secure token rotation")
    print("="*60)
    
    # Database URLs
    DEV_DATABASE_URL = os.getenv(
        'DEV_DATABASE_URL',
        'postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
    )
    
    PROD_DATABASE_URL = os.getenv(
        'PROD_DATABASE_URL', 
        'postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
    )
    
    results = {}
    
    # Migrate DEV database
    results['dev'] = migrate_database(DEV_DATABASE_URL, "munlink-dev")
    
    # Migrate PROD database
    results['prod'] = migrate_database(PROD_DATABASE_URL, "munlink-prod")
    
    # Summary
    print("\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    for db, success in results.items():
        status = "[OK] SUCCESS" if success else "[X] FAILED"
        print(f"  {db}: {status}")
    
    print("="*60 + "\n")
    
    return all(results.values())


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

