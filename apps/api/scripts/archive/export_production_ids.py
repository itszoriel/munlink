"""
Export municipality and barangay IDs from production database
and update static JSON files to match.
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

print("\n" + "="*60)
print("EXPORTING PRODUCTION DATABASE IDs")
print("="*60)

with app.app_context():
    # Export Municipality IDs
    print("\n[STEP 1] Exporting Municipality IDs...")
    provinces = Province.query.order_by(Province.id).all()
    municipality_map = {}
    
    for province in provinces:
        municipalities = Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).order_by(Municipality.name).all()
        
        print(f"  Province {province.id}: {province.name} ({len(municipalities)} municipalities)")
        
        for mun in municipalities:
            municipality_map[mun.slug] = {
                'id': mun.id,
                'name': mun.name,
                'slug': mun.slug,
                'province_id': mun.province_id
            }
    
    # Save municipality IDs
    mun_output_file = project_root / 'data' / 'municipality_ids.json'
    with open(mun_output_file, 'w', encoding='utf-8') as f:
        json.dump(municipality_map, f, indent=2, ensure_ascii=False)
    
    print(f"\n[OK] Exported {len(municipality_map)} municipality IDs to: {mun_output_file}")
    
    # Export Barangay IDs
    print("\n[STEP 2] Exporting Barangay IDs...")
    municipalities = Municipality.query.filter_by(is_active=True).order_by(Municipality.id).all()
    barangay_map = {}
    
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
    
    # Save barangay IDs
    brgy_output_file = project_root / 'data' / 'barangay_ids.json'
    with open(brgy_output_file, 'w', encoding='utf-8') as f:
        json.dump(barangay_map, f, ensure_ascii=False, indent=2)
    
    total_barangays = sum(len(v) for v in barangay_map.values())
    print(f"[OK] Exported {total_barangays} barangay IDs to: {brgy_output_file}")
    
    # Also update web/src/lib/barangay_ids.json if it exists
    web_brgy_file = project_root / 'apps' / 'web' / 'src' / 'lib' / 'barangay_ids.json'
    if web_brgy_file.exists():
        with open(web_brgy_file, 'w', encoding='utf-8') as f:
            json.dump(barangay_map, f, ensure_ascii=False, indent=2)
        print(f"[OK] Updated web frontend barangay IDs: {web_brgy_file}")
    
    # Verify ID consistency
    print("\n[STEP 3] Verifying ID consistency...")
    mismatches = []
    
    for mun_slug, mun_data in municipality_map.items():
        mun_id = mun_data['id']
        barangays = barangay_map.get(mun_slug, [])
        for brgy in barangays:
            if brgy['municipality_id'] != mun_id:
                mismatches.append({
                    'municipality': mun_slug,
                    'barangay': brgy['name'],
                    'expected_mun_id': mun_id,
                    'actual_mun_id': brgy['municipality_id']
                })
    
    if mismatches:
        print(f"[WARNING] Found {len(mismatches)} ID mismatches:")
        for m in mismatches[:10]:  # Show first 10
            print(f"  - {m['municipality']}/{m['barangay']}: expected mun_id {m['expected_mun_id']}, got {m['actual_mun_id']}")
    else:
        print("[OK] All barangay municipality_id values match their municipality IDs")
    
    # Show sample IDs
    print("\n[STEP 4] Sample IDs (first 5 municipalities):")
    for i, (slug, data) in enumerate(list(municipality_map.items())[:5]):
        brgy_count = len(barangay_map.get(slug, []))
        print(f"  [{data['id']:3d}] {data['name']:30s} - {brgy_count} barangays")

print("\n" + "="*60)
print("EXPORT COMPLETE!")
print("="*60)
print("\nStatic JSON files have been updated with production database IDs.")
print("Frontend should now use matching IDs.\n")

