"""
Verify if municipality and barangay IDs match between production database
and static JSON files used by the frontend.
"""
import sys
import os
import json
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
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("VERIFYING ID MATCHING: DATABASE vs STATIC JSON FILES")
print("="*70)

with app.app_context():
    # Get database IDs
    print("\n[STEP 1] Reading IDs from production database...")
    db_municipalities = {}
    municipalities = Municipality.query.filter_by(is_active=True).order_by(Municipality.id).all()
    for mun in municipalities:
        db_municipalities[mun.slug] = {
            'id': mun.id,
            'name': mun.name,
            'province_id': mun.province_id
        }
    
    db_barangays = {}
    for mun in municipalities:
        barangays = Barangay.query.filter_by(
            municipality_id=mun.id,
            is_active=True
        ).order_by(Barangay.id).all()
        db_barangays[mun.slug] = [
            {'id': brgy.id, 'name': brgy.name, 'slug': brgy.slug, 'municipality_id': brgy.municipality_id}
            for brgy in barangays
        ]
    
    print(f"  Database: {len(db_municipalities)} municipalities, {sum(len(v) for v in db_barangays.values())} barangays")
    
    # Read static JSON files
    print("\n[STEP 2] Reading IDs from static JSON files...")
    
    # Municipality IDs
    static_mun_file = project_root / 'data' / 'municipality_ids.json'
    static_municipalities = {}
    if static_mun_file.exists():
        with open(static_mun_file, 'r', encoding='utf-8') as f:
            static_municipalities = json.load(f)
        print(f"  Static municipality_ids.json: {len(static_municipalities)} entries")
    else:
        print(f"  [WARNING] Static municipality_ids.json not found!")
    
    # Barangay IDs
    static_brgy_file = project_root / 'data' / 'barangay_ids.json'
    static_barangays = {}
    if static_brgy_file.exists():
        with open(static_brgy_file, 'r', encoding='utf-8') as f:
            static_barangays = json.load(f)
        total_static_brgy = sum(len(v) for v in static_barangays.values())
        print(f"  Static barangay_ids.json: {total_static_brgy} barangays")
    else:
        print(f"  [WARNING] Static barangay_ids.json not found!")
    
    # Frontend barangay file
    web_brgy_file = project_root / 'apps' / 'web' / 'src' / 'lib' / 'barangay_ids.json'
    web_barangays = {}
    if web_brgy_file.exists():
        with open(web_brgy_file, 'r', encoding='utf-8') as f:
            web_barangays = json.load(f)
        total_web_brgy = sum(len(v) for v in web_barangays.values())
        print(f"  Web barangay_ids.json: {total_web_brgy} barangays")
    else:
        print(f"  [WARNING] Web barangay_ids.json not found!")
    
    # Compare Municipality IDs
    print("\n[STEP 3] Comparing Municipality IDs...")
    mun_mismatches = []
    mun_missing_in_static = []
    mun_missing_in_db = []
    
    all_slugs = set(db_municipalities.keys()) | set(static_municipalities.keys())
    
    for slug in sorted(all_slugs):
        db_id = db_municipalities.get(slug, {}).get('id')
        static_id = static_municipalities.get(slug, {}).get('id')
        
        if slug not in db_municipalities:
            mun_missing_in_db.append(slug)
        elif slug not in static_municipalities:
            mun_missing_in_static.append(slug)
        elif db_id != static_id:
            mun_mismatches.append({
                'slug': slug,
                'name': db_municipalities[slug]['name'],
                'db_id': db_id,
                'static_id': static_id
            })
    
    print(f"\n  Municipality ID Mismatches: {len(mun_mismatches)}")
    if mun_mismatches:
        print("  [MISMATCHES FOUND]:")
        for m in mun_mismatches[:10]:  # Show first 10
            print(f"    - {m['name']} ({m['slug']}): DB={m['db_id']}, Static={m['static_id']}")
        if len(mun_mismatches) > 10:
            print(f"    ... and {len(mun_mismatches) - 10} more")
    else:
        print("  [OK] All municipality IDs match!")
    
    if mun_missing_in_static:
        print(f"\n  Municipalities in DB but not in static: {len(mun_missing_in_static)}")
        for slug in mun_missing_in_static[:5]:
            print(f"    - {slug}")
    
    if mun_missing_in_db:
        print(f"\n  Municipalities in static but not in DB: {len(mun_missing_in_db)}")
        for slug in mun_missing_in_db[:5]:
            print(f"    - {slug}")
    
    # Compare Barangay IDs
    print("\n[STEP 4] Comparing Barangay IDs...")
    brgy_mismatches = []
    brgy_count_mismatches = []
    
    for mun_slug in sorted(set(db_barangays.keys()) | set(static_barangays.keys())):
        db_brgys = db_barangays.get(mun_slug, [])
        static_brgys = static_barangays.get(mun_slug, [])
        
        if len(db_brgys) != len(static_brgys):
            brgy_count_mismatches.append({
                'municipality': mun_slug,
                'db_count': len(db_brgys),
                'static_count': len(static_brgys)
            })
            continue
        
        # Create maps by slug for comparison
        db_brgy_map = {b['slug']: b for b in db_brgys}
        static_brgy_map = {b['slug']: b for b in static_brgys}
        
        for brgy_slug in set(db_brgy_map.keys()) | set(static_brgy_map.keys()):
            db_brgy = db_brgy_map.get(brgy_slug)
            static_brgy = static_brgy_map.get(brgy_slug)
            
            if db_brgy and static_brgy:
                if db_brgy['id'] != static_brgy['id']:
                    brgy_mismatches.append({
                        'municipality': mun_slug,
                        'barangay': brgy_slug,
                        'db_id': db_brgy['id'],
                        'static_id': static_brgy['id']
                    })
                elif db_brgy['municipality_id'] != static_brgy['municipality_id']:
                    brgy_mismatches.append({
                        'municipality': mun_slug,
                        'barangay': brgy_slug,
                        'issue': 'municipality_id mismatch',
                        'db_mun_id': db_brgy['municipality_id'],
                        'static_mun_id': static_brgy['municipality_id']
                    })
    
    print(f"\n  Barangay Count Mismatches: {len(brgy_count_mismatches)}")
    if brgy_count_mismatches:
        print("  [COUNT MISMATCHES]:")
        for m in brgy_count_mismatches[:10]:
            print(f"    - {m['municipality']}: DB={m['db_count']}, Static={m['static_count']}")
    
    print(f"\n  Barangay ID Mismatches: {len(brgy_mismatches)}")
    if brgy_mismatches:
        print("  [ID MISMATCHES FOUND]:")
        for m in brgy_mismatches[:10]:
            if 'issue' in m:
                print(f"    - {m['municipality']}/{m['barangay']}: {m['issue']} (DB={m['db_mun_id']}, Static={m['static_mun_id']})")
            else:
                print(f"    - {m['municipality']}/{m['barangay']}: DB={m['db_id']}, Static={m['static_id']}")
        if len(brgy_mismatches) > 10:
            print(f"    ... and {len(brgy_mismatches) - 10} more")
    else:
        print("  [OK] All barangay IDs match!")
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Municipality ID Mismatches: {len(mun_mismatches)}")
    print(f"Municipality Missing in Static: {len(mun_missing_in_static)}")
    print(f"Municipality Missing in DB: {len(mun_missing_in_db)}")
    print(f"Barangay Count Mismatches: {len(brgy_count_mismatches)}")
    print(f"Barangay ID Mismatches: {len(brgy_mismatches)}")
    
    total_issues = len(mun_mismatches) + len(mun_missing_in_static) + len(mun_missing_in_db) + len(brgy_count_mismatches) + len(brgy_mismatches)
    
    if total_issues == 0:
        print("\n[OK] All IDs match perfectly! No updates needed.")
    else:
        print(f"\n[WARNING] Found {total_issues} issues that need to be fixed.")
        print("Recommendation: Run export_production_ids.py to update static files.")
    
    print("\n" + "="*70 + "\n")

