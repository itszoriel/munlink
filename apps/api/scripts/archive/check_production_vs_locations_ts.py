"""
Check if production database matches locations.ts file.
Uses hardcoded production database credentials.
"""
import sys
import os
from pathlib import Path
import json

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

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = PRODUCTION_DATABASE_URL

print("\n" + "="*70)
print("CHECKING PRODUCTION DATABASE vs locations.ts")
print("="*70)

# Read locations.ts file
locations_ts_file = Path(project_root) / 'apps' / 'web' / 'src' / 'lib' / 'locations.ts'

if not locations_ts_file.exists():
    print(f"\n[ERROR] locations.ts file not found: {locations_ts_file}")
    sys.exit(1)

print(f"\n[STEP 1] Reading locations.ts file...")

# Parse locations.ts to extract province and municipality data
with open(locations_ts_file, 'r', encoding='utf-8') as f:
    locations_ts_content = f.read()

# Extract PROVINCES data
provinces_ts = []
province_pattern = r"\{ id: (\d+), name: '([^']+)', slug: '([^']+)', region_name: '([^']+)' \}"
import re
for match in re.finditer(r"\{ id: (\d+), name: '([^']+)', slug: '([^']+)', region_name: '([^']+)' \}", locations_ts_content):
    provinces_ts.append({
        'id': int(match.group(1)),
        'name': match.group(2),
        'slug': match.group(3)
    })

# Extract DB_MUNICIPALITY_IDS
municipality_ids_ts = {}
for match in re.finditer(r'"([^"]+)": (\d+),?\s*// ([^)]+)', locations_ts_content):
    slug = match.group(1)
    db_id = int(match.group(2))
    name = match.group(3).strip()
    municipality_ids_ts[slug] = {'id': db_id, 'name': name}

# Extract MUNICIPALITIES_DATA
municipalities_data_ts = {}
current_province_id = None
for match in re.finditer(r"// (\w+(?:\s+\w+)?) \(province_id: (\d+)\)", locations_ts_content):
    current_province_id = int(match.group(2))

# More comprehensive extraction
municipalities_by_province_ts = {}
for match in re.finditer(r"(\d+):\s*\[", locations_ts_content):
    province_id = int(match.group(1))
    municipalities_by_province_ts[province_id] = []

# Extract municipality entries
for match in re.finditer(r"\{ name: '([^']+)', slug: '([^']+)', province_id: (\d+) \}", locations_ts_content):
    municipalities_by_province_ts[int(match.group(3))].append({
        'name': match.group(1),
        'slug': match.group(2),
        'province_id': int(match.group(3))
    })

print(f"  Found {len(provinces_ts)} provinces in locations.ts")
print(f"  Found {len(municipality_ids_ts)} municipality ID mappings")
total_muns_ts = sum(len(muns) for muns in municipalities_by_province_ts.values())
print(f"  Found {total_muns_ts} municipalities")

# Get database data
print("\n[STEP 2] Reading from production database...")

