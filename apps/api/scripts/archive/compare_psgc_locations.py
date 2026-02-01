"""
Compare Region 3 municipalities from PSGC file with database.
Also check for San Antonio issue in Zambales.
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

# Load environment variables from .env file
env_path = Path(project_root) / '.env'
if env_path.exists():
    load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required.")

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from apps.api.models.municipality import Municipality
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("COMPARING PSGC DATA WITH DATABASE")
print("="*70)

# Read PSGC Excel file
psgc_file = Path(project_root) / 'data' / 'PSGC-July-2025-Publication-Datafile.xlsx'

if not psgc_file.exists():
    print(f"\n[ERROR] PSGC file not found: {psgc_file}")
    sys.exit(1)

print(f"\n[STEP 1] Reading PSGC file: {psgc_file}")

wb = openpyxl.load_workbook(psgc_file, data_only=True)
ws = wb.active

# Structure: Col 1 = PSGC, Col 2 = Name, Col 4 = Geographic Level
# Region 3 PSGC codes start with 03
# Municipalities have Geographic Level = "Mun" or "City"

psgc_municipalities = {}
current_province = None
current_province_name = None

print("  Scanning for Region 3 municipalities...")

for row in ws.iter_rows(min_row=2, values_only=True):
    if not row or not row[0]:
        continue
    
    psgc = str(row[0]).strip()
    name = str(row[1]).strip() if row[1] else ''
    geo_level = str(row[3]).strip() if row[3] else ''
    
    # Check if Region 3 (PSGC starts with 03)
    if psgc.startswith('03'):
        # Province level (PSGC like 0314000000)
        if geo_level == 'Prov' and len(psgc) == 10:
            current_province = psgc[:4]  # First 4 digits for province
            current_province_name = name
            if current_province_name not in psgc_municipalities:
                psgc_municipalities[current_province_name] = []
        
        # Municipality/City level (PSGC like 0314010000)
        if geo_level in ['Mun', 'City'] and len(psgc) == 10 and current_province_name:
            mun_name = name.strip()
            if mun_name and mun_name not in psgc_municipalities[current_province_name]:
                psgc_municipalities[current_province_name].append(mun_name)

print(f"  Extracted {sum(len(muns) for muns in psgc_municipalities.values())} municipalities from PSGC file")
print("\nPSGC Municipalities by Province:")
for province, muns in sorted(psgc_municipalities.items()):
    print(f"  {province}: {len(muns)} municipalities")
    for mun in sorted(muns):
        print(f"    - {mun}")

# Get database municipalities
print("\n" + "="*70)
print("[STEP 2] Reading from database...")

with app.app_context():
    provinces = Province.query.order_by(Province.id).all()
    db_municipalities = {}
    
    for province in provinces:
        municipalities = Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).order_by(Municipality.name).all()
        
        db_municipalities[province.name] = [mun.name for mun in municipalities]
    
    print(f"  Found {sum(len(muns) for muns in db_municipalities.values())} municipalities in database")
    print("\nDatabase Municipalities by Province:")
    for province, muns in sorted(db_municipalities.items()):
        print(f"  {province}: {len(muns)} municipalities")
        for mun in sorted(muns):
            print(f"    - {mun}")
    
    # Compare
    print("\n" + "="*70)
    print("[STEP 3] COMPARISON RESULTS")
    print("="*70)
    
    all_match = True
    
    for province_name in sorted(set(list(psgc_municipalities.keys()) + list(db_municipalities.keys()))):
        psgc_muns = set(psgc_municipalities.get(province_name, []))
        db_muns = set(db_municipalities.get(province_name, []))
        
        missing_in_db = psgc_muns - db_muns
        extra_in_db = db_muns - psgc_muns
        
        if missing_in_db or extra_in_db:
            all_match = False
            print(f"\n{province_name}:")
            if missing_in_db:
                print(f"  [MISSING IN DB] {len(missing_in_db)} municipalities from PSGC not in database:")
                for mun in sorted(missing_in_db):
                    print(f"    - {mun}")
            if extra_in_db:
                print(f"  [EXTRA IN DB] {len(extra_in_db)} municipalities in database not in PSGC:")
                for mun in sorted(extra_in_db):
                    print(f"    - {mun}")
        else:
            print(f"\n{province_name}: [OK] All municipalities match ({len(psgc_muns)} municipalities)")
    
    # Special check for San Antonio in Zambales
    print("\n" + "="*70)
    print("[STEP 4] CHECKING SAN ANTONIO IN ZAMBALES")
    print("="*70)
    
    zambales_psgc = set(psgc_municipalities.get('Zambales', []))
    zambales_db = set(db_municipalities.get('Zambales', []))
    
    print(f"\nZambales municipalities in PSGC ({len(zambales_psgc)}):")
    for mun in sorted(zambales_psgc):
        print(f"  - {mun}")
    
    print(f"\nZambales municipalities in database ({len(zambales_db)}):")
    for mun in sorted(zambales_db):
        print(f"  - {mun}")
    
    if 'San Antonio' in zambales_db:
        print("\n[FOUND] San Antonio is in database for Zambales!")
        # Get the actual record
        zambales_province = Province.query.filter_by(name='Zambales').first()
        if zambales_province:
            san_antonio = Municipality.query.filter_by(
                province_id=zambales_province.id,
                name='San Antonio',
                is_active=True
            ).first()
            if san_antonio:
                print(f"  Database record: ID={san_antonio.id}, slug={san_antonio.slug}, name={san_antonio.name}")
    else:
        print("\n[OK] San Antonio is NOT in database for Zambales")
    
    if 'San Antonio' in zambales_psgc:
        print("\n[FOUND] San Antonio is in PSGC file for Zambales!")
    else:
        print("\n[OK] San Antonio is NOT in PSGC file for Zambales")
    
    # Check locations.ts file
    print("\n" + "="*70)
    print("[STEP 5] CHECKING locations.ts FILE")
    print("="*70)
    
    locations_ts = Path(project_root) / 'apps' / 'web' / 'src' / 'lib' / 'locations.ts'
    if locations_ts.exists():
        with open(locations_ts, 'r', encoding='utf-8') as f:
            content = f.read()
            # Find Zambales section
            zambales_start = content.find('// Zambales')
            if zambales_start != -1:
                # Find next province section or end
                next_section = content.find('// ', zambales_start + 1)
                if next_section == -1:
                    zambales_section = content[zambales_start:]
                else:
                    zambales_section = content[zambales_start:next_section]
                
                if 'san-antonio' in zambales_section.lower():
                    print("\n[FOUND] 'san-antonio' appears in locations.ts for Zambales section!")
                    # Find the line
                    lines = zambales_section.split('\n')
                    for line in lines:
                        if 'san-antonio' in line.lower():
                            print(f"  Line: {line.strip()}")
                else:
                    print("\n[OK] 'san-antonio' not in Zambales section of locations.ts")
            else:
                print("\n[WARNING] Could not find Zambales section in locations.ts")
    
    if all_match:
        print("\n" + "="*70)
        print("[OK] ALL MUNICIPALITIES MATCH!")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("[WARNING] SOME DIFFERENCES FOUND")
        print("="*70)

print("\n")
