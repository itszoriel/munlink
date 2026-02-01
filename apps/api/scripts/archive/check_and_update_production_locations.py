"""
Check and update production database locations to match PSGC data.
Uses hardcoded production database credentials.
"""
import sys
import os
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Error: openpyxl not installed. Install with: pip install openpyxl")
    sys.exit(1)

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Hardcoded production database credentials
PRODUCTION_DATABASE_URL = "postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from apps.api import db
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.province import Province
import json

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = PRODUCTION_DATABASE_URL

print("\n" + "="*70)
print("CHECKING AND UPDATING PRODUCTION DATABASE LOCATIONS")
print("="*70)

# Read PSGC Excel file
psgc_file = Path(project_root) / 'data' / 'PSGC-July-2025-Publication-Datafile.xlsx'

if not psgc_file.exists():
    print(f"\n[ERROR] PSGC file not found: {psgc_file}")
    sys.exit(1)

print(f"\n[STEP 1] Reading PSGC file: {psgc_file}")

# Read PSGC Excel file using openpyxl
wb = openpyxl.load_workbook(psgc_file, data_only=True)
ws = wb.active

# Structure: Col 1 (index 0) = PSGC, Col 2 (index 1) = Name, Col 4 (index 3) = Geographic Level
# Region 3 PSGC codes start with 03

psgc_data = {}
psgc_province_codes = {}  # Store PSGC codes for provinces
psgc_municipality_codes = {}  # Store PSGC codes for municipalities
current_province = None
current_municipality = None

print("  Scanning for Region 3 locations...")

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
            current_province = name
            current_municipality = None
            if current_province not in psgc_data:
                psgc_data[current_province] = {}
                psgc_province_codes[current_province] = psgc
            print(f"  Found province: {current_province} (PSGC: {psgc})")
        
        # Municipality/City level (PSGC like 0314010000)
        elif geo_level in ['Mun', 'City'] and len(psgc) == 10 and current_province:
            current_municipality = name
            if current_municipality not in psgc_data[current_province]:
                psgc_data[current_province][current_municipality] = []
                if current_province not in psgc_municipality_codes:
                    psgc_municipality_codes[current_province] = {}
                psgc_municipality_codes[current_province][current_municipality] = psgc
        
        # Barangay level (PSGC like 0314010001)
        elif geo_level == 'Bgy' and len(psgc) == 10 and current_province and current_municipality:
            brgy_name = name.strip()
            if brgy_name:
                psgc_data[current_province][current_municipality].append(brgy_name)

print(f"\n[STEP 2] Extracted from PSGC:")
for province, municipalities in psgc_data.items():
    total_barangays = sum(len(barangays) for barangays in municipalities.values())
    print(f"  {province}: {len(municipalities)} municipalities, {total_barangays} barangays")

# Get database data
print("\n[STEP 3] Reading from production database...")

