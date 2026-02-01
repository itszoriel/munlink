#!/usr/bin/env python3
"""
Export municipality IDs from database to update static locations.ts file.
This ensures frontend static data uses real database IDs.
"""

import sys
import os
import json
from pathlib import Path

# Ensure project root is importable
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from apps.api.app import create_app
from apps.api.models.municipality import Municipality
from apps.api.models.province import Province

def export_municipality_ids():
    app = create_app()
    with app.app_context():
        print("\n" + "=" * 64)
        print("EXPORTING MUNICIPALITY IDs FROM DATABASE")
        print("=" * 64 + "\n")
        
        # Get all provinces ordered by ID
        provinces = Province.query.order_by(Province.id).all()
        
        # Build mapping: slug -> {id, name, province_id}
        municipality_map = {}
        
        for province in provinces:
            municipalities = Municipality.query.filter_by(
                province_id=province.id,
                is_active=True
            ).order_by(Municipality.name).all()
            
            print(f"Province {province.id}: {province.name} ({len(municipalities)} municipalities)")
            
            for mun in municipalities:
                municipality_map[mun.slug] = {
                    'id': mun.id,
                    'name': mun.name,
                    'slug': mun.slug,
                    'province_id': mun.province_id
                }
                print(f"  [{mun.id:3d}] {mun.name:30s} (slug: {mun.slug})")
        
        print(f"\nTotal municipalities: {len(municipality_map)}")
        
        # Save to JSON file for reference
        output_file = PROJECT_ROOT / 'data' / 'municipality_ids.json'
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(municipality_map, f, indent=2, ensure_ascii=False)
        
        print(f"\nMunicipality IDs exported to: {output_file}")
        print("\n" + "=" * 64 + "\n")
        
        return municipality_map

if __name__ == '__main__':
    export_municipality_ids()

