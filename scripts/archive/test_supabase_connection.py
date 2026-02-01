"""
Quick script to test Supabase database connectivity.
Run with: python scripts/test_supabase_connection.py
"""
import os
import sys
from pathlib import Path

# Load .env from project root
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / '.env')

def test_connection():
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        print("[ERROR] DATABASE_URL not set in .env")
        return False
    
    # Mask password for display
    if '@' in db_url:
        parts = db_url.split('@')
        masked = parts[0].rsplit(':', 1)[0] + ':****@' + parts[1]
    else:
        masked = db_url
    
    print(f"Testing connection to: {masked}")
    print("-" * 50)
    
    try:
        import psycopg2
        print("Attempting connection (30 second timeout)...")
        
        conn = psycopg2.connect(db_url, connect_timeout=30)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        
        print(f"[OK] Connected successfully!")
        print(f"PostgreSQL version: {version[:50]}...")
        
        cursor.close()
        conn.close()
        return True
        
    except ImportError:
        print("[ERROR] psycopg2 not installed. Run: pip install psycopg2-binary")
        return False
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("Supabase Connection Test")
    print("=" * 50)
    
    success = test_connection()
    
    print("-" * 50)
    if not success:
        print("\nTroubleshooting steps:")
        print("1. Check if your Supabase project is paused (supabase.com/dashboard)")
        print("2. Verify DATABASE_URL format in .env")
        print("3. Try using port 5432 (direct) instead of 6543 (pooler)")
        print("4. Check your Supabase project's IP restrictions")
    
    sys.exit(0 if success else 1)

