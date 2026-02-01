"""
Fix all barangay discrepancies between PSGC data and database.
This will add missing barangays and ensure all municipalities have complete barangay data.
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

try:
    import openpyxl
except ImportError:
    print("Error: openpyxl not installed. Install with: pip install openpyxl")
    sys.exit(1)

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Load environment variables
env_path = Path(project_root) / '.env'
if env_path.exists():
    load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required.")

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from apps.api import db
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.province import Province
import json

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("FIXING ALL BARANGAY DISCREPANCIES")
print("="*70)

# Read PSGC Excel file
psgc_file = Path(project_root) / 'data' / 'PSGC-July-2025-Publication-Datafile.xlsx'

if not psgc_file.exists():
    print(f"\n[ERROR] PSGC file not found: {psgc_file}")
    sys.exit(1)

print(f"\n[STEP 1] Reading PSGC file and region3_locations.json...")

# Read PSGC file
wb = openpyxl.load_workbook(psgc_file, data_only=True)
ws = wb.active

# Also read region3_locations.json as primary source
region3_file = Path(project_root) / 'data' / 'locations' / 'region3_locations.json'
if not region3_file.exists():
    print(f"  [ERROR] Region 3 data file not found: {region3_file}")
    sys.exit(1)

with open(region3_file, 'r', encoding='utf-8') as f:
    region3_data = json.load(f)

print("  [OK] Loaded both data sources")

# Extract PSGC barangays (for reference, but we'll use region3_locations.json as primary)
psgc_barangays = {}
current_province_name = None
current_municipality_name = None

for row in ws.iter_rows(min_row=2, values_only=True):
    if not row or not row[0]:
        continue
    
    psgc = str(row[0]).strip()
    name = str(row[1]).strip() if row[1] else ''
    geo_level = str(row[3]).strip() if row[3] else ''
    
    if psgc.startswith('03'):
        if geo_level == 'Prov' and len(psgc) == 10:
            current_province_name = name
            current_municipality_name = None
        
        if geo_level in ['Mun', 'City'] and len(psgc) == 10:
            current_municipality_name = name
            if current_province_name not in psgc_barangays:
                psgc_barangays[current_province_name] = {}
            if current_municipality_name not in psgc_barangays[current_province_name]:
                psgc_barangays[current_province_name][current_municipality_name] = []
        
        if geo_level == 'Bgy' and len(psgc) == 10 and current_municipality_name:
            brgy_name = name.strip()
            if brgy_name:
                psgc_barangays[current_province_name][current_municipality_name].append(brgy_name)

print("\n[STEP 2] Comparing and fixing barangays...")

with app.app_context():
    provinces = {p.name: p for p in Province.query.all()}
    total_added = 0
    total_skipped = 0
    
    # Use region3_locations.json as primary source (more reliable)
    for province_name, municipalities_data in region3_data.items():
        if province_name not in provinces:
            print(f"  [SKIP] Province {province_name} not found in database")
            continue
        
        province = provinces[province_name]
        print(f"\n  Processing {province_name}...")
        
        for mun_name, barangays_list in municipalities_data.items():
            if not isinstance(barangays_list, list):
                continue
            
            # Find municipality
            municipality = Municipality.query.filter_by(
                province_id=province.id,
                name=mun_name,
                is_active=True
            ).first()
            
            if not municipality:
                print(f"    [SKIP] Municipality {mun_name} not found in database")
                continue
            
            # Get existing barangays
            existing_barangays = {brgy.name for brgy in Barangay.query.filter_by(
                municipality_id=municipality.id,
                is_active=True
            ).all()}
            
            # Add missing barangays
            added_count = 0
            for brgy_name in barangays_list:
                if brgy_name not in existing_barangays:
                    brgy_slug = brgy_name.lower().replace(' ', '-').replace("'", '').replace('.', '').replace('(', '').replace(')', '').replace('/', '-')
                    
                    # Generate PSGC code (approximate)
                    existing_count = Barangay.query.filter_by(municipality_id=municipality.id).count()
                    brgy_psgc = f'{municipality.psgc_code}{existing_count + 1:03d}'
                    
                    barangay = Barangay(
                        name=brgy_name,
                        slug=brgy_slug,
                        municipality_id=municipality.id,
                        psgc_code=brgy_psgc,
                        is_active=True
                    )
                    
                    db.session.add(barangay)
                    added_count += 1
            
            if added_count > 0:
                db.session.commit()
                print(f"    [OK] {mun_name}: Added {added_count} barangays")
                total_added += added_count
            else:
                total_skipped += 1
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"  Barangays added: {total_added}")
    print(f"  Municipalities checked: {total_skipped + (total_added > 0 and 1 or 0)}")
    
    # Final count
    total_barangays = Barangay.query.filter_by(is_active=True).count()
    print(f"  Total barangays in database: {total_barangays}")
    
    print("\n" + "="*70)
    print("COMPLETE!")
    print("="*70)
    print("\nAll barangays have been synchronized with region3_locations.json\n")

















