"""
Compare Region 3 barangays from PSGC file with database.
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
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("COMPARING PSGC BARANGAY DATA WITH DATABASE")
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
# Barangays have Geographic Level = "Bgy"

psgc_barangays = {}
current_province = None
current_province_name = None
current_municipality = None
current_municipality_name = None

print("  Scanning for Region 3 barangays...")

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
            current_province = psgc[:4]
            current_province_name = name
            current_municipality = None
            current_municipality_name = None
        
        # Municipality/City level (PSGC like 0314010000)
        if geo_level in ['Mun', 'City'] and len(psgc) == 10:
            current_municipality = psgc[:6]  # First 6 digits for municipality
            current_municipality_name = name
            
            # Initialize structure
            if current_province_name not in psgc_barangays:
                psgc_barangays[current_province_name] = {}
            if current_municipality_name not in psgc_barangays[current_province_name]:
                psgc_barangays[current_province_name][current_municipality_name] = []
        
        # Barangay level (PSGC like 0314010001)
        if geo_level == 'Bgy' and len(psgc) == 10 and current_municipality_name:
            brgy_name = name.strip()
            if brgy_name and brgy_name not in psgc_barangays[current_province_name][current_municipality_name]:
                psgc_barangays[current_province_name][current_municipality_name].append(brgy_name)

print(f"  Extracted barangays from PSGC file")
print(f"  Provinces: {len(psgc_barangays)}")

# Get database barangays
print("\n[STEP 2] Reading from database...")

with app.app_context():
    provinces = Province.query.order_by(Province.id).all()
    db_barangays = {}
    
    for province in provinces:
        municipalities = Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).order_by(Municipality.name).all()
        
        db_barangays[province.name] = {}
        
        for mun in municipalities:
            barangays = Barangay.query.filter_by(
                municipality_id=mun.id,
                is_active=True
            ).order_by(Barangay.name).all()
            
            db_barangays[province.name][mun.name] = [brgy.name for brgy in barangays]
    
    # Compare
    print("\n" + "="*70)
    print("[STEP 3] COMPARISON RESULTS")
    print("="*70)
    
    total_psgc_barangays = 0
    total_db_barangays = 0
    total_missing = 0
    total_extra = 0
    
    province_order = ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales']
    
    for province_name in province_order:
        if province_name not in psgc_barangays and province_name not in db_barangays:
            continue
        
        psgc_muns = psgc_barangays.get(province_name, {})
        db_muns = db_barangays.get(province_name, {})
        
        all_municipalities = sorted(set(list(psgc_muns.keys()) + list(db_muns.keys())))
        
        province_psgc_count = 0
        province_db_count = 0
        province_missing = 0
        province_extra = 0
        
        for mun_name in all_municipalities:
            psgc_brgys = set(psgc_muns.get(mun_name, []))
            db_brgys = set(db_muns.get(mun_name, []))
            
            province_psgc_count += len(psgc_brgys)
            province_db_count += len(db_brgys)
            
            missing = psgc_brgys - db_brgys
            extra = db_brgys - psgc_brgys
            
            if missing or extra:
                province_missing += len(missing)
                province_extra += len(extra)
                
                if len(missing) > 0 or len(extra) > 0:
                    print(f"\n{province_name} - {mun_name}:")
                    if missing:
                        print(f"  [MISSING IN DB] {len(missing)} barangays from PSGC not in database:")
                        for brgy in sorted(missing)[:10]:  # Show first 10
                            print(f"    - {brgy}")
                        if len(missing) > 10:
                            print(f"    ... and {len(missing) - 10} more")
                    if extra:
                        print(f"  [EXTRA IN DB] {len(extra)} barangays in database not in PSGC:")
                        for brgy in sorted(extra)[:10]:  # Show first 10
                            print(f"    - {brgy}")
                        if len(extra) > 10:
                            print(f"    ... and {len(extra) - 10} more")
        
        total_psgc_barangays += province_psgc_count
        total_db_barangays += province_db_count
        total_missing += province_missing
        total_extra += province_extra
        
        if province_missing == 0 and province_extra == 0:
            print(f"\n{province_name}: [OK] All barangays match ({province_psgc_count} barangays)")
        else:
            print(f"\n{province_name}: {province_psgc_count} in PSGC, {province_db_count} in DB")
            print(f"  Missing: {province_missing}, Extra: {province_extra}")
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"  Total barangays in PSGC: {total_psgc_barangays}")
    print(f"  Total barangays in database: {total_db_barangays}")
    print(f"  Missing in database: {total_missing}")
    print(f"  Extra in database: {total_extra}")
    
    if total_missing == 0 and total_extra == 0:
        print("\n[OK] ALL BARANGAYS MATCH!")
    else:
        print("\n[WARNING] SOME DIFFERENCES FOUND")
        print("\nNote: Some differences may be due to:")
        print("  - Name variations (e.g., 'Poblacion' vs 'Poblacion (Pob.)')")
        print("  - Barangay splits/mergers")
        print("  - Data entry differences")

print("\n")

















