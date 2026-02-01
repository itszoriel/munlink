
"""
Check and create alembic_version table if missing.
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
print("CHECKING ALEMBIC_VERSION TABLE")
print("="*60)

with engine.connect() as conn:
    # Check if alembic_version table exists
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'alembic_version'
        )
    """))
    exists = result.scalar()
    
    if exists:
        print("\n[OK] alembic_version table exists")
        
        # Check its contents
        result = conn.execute(text("SELECT * FROM alembic_version"))
        rows = result.fetchall()
        print(f"[INFO] Rows in alembic_version: {len(rows)}")
        for row in rows:
            print(f"  - version_num: {row[0]}")
    else:
        print("\n[WARNING] alembic_version table does NOT exist")
        print("[INFO] Creating alembic_version table...")
        
        try:
            # Create the table
            conn.execute(text("""
                CREATE TABLE alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    PRIMARY KEY (version_num)
                )
            """))
            
            # Insert the latest migration version
            conn.execute(text("""
                INSERT INTO alembic_version (version_num) 
                VALUES ('20260102_bp_img')
            """))
            
            conn.commit()
            print("[OK] alembic_version table created successfully!")
            print("[OK] Set version to: 20260102_bp_img")
        except Exception as e:
            print(f"[ERROR] Failed to create alembic_version table: {e}")
            conn.rollback()
            import traceback
            traceback.print_exc()
    
    # List all tables including alembic_version
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """))
    all_tables = [row[0] for row in result]
    
    print(f"\n[INFO] All tables in 'public' schema ({len(all_tables)} total):")
    for table in all_tables:
        marker = " <-- ALEMBIC" if table == 'alembic_version' else ""
        print(f"  - {table}{marker}")

print("\n" + "="*60)
print("CHECK COMPLETE")
print("="*60 + "\n")