with app.app_context():
    # Get provinces
    db_provinces = {p.id: p for p in Province.query.filter_by(is_active=True).order_by(Province.id).all()}
    
    print(f"  Found {len(db_provinces)} provinces in database")
    
    # Compare provinces by name (not ID, since IDs may differ)
    print("\n[STEP 3] Comparing provinces by name...")
    db_provinces_by_name = {p.name: p for p in db_provinces.values()}
    ts_provinces_by_name = {p['name']: p for p in provinces_ts}
    
    db_province_names = set(db_provinces_by_name.keys())
    ts_province_names = set(ts_provinces_by_name.keys())
    
    missing_in_db = ts_province_names - db_province_names
    extra_in_db = db_province_names - ts_province_names
    
    if missing_in_db:
        print(f"  [MISSING IN DB] Provinces in locations.ts but not in database:")
        for name in sorted(missing_in_db):
            print(f"    - {name}")
    
    if extra_in_db:
        print(f"  [EXTRA IN DB] Provinces in database but not in locations.ts:")
        for name in sorted(extra_in_db):
            print(f"    - {name}")
    
    if not missing_in_db and not extra_in_db:
        print("  [OK] All province names match")
    
    # Create province ID mapping (TS ID -> DB ID)
    province_id_mapping = {}
    for name in db_province_names & ts_province_names:
        ts_id = ts_provinces_by_name[name]['id']
        db_id = db_provinces_by_name[name].id
        province_id_mapping[ts_id] = db_id
        if ts_id != db_id:
            print(f"  [NOTE] Province '{name}': locations.ts ID={ts_id}, DB ID={db_id}")
    
    print("\n[STEP 4] Province ID mapping (locations.ts -> DB):")
    for ts_id, db_id in sorted(province_id_mapping.items()):
        # Find name from ts_id
        for name, prov in ts_provinces_by_name.items():
            if prov['id'] == ts_id:
                print(f"  {name}: TS ID {ts_id} -> DB ID {db_id}")
                break
    
    # Compare municipalities
    print("\n[STEP 5] Comparing municipalities...")
    
    # Get all municipalities from database grouped by province name
    db_municipalities_by_province_name = {}
    for province_name, province in db_provinces_by_name.items():
        municipalities = Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).order_by(Municipality.id).all()
        db_municipalities_by_province_name[province_name] = {m.id: m for m in municipalities}
    
    total_missing_muns = 0
    total_extra_muns = 0
    total_id_mismatches = 0
    
    # Map TS province IDs to names for comparison
    ts_municipalities_by_province_name = {}
    for ts_province_id, muns in municipalities_by_province_ts.items():
        # Find province name for this TS ID
        ts_prov = next((p for p in provinces_ts if p['id'] == ts_province_id), None)
        if ts_prov:
            ts_municipalities_by_province_name[ts_prov['name']] = muns
    
    for province_name in sorted(set(list(db_province_names) + list(ts_municipalities_by_province_name.keys()))):
        if province_name not in db_province_names:
            print(f"  [SKIP] Province '{province_name}' not in database")
            continue
        
        if province_name not in ts_municipalities_by_province_name:
            print(f"  [SKIP] Province '{province_name}' not in locations.ts")
            continue
        
        db_muns = db_municipalities_by_province_name[province_name]
        ts_muns = ts_municipalities_by_province_name[province_name]
        
        # Create mappings by slug and name
        db_muns_by_slug = {m.slug: m for m in db_muns.values()}
        db_muns_by_name = {m.name: m for m in db_muns.values()}
        ts_muns_by_slug = {m['slug']: m for m in ts_muns}
        ts_muns_by_name = {m['name']: m for m in ts_muns}
        
        db_slugs = set(db_muns_by_slug.keys())
        ts_slugs = set(ts_muns_by_slug.keys())
        db_names = set(db_muns_by_name.keys())
        ts_names = set(ts_muns_by_name.keys())
        
        # Find municipalities that match by name but have different slugs (special character handling)
        matched_by_name = db_names & ts_names
        matched_by_slug = db_slugs & ts_slugs
        
        # Missing: in TS but not in DB (check by name, not slug)
        missing_muns = []
        for ts_mun in ts_muns:
            ts_name = ts_mun['name']
            ts_slug = ts_mun['slug']
            if ts_name not in db_muns_by_name:
                missing_muns.append(ts_mun)
            elif ts_slug not in db_slugs:
                # Same name but different slug - this is OK (special character handling)
                pass
        
        # Extra: in DB but not in TS (check by name, not slug)
        extra_muns = []
        for db_mun in db_muns.values():
            if db_mun.name not in ts_muns_by_name:
                extra_muns.append(db_mun)
            elif db_mun.slug not in ts_slugs:
                # Same name but different slug - this is OK (special character handling)
                pass
        
        missing_slugs = [m['slug'] for m in missing_muns]
        extra_slugs = [m.slug for m in extra_muns]
        
        if missing_muns:
            print(f"  {province_name}: [MISSING IN DB] {len(missing_muns)} municipalities:")
            for mun in missing_muns:
                print(f"    - {mun['name']} (slug: {mun['slug']})")
            total_missing_muns += len(missing_muns)
        
        if extra_muns:
            print(f"  {province_name}: [EXTRA IN DB] {len(extra_muns)} municipalities:")
            for mun in extra_muns:
                print(f"    - {mun.name} (slug: {mun.slug}, DB ID: {mun.id})")
            total_extra_muns += len(extra_muns)
        
        # Check ID mismatches (compare by name since slugs may differ due to special characters)
        id_mismatches = []
        for name in matched_by_name:
            db_mun = db_muns_by_name[name]
            ts_mun = ts_muns_by_name[name]
            ts_slug = ts_mun['slug']
            ts_id = municipality_ids_ts.get(ts_slug, {}).get('id')
            
            if ts_id and db_mun.id != ts_id:
                id_mismatches.append((name, db_mun.id, ts_id, ts_slug))
                print(f"  {province_name}: [ID MISMATCH] {name}")
                print(f"    - DB ID: {db_mun.id}, locations.ts ID: {ts_id} (slug: {ts_slug})")
                total_id_mismatches += 1
        
        if not missing_muns and not extra_muns and not id_mismatches:
            # Check for slug differences (special characters) - this is OK
            slug_differences = []
            for name in matched_by_name:
                db_mun = db_muns_by_name[name]
                ts_mun = ts_muns_by_name[name]
                if db_mun.slug != ts_mun['slug']:
                    slug_differences.append((name, db_mun.slug, ts_mun['slug']))
            
            if slug_differences:
                print(f"  {province_name}: [OK] All {len(matched_by_name)} municipalities match (note: {len(slug_differences)} have different slugs due to special characters)")
            else:
                print(f"  {province_name}: [OK] All {len(matched_by_name)} municipalities match")
    
    # Compare barangays
    print("\n[STEP 6] Comparing barangays...")
    
    # Read barangay_ids.json
    barangay_ids_file = Path(project_root) / 'apps' / 'web' / 'src' / 'lib' / 'barangay_ids.json'
    if not barangay_ids_file.exists():
        barangay_ids_file = Path(project_root) / 'data' / 'barangay_ids.json'
    
    if barangay_ids_file.exists():
        with open(barangay_ids_file, 'r', encoding='utf-8') as f:
            barangay_ids_ts = json.load(f)
        
        total_missing_brgys = 0
        total_extra_brgys = 0
        total_brgy_id_mismatches = 0
        
        for province_name in sorted(db_province_names):
            if province_name not in ts_municipalities_by_province_name:
                continue
            
            province = db_provinces_by_name[province_name]
            ts_muns = ts_municipalities_by_province_name[province_name]
            
            for ts_mun in ts_muns:
                slug = ts_mun['slug']
                
                # Get barangays from database
                db_mun = Municipality.query.filter_by(slug=slug, is_active=True).first()
                if not db_mun:
                    continue
                
                db_brgys = {b.id: b for b in Barangay.query.filter_by(
                    municipality_id=db_mun.id,
                    is_active=True
                ).order_by(Barangay.id).all()}
                
                # Get barangays from locations.ts (via barangay_ids.json)
                ts_brgys = barangay_ids_ts.get(slug, [])
                ts_brgys_by_id = {b['id']: b for b in ts_brgys if isinstance(b, dict) and 'id' in b}
                ts_brgys_by_name = {b['name']: b for b in ts_brgys if isinstance(b, dict) and 'name' in b}
                
                db_brgy_names = {b.name for b in db_brgys.values()}
                ts_brgy_names = {b['name'] for b in ts_brgys if isinstance(b, dict) and 'name' in b}
                
                missing_brgys = ts_brgy_names - db_brgy_names
                extra_brgys = db_brgy_names - ts_brgy_names
                
                if missing_brgys:
                    print(f"    {ts_mun['name']}: [MISSING IN DB] {len(missing_brgys)} barangays")
                    total_missing_brgys += len(missing_brgys)
                
                if extra_brgys:
                    print(f"    {ts_mun['name']}: [EXTRA IN DB] {len(extra_brgys)} barangays")
                    total_extra_brgys += len(extra_brgys)
                
                # Check ID mismatches
                for db_brgy in db_brgys.values():
                    ts_brgy = ts_brgys_by_name.get(db_brgy.name)
                    if ts_brgy and ts_brgy.get('id') != db_brgy.id:
                        total_brgy_id_mismatches += 1
                
                if not missing_brgys and not extra_brgys:
                    # Check IDs
                    id_mismatches = sum(1 for db_brgy in db_brgys.values() 
                                      if ts_brgys_by_name.get(db_brgy.name, {}).get('id') != db_brgy.id)
                    if id_mismatches == 0 and len(db_brgys) > 0:
                        pass  # All match, no need to print
    else:
        print("  [WARNING] barangay_ids.json not found, skipping barangay comparison")
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Provinces (compared by name):")
    print(f"  Missing in DB: {len(missing_in_db)}")
    print(f"  Extra in DB: {len(extra_in_db)}")
    print(f"  Note: Province IDs differ (TS uses 1-7, DB uses different IDs), but names match")
    print(f"\nMunicipalities:")
    print(f"  Missing in DB: {total_missing_muns}")
    print(f"  Extra in DB: {total_extra_muns}")
    print(f"  ID mismatches: {total_id_mismatches}")
    print(f"\nBarangays:")
    if barangay_ids_file.exists():
        print(f"  Missing in DB: {total_missing_brgys}")
        print(f"  Extra in DB: {total_extra_brgys}")
        print(f"  ID mismatches: {total_brgy_id_mismatches}")
    else:
        print(f"  (Not checked - barangay_ids.json not found)")
    
    if (len(missing_in_db) == 0 and len(extra_in_db) == 0 and
        total_missing_muns == 0 and total_extra_muns == 0 and total_id_mismatches == 0 and
        total_missing_brgys == 0 and total_extra_brgys == 0 and total_brgy_id_mismatches == 0):
        print("\n" + "="*70)
        print("[SUCCESS] Production database matches locations.ts!")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("[WARNING] Some discrepancies found")
        print("="*70)

print("\n")

