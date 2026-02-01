"""
Check ALL municipalities for missing barangays in database and barangay_ids.json.
This will identify which municipalities don't have barangays.
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import json

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

env_path = Path(project_root) / '.env'
if env_path.exists():
    load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required.")

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from apps.api import db
from apps.api.models.municipality import Barangay, Municipality
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("CHECKING ALL MUNICIPALITIES FOR BARANGAYS")
print("="*70)

# Read barangay_ids.json
print("\n[STEP 1] Reading barangay_ids.json...")
barangay_json = Path(project_root) / 'apps' / 'web' / 'src' / 'lib' / 'barangay_ids.json'

if not barangay_json.exists():
    # Try alternative location
    barangay_json = Path(project_root) / 'data' / 'barangay_ids.json'

if barangay_json.exists():
    with open(barangay_json, 'r', encoding='utf-8') as f:
        barangay_data = json.load(f)
    print(f"  [OK] Loaded barangay_ids.json with {len(barangay_data)} municipalities")
else:
    print("  [ERROR] barangay_ids.json not found!")
    barangay_data = {}

# Read region3_locations.json
print("\n[STEP 2] Reading region3_locations.json...")
region3_file = Path(project_root) / 'data' / 'locations' / 'region3_locations.json'

if region3_file.exists():
    with open(region3_file, 'r', encoding='utf-8') as f:
        region3_data = json.load(f)
    print("  [OK] Loaded region3_locations.json")
else:
    print("  [ERROR] region3_locations.json not found!")
    region3_data = {}

print("\n[STEP 3] Checking all municipalities...")

with app.app_context():
    provinces = Province.query.order_by(Province.id).all()
    
    municipalities_without_db_barangays = []
    municipalities_without_json_barangays = []
    municipalities_missing_barangays = []
    
    total_municipalities = 0
    total_with_barangays = 0
    
    for province in provinces:
        municipalities = Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).order_by(Municipality.name).all()
        
        print(f"\n  {province.name}:")
        
        for mun in municipalities:
            total_municipalities += 1
            
            # Check database
            db_barangays = Barangay.query.filter_by(
                municipality_id=mun.id,
                is_active=True
            ).all()
            
            # Check JSON file (use slug)
            json_barangays = barangay_data.get(mun.slug, [])
            
            # Check region3_data
            province_data = region3_data.get(province.name, {})
            region3_barangays = province_data.get(mun.name, [])
            
            db_count = len(db_barangays)
            json_count = len(json_barangays) if isinstance(json_barangays, list) else 0
            region3_count = len(region3_barangays) if isinstance(region3_barangays, list) else 0
            
            if db_count == 0:
                municipalities_without_db_barangays.append({
                    'name': mun.name,
                    'slug': mun.slug,
                    'province': province.name,
                    'id': mun.id
                })
                print(f"    [MISSING DB] {mun.name} (slug: {mun.slug}) - No barangays in database")
            elif json_count == 0:
                municipalities_without_json_barangays.append({
                    'name': mun.name,
                    'slug': mun.slug,
                    'province': province.name,
                    'id': mun.id,
                    'db_count': db_count
                })
                print(f"    [MISSING JSON] {mun.name} (slug: {mun.slug}) - {db_count} in DB, 0 in JSON")
            elif db_count != json_count:
                municipalities_missing_barangays.append({
                    'name': mun.name,
                    'slug': mun.slug,
                    'province': province.name,
                    'id': mun.id,
                    'db_count': db_count,
                    'json_count': json_count
                })
                print(f"    [MISMATCH] {mun.name} (slug: {mun.slug}) - DB: {db_count}, JSON: {json_count}")
            else:
                total_with_barangays += 1
                print(f"    [OK] {mun.name} - {db_count} barangays")
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"  Total municipalities: {total_municipalities}")
    print(f"  Municipalities with barangays: {total_with_barangays}")
    print(f"  Municipalities without DB barangays: {len(municipalities_without_db_barangays)}")
    print(f"  Municipalities without JSON barangays: {len(municipalities_without_json_barangays)}")
    print(f"  Municipalities with count mismatches: {len(municipalities_missing_barangays)}")
    
    if municipalities_without_db_barangays:
        print("\n  Municipalities WITHOUT barangays in DATABASE:")
        for mun in municipalities_without_db_barangays:
            print(f"    - {mun['name']} ({mun['province']}) - slug: {mun['slug']}, ID: {mun['id']}")
    
    if municipalities_without_json_barangays:
        print("\n  Municipalities WITHOUT barangays in JSON (but have in DB):")
        for mun in municipalities_without_json_barangays:
            print(f"    - {mun['name']} ({mun['province']}) - slug: {mun['slug']}, ID: {mun['id']}, DB count: {mun['db_count']}")
    
    if municipalities_missing_barangays:
        print("\n  Municipalities with COUNT MISMATCHES:")
        for mun in municipalities_missing_barangays:
            print(f"    - {mun['name']} ({mun['province']}) - slug: {mun['slug']}, DB: {mun['db_count']}, JSON: {mun['json_count']}")

print("\n" + "="*70 + "\n")

















