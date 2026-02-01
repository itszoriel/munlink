"""
Export all barangay IDs from database and update barangay_ids.json.
This ensures all municipalities, including newly added ones, have barangays in the JSON file.
"""
import sys
import os
import json
from pathlib import Path
from dotenv import load_dotenv

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
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("EXPORTING ALL BARANGAY IDs TO JSON")
print("="*70)

with app.app_context():
    # Get all municipalities with their barangays
    provinces = Province.query.order_by(Province.id).all()
    barangay_map = {}
    
    print("\n[STEP 1] Reading barangays from database...")
    
    for province in provinces:
        municipalities = Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).order_by(Municipality.name).all()
        
        for mun in municipalities:
            barangays = Barangay.query.filter_by(
                municipality_id=mun.id,
                is_active=True
            ).order_by(Barangay.name).all()
            
            if mun.slug not in barangay_map:
                barangay_map[mun.slug] = []
            
            for brgy in barangays:
                barangay_map[mun.slug].append({
                    'id': brgy.id,
                    'name': brgy.name,
                    'slug': brgy.slug,
                    'municipality_id': brgy.municipality_id
                })
            
            print(f"  {province.name} - {mun.name}: {len(barangays)} barangays")
    
    total_barangays = sum(len(v) for v in barangay_map.values())
    print(f"\n  Total: {len(barangay_map)} municipalities, {total_barangays} barangays")
    
    # Save to data/barangay_ids.json
    print("\n[STEP 2] Saving to data/barangay_ids.json...")
    output_file = Path(project_root) / 'data' / 'barangay_ids.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(barangay_map, f, ensure_ascii=False, indent=2)
    print(f"  [OK] Saved to {output_file}")
    
    # Also update apps/web/src/lib/barangay_ids.json
    print("\n[STEP 3] Updating apps/web/src/lib/barangay_ids.json...")
    web_brgy_file = Path(project_root) / 'apps' / 'web' / 'src' / 'lib' / 'barangay_ids.json'
    with open(web_brgy_file, 'w', encoding='utf-8') as f:
        json.dump(barangay_map, f, ensure_ascii=False, indent=2)
    print(f"  [OK] Updated {web_brgy_file}")
    
    # Verify the update
    print("\n[STEP 4] Verifying update...")
    with open(web_brgy_file, 'r', encoding='utf-8') as f:
        updated_data = json.load(f)
    
    missing_slugs = []
    for mun_slug in barangay_map.keys():
        if mun_slug not in updated_data:
            missing_slugs.append(mun_slug)
    
    if missing_slugs:
        print(f"  [WARNING] {len(missing_slugs)} municipalities missing in updated file:")
        for slug in missing_slugs:
            print(f"    - {slug}")
    else:
        print("  [OK] All municipalities included in JSON file!")
    
    # Check for the three problematic municipalities
    print("\n[STEP 5] Checking previously missing municipalities...")
    check_slugs = ['san-antonio-nueva-ecija', 'san-luis-pampanga', 'san-antonio-zambales']
    for slug in check_slugs:
        if slug in updated_data:
            count = len(updated_data[slug])
            print(f"  [OK] {slug}: {count} barangays")
        else:
            print(f"  [ERROR] {slug}: Still missing!")
    
    print("\n" + "="*70)
    print("COMPLETE!")
    print("="*70)
    print(f"\nbarangay_ids.json has been updated with all {total_barangays} barangays")
    print(f"from {len(barangay_map)} municipalities.\n")

















