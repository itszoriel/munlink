"""
Comprehensive Database Connection Diagnostic
Run with: python scripts/diagnose_db_connection.py
"""
import os
import sys
import time
from pathlib import Path

# Load .env from project root
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / '.env')


def analyze_db_url(url):
    """Analyze the DATABASE_URL for potential issues"""
    print("\n[ANALYSIS] DATABASE_URL")
    print("-" * 50)
    
    if not url:
        print("[ERROR] DATABASE_URL is not set!")
        return None
    
    # Mask password for display
    if '@' in url:
        parts = url.split('@')
        creds = parts[0].rsplit(':', 1)
        masked = creds[0] + ':****@' + parts[1]
    else:
        masked = url
    
    print(f"URL: {masked}")
    
    # Check scheme
    if url.startswith('postgres://'):
        print("[WARN] Uses 'postgres://' - will be converted to 'postgresql://'")
    elif url.startswith('postgresql://'):
        print("[OK] Uses correct 'postgresql://' scheme")
    elif url.startswith('sqlite://'):
        print("[INFO] Using SQLite (local database)")
        return None
    
    # Check for Supabase pooler vs direct
    if ':6543' in url or 'pooler.supabase.com' in url:
        print("[OK] Using Supabase Transaction Pooler (port 6543) - RECOMMENDED")
        return 'pooler'
    elif ':5432' in url:
        print("[WARN] Using Direct Connection (port 5432)")
        print("   -> May have IPv6/IPv4 issues from some cloud providers")
        print("   -> Consider switching to pooler (port 6543)")
        return 'direct'
    else:
        print("[?] Could not determine connection type")
        return 'unknown'


def test_basic_connection(url, timeout=30):
    """Test basic psycopg2 connection"""
    print("\n[TEST] Basic Connection")
    print("-" * 50)
    
    try:
        import psycopg2
    except ImportError:
        print("[ERROR] psycopg2 not installed. Run: pip install psycopg2-binary")
        return False
    
    start = time.time()
    try:
        print(f"Connecting (timeout: {timeout}s)...")
        
        # Convert postgres:// to postgresql://
        if url.startswith('postgres://'):
            url = url.replace('postgres://', 'postgresql://', 1)
        
        conn = psycopg2.connect(url, connect_timeout=timeout)
        elapsed = time.time() - start
        
        cursor = conn.cursor()
        cursor.execute("SELECT 1;")
        cursor.fetchone()
        
        print(f"[OK] Connected in {elapsed:.2f}s")
        
        # Get PostgreSQL version
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"   PostgreSQL: {version[:60]}...")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        elapsed = time.time() - start
        print(f"[ERROR] Failed after {elapsed:.2f}s: {e}")
        return False


def test_connection_stability(url, iterations=5):
    """Test multiple connections in sequence"""
    print(f"\n[TEST] Connection Stability ({iterations} iterations)")
    print("-" * 50)
    
    try:
        import psycopg2
    except ImportError:
        return
    
    # Convert postgres:// to postgresql://
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    
    successes = 0
    failures = 0
    times = []
    
    for i in range(iterations):
        start = time.time()
        try:
            conn = psycopg2.connect(url, connect_timeout=10)
            cursor = conn.cursor()
            cursor.execute("SELECT 1;")
            cursor.fetchone()
            cursor.close()
            conn.close()
            
            elapsed = time.time() - start
            times.append(elapsed)
            successes += 1
            print(f"  [{i+1}/{iterations}] OK - {elapsed:.2f}s")
            
        except Exception as e:
            failures += 1
            elapsed = time.time() - start
            print(f"  [{i+1}/{iterations}] FAIL - {elapsed:.2f}s - {str(e)[:50]}")
        
        # Small delay between connections
        time.sleep(0.5)
    
    print("-" * 50)
    print(f"Results: {successes} success, {failures} failures")
    if times:
        avg = sum(times) / len(times)
        print(f"Average connection time: {avg:.2f}s")
        if avg > 5:
            print("[CRITICAL] Very slow connections (>5s average) - likely network issues")
        elif avg > 2:
            print("[WARN] Slow connections detected (>2s average)")
        else:
            print("[OK] Connection times are acceptable")


