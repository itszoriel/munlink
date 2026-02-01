#!/usr/bin/env python3
"""
Export barangay IDs from database to create static data.
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
from apps.api.models.municipality import Municipality, Barangay

def export_barangay_ids():
    app = create_app()
    with app.app_context():
        print("\n" + "=" * 64)
        print("EXPORTING BARANGAY IDs FROM DATABASE")
        print("=" * 64 + "\n")
        
        # Get all municipalities
        municipalities = Municipality.query.filter_by(is_active=True).order_by(Municipality.id).all()
        
        # Build mapping: municipality_slug -> [{id, name, slug, municipality_id}]
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
            
            print(f"[{mun.id:3d}] {mun.name:30s} ({len(barangays)} barangays)")
        
        # Save to JSON
        output_file = PROJECT_ROOT / 'data' / 'barangay_ids.json'
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(barangay_map, f, ensure_ascii=False, indent=2)
        
        total = sum(len(v) for v in barangay_map.values())
        print(f"\nTotal barangays: {total}")
        print(f"\nBarangay IDs exported to: {output_file}")
        print("\n" + "=" * 64 + "\n")

if __name__ == '__main__':
    export_barangay_ids()


