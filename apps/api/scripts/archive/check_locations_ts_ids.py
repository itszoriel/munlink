"""
Check if hardcoded IDs in locations.ts match production database IDs.
"""
import sys
import os
import json
import re
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Load environment variables from .env file
env_path = project_root / '.env'
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
from apps.api.models.municipality import Municipality
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("CHECKING locations.ts HARDCODED IDs vs PRODUCTION DATABASE")
print("="*70)

with app.app_context():
    # Get database IDs
    print("\n[STEP 1] Reading IDs from production database...")
    db_municipalities = {}
    municipalities = Municipality.query.filter_by(is_active=True).order_by(Municipality.id).all()
    for mun in municipalities:
        db_municipalities[mun.slug] = mun.id
    
    print(f"  Database: {len(db_municipalities)} municipalities")
    
    # Read locations.ts file
    locations_file = project_root / 'apps' / 'web' / 'src' / 'lib' / 'locations.ts'
    print(f"\n[STEP 2] Reading locations.ts file...")
    
    if not locations_file.exists():
        print(f"  [ERROR] locations.ts not found!")
        sys.exit(1)
    
    with open(locations_file, 'r', encoding='utf-8') as f:
        locations_content = f.read()
    
    # Extract hardcoded IDs from DB_MUNICIPALITY_IDS
    print("\n[STEP 3] Extracting hardcoded IDs from locations.ts...")
    id_pattern = r'"([^"]+)":\s*(\d+),?\s*(?://.*)?'
    matches = re.findall(id_pattern, locations_content)
    
    ts_municipalities = {}
    for slug, id_str in matches:
        # Only capture entries that look like municipality slugs (not comments)
        if slug and not slug.startswith('//'):
            try:
                ts_municipalities[slug] = int(id_str)
            except ValueError:
                pass
    
    print(f"  Found {len(ts_municipalities)} hardcoded municipality IDs in locations.ts")
    
    # Compare
    print("\n[STEP 4] Comparing IDs...")
    mismatches = []
    missing_in_ts = []
    missing_in_db = []
    extra_in_ts = []
    
    all_slugs = set(db_municipalities.keys()) | set(ts_municipalities.keys())
    
    for slug in sorted(all_slugs):
        db_id = db_municipalities.get(slug)
        ts_id = ts_municipalities.get(slug)
        
        if slug not in db_municipalities:
            if ts_id:
                extra_in_ts.append({'slug': slug, 'ts_id': ts_id})
        elif slug not in ts_municipalities:
            missing_in_ts.append({'slug': slug, 'name': Municipality.query.filter_by(slug=slug).first().name if Municipality.query.filter_by(slug=slug).first() else 'Unknown', 'db_id': db_id})
        elif db_id != ts_id:
            mun = Municipality.query.filter_by(slug=slug).first()
            mismatches.append({
                'slug': slug,
                'name': mun.name if mun else 'Unknown',
                'db_id': db_id,
                'ts_id': ts_id
            })
    
    # Report
    print(f"\n  Municipality ID Mismatches: {len(mismatches)}")
    if mismatches:
        print("  [MISMATCHES FOUND]:")
        for m in mismatches[:20]:
            print(f"    - {m['name']} ({m['slug']}): DB={m['db_id']}, locations.ts={m['ts_id']}")
        if len(mismatches) > 20:
            print(f"    ... and {len(mismatches) - 20} more")
    else:
        print("  [OK] All municipality IDs match!")
    
    if missing_in_ts:
        print(f"\n  Municipalities in DB but missing in locations.ts: {len(missing_in_ts)}")
        for m in missing_in_ts[:10]:
            print(f"    - {m['name']} ({m['slug']}): DB ID = {m['db_id']}")
    
    if extra_in_ts:
        print(f"\n  Municipalities in locations.ts but not in DB: {len(extra_in_ts)}")
        for m in extra_in_ts[:10]:
            print(f"    - {m['slug']}: locations.ts ID = {m['ts_id']}")
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total municipalities in database: {len(db_municipalities)}")
    print(f"Total municipalities in locations.ts: {len(ts_municipalities)}")
    print(f"ID Mismatches: {len(mismatches)}")
    print(f"Missing in locations.ts: {len(missing_in_ts)}")
    print(f"Extra in locations.ts: {len(extra_in_ts)}")
    
    total_issues = len(mismatches) + len(missing_in_ts) + len(extra_in_ts)
    
    if total_issues == 0:
        print("\n[OK] All IDs match perfectly! No updates needed.")
    else:
        print(f"\n[WARNING] Found {total_issues} issues.")
        print("Recommendation: Update locations.ts with correct IDs from database.")
    
    print("\n" + "="*70 + "\n")

