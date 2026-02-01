"""
Directly verify tables exist by querying PostgreSQL system tables.
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

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from sqlalchemy import text, create_engine
from apps.api.config import get_engine_options

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

# Create direct connection
engine = create_engine(DATABASE_URL, **get_engine_options())

print("\n" + "="*60)
print("DIRECT DATABASE VERIFICATION")
print("="*60)

with engine.connect() as conn:
    # Check current database
    result = conn.execute(text("SELECT current_database()"))
    db_name = result.scalar()
    print(f"\n[INFO] Connected to database: {db_name}")
    
    # Check current schema
    result = conn.execute(text("SELECT current_schema()"))
    schema = result.scalar()
    print(f"[INFO] Current schema: {schema}")
    
    # Check current user
    result = conn.execute(text("SELECT current_user"))
    user = result.scalar()
    print(f"[INFO] Current user: {user}")
    
    # List ALL schemas
    result = conn.execute(text("""
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
    """))
    schemas = [row[0] for row in result]
    print(f"\n[INFO] Available schemas: {', '.join(schemas)}")
    
    # Count tables in public schema using information_schema
    result = conn.execute(text("""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    """))
    table_count = result.scalar()
    print(f"\n[INFO] Tables in 'public' schema (information_schema): {table_count}")
    
    # List all tables in public schema
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """))
    tables = [row[0] for row in result]
    print(f"\n[INFO] Table names in 'public' schema:")
    for table in tables:
        print(f"  - {table}")
    
    # Also check pg_tables (PostgreSQL system view)
    result = conn.execute(text("""
        SELECT COUNT(*) 
        FROM pg_tables 
        WHERE schemaname = 'public'
    """))
    pg_table_count = result.scalar()
    print(f"\n[INFO] Tables in 'public' schema (pg_tables): {pg_table_count}")
    
    # Check if we can query a specific table
    if 'users' in tables:
        try:
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            print(f"\n[OK] Can query 'users' table - row count: {user_count}")
        except Exception as e:
            print(f"\n[ERROR] Cannot query 'users' table: {e}")
    
    # Check table ownership
    result = conn.execute(text("""
        SELECT tablename, tableowner 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
        LIMIT 5
    """))
    print(f"\n[INFO] Sample table ownership:")
    for row in result:
        print(f"  - {row[0]} (owner: {row[1]})")

print("\n" + "="*60)
print("VERIFICATION COMPLETE")
print("="*60 + "\n")

