"""
Grant necessary permissions to Supabase roles so dashboard can see tables.
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

engine = create_engine(DATABASE_URL, **get_engine_options())

print("\n" + "="*60)
print("GRANTING PERMISSIONS TO SUPABASE ROLES")
print("="*60)

# Get list of all tables
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """))
    tables = [row[0] for row in result]
    
    print(f"\n[INFO] Found {len(tables)} tables to grant permissions on")
    
    # Grant permissions to anon and authenticated roles
    roles = ['anon', 'authenticated', 'service_role']
    
    for role in roles:
        print(f"\n[INFO] Granting permissions to '{role}' role...")
        try:
            for table in tables:
                # Grant USAGE on schema
                conn.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
                
                # Grant SELECT, INSERT, UPDATE, DELETE on tables
                conn.execute(text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.{table} TO {role}"))
                
                # Grant USAGE, SELECT on sequences (for auto-increment IDs)
                conn.execute(text(f"""
                    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}
                """))
            
            # Grant default permissions for future tables
            conn.execute(text(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {role}"))
            conn.execute(text(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {role}"))
            
            conn.commit()
            print(f"  [OK] Permissions granted to '{role}' role")
        except Exception as e:
            print(f"  [WARNING] Could not grant permissions to '{role}': {e}")
            conn.rollback()
    
    # Also ensure postgres user has all permissions
    print(f"\n[INFO] Verifying postgres user permissions...")
    try:
        for table in tables:
            conn.execute(text(f"GRANT ALL PRIVILEGES ON TABLE public.{table} TO postgres"))
        conn.commit()
        print("  [OK] Postgres user permissions verified")
    except Exception as e:
        print(f"  [WARNING] Could not verify postgres permissions: {e}")
        conn.rollback()
    
    # Verify tables are still there
    result = conn.execute(text("""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    """))
    final_count = result.scalar()
    print(f"\n[OK] Final table count: {final_count} tables in 'public' schema")

print("\n" + "="*60)
print("PERMISSIONS GRANTED")
print("="*60)
print("\nPlease refresh your Supabase dashboard (hard refresh: Ctrl+F5)")
print("The tables should now be visible.\n")

