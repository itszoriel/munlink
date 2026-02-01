"""
Fix municipality slugs that contain special characters (ñ, etc.)
Run this script to update slugs in the database to ASCII-safe versions.
"""
import sys
import os
from pathlib import Path

# Ensure project root is importable
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import unicodedata
import psycopg2
from urllib.parse import urlparse

def normalize_slug(name: str) -> str:
    """Convert name to ASCII-safe URL-friendly slug."""
    # Normalize unicode characters (ñ -> n, etc.)
    normalized = unicodedata.normalize('NFKD', name)
    ascii_name = normalized.encode('ASCII', 'ignore').decode('ASCII')
    # Convert to slug
    slug = ascii_name.lower().replace(' ', '-').replace("'", '').replace('(', '').replace(')', '').replace('.', '').replace(',', '')
    return slug

def fix_slugs_in_database(database_url: str, db_name: str):
    """Fix municipality slugs in the given database."""
    print(f"\n{'='*60}")
    print(f"Fixing slugs in: {db_name}")
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
        return
    
    # Municipalities that need slug fixes (have special characters)
    municipalities_to_fix = [
        ("Doña Remedios Trinidad", "dona-remedios-trinidad"),
        ("Science City of Muñoz", "science-city-of-munoz"),
        ("Peñaranda", "penaranda"),
    ]
    
    try:
        for original_name, correct_slug in municipalities_to_fix:
            # First, check if municipality exists by name
            cursor.execute(
                "SELECT id, name, slug FROM municipalities WHERE name = %s",
                (original_name,)
            )
            row = cursor.fetchone()
            
            if row:
                mun_id, name, current_slug = row
                if current_slug != correct_slug:
                    print(f"  Updating: {name}")
                    print(f"    Old slug: {current_slug}")
                    print(f"    New slug: {correct_slug}")
                    
                    cursor.execute(
                        "UPDATE municipalities SET slug = %s WHERE id = %s",
                        (correct_slug, mun_id)
                    )
                    print(f"    [OK] Updated!")
                else:
                    print(f"  {name} - slug already correct: {current_slug}")
            else:
                print(f"  [WARN] Municipality not found: {original_name}")
        
        # Commit changes
        conn.commit()
        print(f"\n[OK] All changes committed to {db_name}")
        
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Failed to update: {e}")
        raise
    finally:
        cursor.close()
        conn.close()
        print(f"[OK] Connection closed")

def main():
    print("\n" + "="*60)
    print("MUNICIPALITY SLUG FIX SCRIPT")
    print("Fixes special characters in slugs (ñ -> n, etc.)")
    print("="*60)
    
    # Database URLs - you can also set these as environment variables
    DEV_DATABASE_URL = os.getenv(
        'DEV_DATABASE_URL',
        'postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
    )
    
    PROD_DATABASE_URL = os.getenv(
        'PROD_DATABASE_URL', 
        'postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
    )
    
    # Fix DEV database
    try:
        fix_slugs_in_database(DEV_DATABASE_URL, "munlink-dev")
    except Exception as e:
        print(f"[ERROR] Dev database fix failed: {e}")
    
    # Fix PROD database
    try:
        fix_slugs_in_database(PROD_DATABASE_URL, "munlink-prod")
    except Exception as e:
        print(f"[ERROR] Prod database fix failed: {e}")
    
    print("\n" + "="*60)
    print("DONE!")
    print("="*60 + "\n")

if __name__ == '__main__':
    main()

