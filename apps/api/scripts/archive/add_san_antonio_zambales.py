"""
Add San Antonio to Zambales in the database and fix locations.ts
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

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
print("ADDING SAN ANTONIO TO ZAMBALES")
print("="*70)

with app.app_context():
    # Get Zambales province
    zambales = Province.query.filter_by(name='Zambales').first()
    if not zambales:
        print("[ERROR] Zambales province not found!")
        sys.exit(1)
    
    # Check if San Antonio already exists
    san_antonio = Municipality.query.filter_by(
        province_id=zambales.id,
        name='San Antonio',
        is_active=True
    ).first()
    
    if san_antonio:
        print(f"\n[INFO] San Antonio already exists in database!")
        print(f"  ID: {san_antonio.id}, Slug: {san_antonio.slug}")
    else:
        print("\n[STEP 1] Adding San Antonio to database...")
        
        # Read barangays from region3_locations.json
        region3_file = Path(project_root) / 'data' / 'locations' / 'region3_locations.json'
        if not region3_file.exists():
            print(f"[ERROR] Region 3 data file not found: {region3_file}")
            sys.exit(1)
        
        with open(region3_file, 'r', encoding='utf-8') as f:
            region3_data = json.load(f)
        
        zambales_data = region3_data.get('Zambales', {})
        san_antonio_barangays = zambales_data.get('San Antonio', [])
        
        if not san_antonio_barangays:
            print("[ERROR] San Antonio barangays not found in region3_locations.json")
            sys.exit(1)
        
        print(f"  Found {len(san_antonio_barangays)} barangays for San Antonio")
        
        # Create municipality
        san_antonio = Municipality(
            name='San Antonio',
            slug='san-antonio',
            province_id=zambales.id,
            psgc_code='037111000',  # From seed_data.py
            description='Home to Pundaquit Beach',
            is_active=True
        )
        
        db.session.add(san_antonio)
        db.session.flush()  # Get the ID
        
        # Create barangays
        for brgy_name in san_antonio_barangays:
            brgy_slug = brgy_name.lower().replace(' ', '-').replace("'", '').replace('.', '')
            barangay = Barangay(
                name=brgy_name,
                slug=brgy_slug,
                municipality_id=san_antonio.id,
                psgc_code=f'{san_antonio.psgc_code}{len(san_antonio.barangays) + 1:03d}',  # Placeholder
                is_active=True
            )
            db.session.add(barangay)
        
        db.session.commit()
        print(f"  [OK] Created San Antonio with ID {san_antonio.id} and {len(san_antonio_barangays)} barangays")
    
    # Update locations.ts
    print("\n[STEP 2] Updating locations.ts...")
    locations_ts = Path(project_root) / 'apps' / 'web' / 'src' / 'lib' / 'locations.ts'
    
    if not locations_ts.exists():
        print(f"[ERROR] locations.ts not found: {locations_ts}")
        sys.exit(1)
    
    with open(locations_ts, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if san-antonio is already in DB_MUNICIPALITY_IDS
    if '"san-antonio":' in content and 'zambales' in content[content.find('"san-antonio"'):content.find('"san-antonio"') + 200].lower():
        print("  [INFO] san-antonio already in DB_MUNICIPALITY_IDS")
    else:
        # Add to DB_MUNICIPALITY_IDS in Zambales section
        zambales_section_start = content.find('// Zambales')
        if zambales_section_start != -1:
            # Find the closing brace of Zambales section
            zambales_section_end = content.find('}', zambales_section_start)
            zambales_section = content[zambales_section_start:zambales_section_end]
            
            # Check if san-antonio is already there
            if '"san-antonio":' not in zambales_section:
                # Add before the closing brace
                insert_pos = zambales_section_end
                new_entry = f'  "san-antonio": {san_antonio.id}, // San Antonio (Zambales)\n'
                
                # Find the last entry before closing brace
                last_entry_pos = content.rfind('",', zambales_section_start, zambales_section_end)
                if last_entry_pos != -1:
                    # Insert after the last entry
                    insert_pos = content.find('\n', last_entry_pos) + 1
                    content = content[:insert_pos] + new_entry + content[insert_pos:]
                    print(f"  [OK] Added san-antonio to DB_MUNICIPALITY_IDS with ID {san_antonio.id}")
                else:
                    print("  [WARNING] Could not find insertion point for DB_MUNICIPALITY_IDS")
            else:
                print("  [INFO] san-antonio already in DB_MUNICIPALITY_IDS")
    
    # Fix the slug in MUNICIPALITIES_DATA (change san-antonio-zambales to san-antonio)
    if 'san-antonio-zambales' in content:
        content = content.replace('san-antonio-zambales', 'san-antonio')
        print("  [OK] Fixed slug from san-antonio-zambales to san-antonio")
    
    # Write updated file
    with open(locations_ts, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n[OK] locations.ts updated!")
    
    print("\n" + "="*70)
    print("COMPLETE!")
    print("="*70)
    print(f"\nSan Antonio (Zambales) has been added:")
    print(f"  Database ID: {san_antonio.id}")
    print(f"  Slug: san-antonio")
    print(f"  Barangays: {len(san_antonio.barangays)}")
    print("\nlocations.ts has been updated to include San Antonio.\n")

