with app.app_context():
    # Get all provinces
    db_provinces = {p.name: p for p in Province.query.filter_by(is_active=True).all()}
    
    print(f"  Found {len(db_provinces)} provinces in database")
    
    # Compare provinces
    print("\n[STEP 4] Comparing provinces...")
    psgc_provinces = set(psgc_data.keys())
    db_province_names = set(db_provinces.keys())
    
    missing_provinces = psgc_provinces - db_province_names
    extra_provinces = db_province_names - psgc_provinces
    
    if missing_provinces:
        print(f"  [MISSING] Provinces in PSGC but not in database: {missing_provinces}")
    if extra_provinces:
        print(f"  [EXTRA] Provinces in database but not in PSGC: {extra_provinces}")
    if not missing_provinces and not extra_provinces:
        print("  [OK] All provinces match")
    
    # Compare municipalities
    print("\n[STEP 5] Comparing municipalities...")
    total_missing_muns = 0
    total_extra_muns = 0
    
    for province_name in sorted(psgc_provinces):
        if province_name not in db_provinces:
            print(f"  [SKIP] Province {province_name} not in database")
            continue
        
        province = db_provinces[province_name]
        psgc_muns = set(psgc_data[province_name].keys())
        
        db_muns = {m.name for m in Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).all()}
        
        missing_muns = psgc_muns - db_muns
        extra_muns = db_muns - psgc_muns
        
        if missing_muns:
            print(f"  {province_name}: [MISSING] {len(missing_muns)} municipalities:")
            for mun in sorted(missing_muns):
                print(f"    - {mun}")
            total_missing_muns += len(missing_muns)
        
        if extra_muns:
            print(f"  {province_name}: [EXTRA] {len(extra_muns)} municipalities:")
            for mun in sorted(extra_muns):
                print(f"    - {mun}")
            total_extra_muns += len(extra_muns)
        
        if not missing_muns and not extra_muns:
            print(f"  {province_name}: [OK] All {len(psgc_muns)} municipalities match")
    
    # Compare barangays
    print("\n[STEP 6] Comparing barangays...")
    total_missing_brgys = 0
    total_extra_brgys = 0
    
    for province_name in sorted(psgc_provinces):
        if province_name not in db_provinces:
            continue
        
        province = db_provinces[province_name]
        
        for mun_name in sorted(psgc_data[province_name].keys()):
            municipality = Municipality.query.filter_by(
                province_id=province.id,
                name=mun_name,
                is_active=True
            ).first()
            
            if not municipality:
                print(f"    [SKIP] Municipality {mun_name} not in database")
                continue
            
            psgc_brgys = set(psgc_data[province_name][mun_name])
            db_brgys = {b.name for b in Barangay.query.filter_by(
                municipality_id=municipality.id,
                is_active=True
            ).all()}
            
            missing_brgys = psgc_brgys - db_brgys
            extra_brgys = db_brgys - psgc_brgys
            
            if missing_brgys:
                print(f"    {mun_name}: [MISSING] {len(missing_brgys)} barangays")
                total_missing_brgys += len(missing_brgys)
            
            if extra_brgys:
                print(f"    {mun_name}: [EXTRA] {len(extra_brgys)} barangays")
                total_extra_brgys += len(extra_brgys)
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Provinces:")
    print(f"  Missing in DB: {len(missing_provinces)}")
    print(f"  Extra in DB: {len(extra_provinces)}")
    print(f"\nMunicipalities:")
    print(f"  Missing in DB: {total_missing_muns}")
    print(f"  Extra in DB: {total_extra_muns}")
    print(f"\nBarangays:")
    print(f"  Missing in DB: {total_missing_brgys}")
    print(f"  Extra in DB: {total_extra_brgys}")
    
    # Ask if user wants to update
    if total_missing_muns > 0 or total_missing_brgys > 0 or len(missing_provinces) > 0:
        print("\n" + "="*70)
        print("READY TO UPDATE DATABASE")
        print("="*70)
        print("\nThis script will:")
        print("  1. Add missing provinces")
        print("  2. Add missing municipalities")
        print("  3. Add missing barangays")
        print("\nProceeding with updates...")
        
        # Add missing provinces
        if missing_provinces:
            print(f"\n[UPDATING] Adding {len(missing_provinces)} missing provinces...")
            for prov_name in missing_provinces:
                # Get PSGC code for province
                prov_row = region3_df[
                    (region3_df['Geographic Level'] == 'Prov') & 
                    (region3_df['Name'] == prov_name)
                ]
                if not prov_row.empty:
                    psgc_code = str(prov_row.iloc[0]['PSGC']).strip()
                else:
                    psgc_code = '000000000'
                
                province = Province(
                    name=prov_name,
                    slug=prov_name.lower().replace(' ', '-'),
                    psgc_code=psgc_code,
                    region_code='03',
                    region_name='Central Luzon',
                    description=f'Province in Region 3 (Central Luzon)',
                    is_active=True
                )
                db.session.add(province)
                print(f"  Added: {prov_name}")
            
            db.session.commit()
            # Refresh provinces dict
            db_provinces = {p.name: p for p in Province.query.filter_by(is_active=True).all()}
        
        # Add missing municipalities
        if total_missing_muns > 0:
            print(f"\n[UPDATING] Adding missing municipalities...")
            added_muns = 0
            
            for province_name in sorted(psgc_provinces):
                if province_name not in db_provinces:
                    continue
                
                province = db_provinces[province_name]
                psgc_muns = set(psgc_data[province_name].keys())
                db_muns = {m.name for m in Municipality.query.filter_by(
                    province_id=province.id,
                    is_active=True
                ).all()}
                missing_muns = psgc_muns - db_muns
                
                for mun_name in sorted(missing_muns):
                    # Get PSGC code for municipality
                    mun_row = region3_df[
                        (region3_df['Geographic Level'].isin(['Mun', 'City'])) & 
                        (region3_df['Name'] == mun_name)
                    ]
                    if not mun_row.empty:
                        psgc_code = str(mun_row.iloc[0]['PSGC']).strip()
                    else:
                        psgc_code = f"{province.psgc_code[:6]}000"
                    
                    # Generate slug
                    slug = mun_name.lower().replace(' ', '-').replace("'", '').replace('.', '').replace('(', '').replace(')', '')
                    
                    # Check for duplicate slugs
                    existing_slug = Municipality.query.filter_by(slug=slug).first()
                    if existing_slug:
                        # Add province suffix for uniqueness
                        prov_slug = province.name.lower().replace(' ', '-')
                        slug = f"{slug}-{prov_slug}"
                    
                    municipality = Municipality(
                        name=mun_name,
                        slug=slug,
                        province_id=province.id,
                        psgc_code=psgc_code,
                        description=f'Municipality in {province_name}',
                        is_active=True
                    )
                    db.session.add(municipality)
                    db.session.flush()
                    added_muns += 1
                    print(f"  Added: {mun_name} ({province_name})")
            
            db.session.commit()
            print(f"  Added {added_muns} municipalities")
        
        # Add missing barangays
        if total_missing_brgys > 0:
            print(f"\n[UPDATING] Adding missing barangays...")
            added_brgys = 0
            
            for province_name in sorted(psgc_provinces):
                if province_name not in db_provinces:
                    continue
                
                province = db_provinces[province_name]
                
                for mun_name in sorted(psgc_data[province_name].keys()):
                    municipality = Municipality.query.filter_by(
                        province_id=province.id,
                        name=mun_name,
                        is_active=True
                    ).first()
                    
                    if not municipality:
                        continue
                    
                    psgc_brgys = set(psgc_data[province_name][mun_name])
                    db_brgys = {b.name for b in Barangay.query.filter_by(
                        municipality_id=municipality.id,
                        is_active=True
                    ).all()}
                    missing_brgys = psgc_brgys - db_brgys
                    
                    for brgy_name in sorted(missing_brgys):
                        # Get PSGC code for barangay
                        brgy_row = region3_df[
                            (region3_df['Geographic Level'] == 'Bgy') & 
                            (region3_df['Name'] == brgy_name)
                        ]
                        if not brgy_row.empty:
                            psgc_code = str(brgy_row.iloc[0]['PSGC']).strip()
                        else:
                            existing_count = Barangay.query.filter_by(municipality_id=municipality.id).count()
                            psgc_code = f"{municipality.psgc_code}{existing_count + 1:03d}"
                        
                        slug = brgy_name.lower().replace(' ', '-').replace("'", '').replace('.', '').replace('(', '').replace(')', '').replace('/', '-')
                        
                        barangay = Barangay(
                            name=brgy_name,
                            slug=slug,
                            municipality_id=municipality.id,
                            psgc_code=psgc_code,
                            is_active=True
                        )
                        db.session.add(barangay)
                        added_brgys += 1
                    
                    if missing_brgys:
                        print(f"    {mun_name}: Added {len(missing_brgys)} barangays")
            
            db.session.commit()
            print(f"  Added {added_brgys} barangays")
        
        print("\n" + "="*70)
        print("[SUCCESS] Database updated to match PSGC data!")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("[OK] Database already matches PSGC data!")
        print("="*70)

print("\n")

