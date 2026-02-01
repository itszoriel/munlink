"""
Check if San Antonio (Zambales) has barangays in database and data files.
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
print("CHECKING SAN ANTONIO (ZAMBALES) BARANGAYS")
print("="*70)

# Check region3_locations.json
print("\n[STEP 1] Checking region3_locations.json...")
region3_file = Path(project_root) / 'data' / 'locations' / 'region3_locations.json'

if region3_file.exists():
    with open(region3_file, 'r', encoding='utf-8') as f:
        region3_data = json.load(f)
    
    zambales_data = region3_data.get('Zambales', {})
    san_antonio_barangays = zambales_data.get('San Antonio', [])
    
    if san_antonio_barangays:
        print(f"  [FOUND] San Antonio has {len(san_antonio_barangays)} barangays in region3_locations.json:")
        for brgy in san_antonio_barangays:
            print(f"    - {brgy}")
    else:
        print("  [NOT FOUND] San Antonio has NO barangays in region3_locations.json")
else:
    print("  [ERROR] region3_locations.json not found")

# Check database
print("\n[STEP 2] Checking database...")

with app.app_context():
    zambales = Province.query.filter_by(name='Zambales').first()
    if not zambales:
        print("  [ERROR] Zambales province not found!")
        sys.exit(1)
    
    san_antonio = Municipality.query.filter_by(
        province_id=zambales.id,
        name='San Antonio',
        is_active=True
    ).first()
    
    if not san_antonio:
        print("  [ERROR] San Antonio (Zambales) not found in database!")
        sys.exit(1)
    
    print(f"  Found San Antonio: ID={san_antonio.id}, slug={san_antonio.slug}")
    
    barangays = Barangay.query.filter_by(
        municipality_id=san_antonio.id,
        is_active=True
    ).order_by(Barangay.name).all()
    
    if barangays:
        print(f"  [FOUND] San Antonio has {len(barangays)} barangays in database:")
        for brgy in barangays:
            print(f"    - {brgy.name} (ID: {brgy.id}, slug: {brgy.slug})")
    else:
        print("  [NOT FOUND] San Antonio has NO barangays in database!")
        print("  This is the problem - barangays need to be added.")
    
    # Check other municipalities without barangays
    print("\n[STEP 3] Checking all municipalities for missing barangays...")
    all_municipalities = Municipality.query.filter_by(is_active=True).all()
    
    municipalities_without_barangays = []
    for mun in all_municipalities:
        brgy_count = Barangay.query.filter_by(
            municipality_id=mun.id,
            is_active=True
        ).count()
        if brgy_count == 0:
            municipalities_without_barangays.append({
                'name': mun.name,
                'province': mun.province.name if mun.province else 'Unknown',
                'id': mun.id
            })
    
    if municipalities_without_barangays:
        print(f"\n  [FOUND] {len(municipalities_without_barangays)} municipalities without barangays:")
        for mun in municipalities_without_barangays:
            print(f"    - {mun['name']} ({mun['province']}) - ID: {mun['id']}")
    else:
        print("\n  [OK] All municipalities have barangays!")

print("\n" + "="*70 + "\n")

