def test_sqlalchemy_connection():
    """Test SQLAlchemy connection with your actual config"""
    print("\n[TEST] SQLAlchemy Connection (your config)")
    print("-" * 50)
    
    try:
        sys.path.insert(0, str(project_root / 'apps' / 'api'))
        from config import Config
        
        print(f"Engine options: {list(Config.SQLALCHEMY_ENGINE_OPTIONS.keys())}")
        
        from sqlalchemy import create_engine, text
        
        start = time.time()
        engine = create_engine(
            Config.SQLALCHEMY_DATABASE_URI,
            **Config.SQLALCHEMY_ENGINE_OPTIONS
        )
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1;"))
            result.fetchone()
        
        elapsed = time.time() - start
        print(f"[OK] SQLAlchemy connected in {elapsed:.2f}s")
        
        # Test a real query
        start = time.time()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM users;"))
            count = result.fetchone()[0]
        elapsed = time.time() - start
        print(f"[OK] Query 'SELECT COUNT(*) FROM users' returned {count} in {elapsed:.2f}s")
        
        engine.dispose()
        return True
        
    except Exception as e:
        print(f"[ERROR] SQLAlchemy connection failed: {e}")
        return False


def check_supabase_status():
    """Check if Supabase project might be paused"""
    print("\n[TEST] Supabase Project Status")
    print("-" * 50)
    
    supabase_url = os.getenv('SUPABASE_URL', '')
    if not supabase_url:
        print("[WARN] SUPABASE_URL not set - skipping status check")
        return
    
    print(f"Supabase URL: {supabase_url}")
    
    try:
        import requests
        # Try to reach the Supabase REST API
        response = requests.get(f"{supabase_url}/rest/v1/", timeout=10, headers={
            'apikey': os.getenv('SUPABASE_KEY', ''),
        })
        if response.status_code == 200:
            print("[OK] Supabase REST API is reachable")
        elif response.status_code == 401:
            print("[OK] Supabase REST API responded (auth required)")
        else:
            print(f"[WARN] Supabase returned status {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Could not reach Supabase: {e}")
        print("   -> Your Supabase project might be paused!")
        print("   -> Check: https://supabase.com/dashboard")


def main():
    print("=" * 60)
    print("MunLink Database Connection Diagnostic")
    print("=" * 60)
    
    db_url = os.getenv('DATABASE_URL')
    
    # Step 1: Analyze URL
    conn_type = analyze_db_url(db_url)
    
    if not db_url or 'sqlite' in db_url.lower():
        print("\n[WARN] No PostgreSQL DATABASE_URL configured")
        print("   Set DATABASE_URL in your .env file")
        return
    
    # Step 2: Check Supabase status
    check_supabase_status()
    
    # Step 3: Test basic connection
    basic_ok = test_basic_connection(db_url)
    
    if basic_ok:
        # Step 4: Test stability
        test_connection_stability(db_url, iterations=5)
        
        # Step 5: Test SQLAlchemy
        test_sqlalchemy_connection()
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary & Recommendations")
    print("=" * 60)
    
    if not basic_ok:
        print("""
[ERROR] Database connection failed. Try these fixes:

1. Check if your Supabase project is paused:
   -> https://supabase.com/dashboard
   -> If paused, restart it

2. Verify DATABASE_URL format in .env:
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

3. Make sure you're using the TRANSACTION POOLER (port 6543):
   -> In Supabase Dashboard -> Settings -> Database
   -> Copy the "Transaction pooler" connection string

4. Check your Supabase project region matches 'ap-southeast-1' (Singapore)
        """)
    else:
        if conn_type == 'direct':
            print("""
[WARN] You're using direct connection (port 5432).
    This may cause timeout issues from some cloud providers.
    
    -> Switch to Transaction Pooler (port 6543) in Supabase Dashboard
    -> Go to: Settings -> Database -> Connection string -> Transaction pooler
            """)
        else:
            print("""
[OK] Connection looks healthy!

If you're still seeing intermittent timeouts in production:
1. Check Render's logs for specific error messages
2. Monitor Supabase Dashboard -> Database -> Connection Pooler stats
3. Consider if your queries are too slow (check slow query log)
            """)


if __name__ == "__main__":
    main()
