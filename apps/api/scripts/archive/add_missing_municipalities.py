#!/usr/bin/env python3
"""
Add missing municipalities to the database.

This script adds municipalities that exist in the official Region 3 data
but were not included in the initial database seed.

Missing Municipalities:
1. San Luis (Pampanga) - province_id: 5
2. San Antonio (Zambales) - province_id: 7

Run this script after the main database is seeded:
    python apps/api/scripts/add_missing_municipalities.py
"""

import sys
from pathlib import Path

# Ensure project root is importable
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from apps.api.app import create_app
from apps.api import db
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.province import Province


def slugify(name: str) -> str:
    """Convert name to URL-friendly slug."""
    import re
    slug = name.lower()
    # Replace special characters
    slug = slug.replace('ñ', 'n').replace('ü', 'u').replace('ó', 'o')
    slug = slug.replace('.', '').replace("'", '')
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


# Missing municipalities with their barangays
# Data from data/locations/region3_locations.json
MISSING_MUNICIPALITIES = {
    # Pampanga (province_id: 5)
    5: {
        'San Luis': [
            'San Agustin',
            'San Carlos',
            'San Isidro',
            'San Jose',
            'San Juan',
            'San Nicolas',
            'San Roque',
            'San Sebastian',
            'Santa Catalina',
            'Santa Cruz Norte',
            'Santa Cruz Sur',
            'Santa Lucia',
            'Santa Monica',
            'Santa Rita',
            'Santo Niño',
            'Santo Rosario',
            'Santo Tomas',
        ]
    },
    # Zambales (province_id: 7)
    7: {
        'San Antonio': [
            'Angeles',
            'Antipolo',
            'Burgos',
            'East Poblacion',
            'Half Moon',
            'Laoag',
            'Legaspi',
            'Luna',
            'Mabini',
            'Pundaquit',
            'Rizal',
            'San Esteban',
            'San Gregorio',
            'San Juan',
            'San Miguel',
            'San Nicolas',
            'Santiago',
            'West Poblacion',
        ]
    }
}


def add_missing_municipalities():
    """Add missing municipalities and their barangays to the database."""
    app = create_app()
    with app.app_context():
        print("\n" + "=" * 64)
        print("ADDING MISSING MUNICIPALITIES TO DATABASE")
        print("=" * 64 + "\n")

        added_municipalities = 0
        added_barangays = 0

        for province_id, municipalities in MISSING_MUNICIPALITIES.items():
            # Verify province exists
            province = Province.query.get(province_id)
            if not province:
                print(f"ERROR: Province with ID {province_id} not found!")
                continue

            print(f"\nProvince: {province.name} (ID: {province_id})")

            for mun_name, barangays in municipalities.items():
                # Create unique slug to avoid conflicts with same-named municipalities
                base_slug = slugify(mun_name)
                province_suffix = slugify(province.name)
                unique_slug = f"{base_slug}-{province_suffix}"

                # Check if municipality already exists by slug
                existing = Municipality.query.filter_by(slug=unique_slug).first()
                if existing:
                    print(f"  [SKIP] {mun_name} already exists (ID: {existing.id}, slug: {unique_slug})")
                    municipality = existing
                else:
                    # Generate a placeholder PSGC code (Philippine Standard Geographic Code)
                    # Format: Region (03) + Province + Municipality
                    # This is a placeholder - real PSGC codes should be looked up
                    psgc_placeholder = f"03{province_id:02d}99{len(municipalities):02d}"
                    
                    # Use unique name with province to avoid name collision
                    # e.g., "San Luis (Pampanga)" to differentiate from "San Luis (Aurora)"
                    unique_name = f"{mun_name} ({province.name})"
                    
                    # Create new municipality
                    municipality = Municipality(
                        name=unique_name,  # Unique name with province
                        slug=unique_slug,
                        province_id=province_id,
                        psgc_code=psgc_placeholder,  # Required field
                        is_active=True
                    )
                    db.session.add(municipality)
                    db.session.flush()  # Get the ID
                    print(f"  [ADDED] {unique_name} (ID: {municipality.id}, slug: {unique_slug}, psgc: {psgc_placeholder})")
                    added_municipalities += 1

                # Add barangays
                for brgy_idx, brgy_name in enumerate(barangays):
                    brgy_slug = slugify(brgy_name)
                    # Check if barangay already exists for this municipality
                    existing_brgy = Barangay.query.filter_by(
                        municipality_id=municipality.id,
                        slug=brgy_slug
                    ).first()
                    if existing_brgy:
                        continue  # Skip existing
                    
                    # Generate placeholder PSGC code for barangay
                    brgy_psgc = f"03{province_id:02d}{municipality.id:03d}{brgy_idx+1:03d}"
                    
                    barangay = Barangay(
                        name=brgy_name,
                        slug=brgy_slug,
                        municipality_id=municipality.id,
                        psgc_code=brgy_psgc  # Required field
                    )
                    db.session.add(barangay)
                    added_barangays += 1

        db.session.commit()

        print("\n" + "-" * 64)
        print(f"SUMMARY:")
        print(f"  Municipalities added: {added_municipalities}")
        print(f"  Barangays added: {added_barangays}")
        print("=" * 64 + "\n")

        # Show updated IDs for frontend
        print("Updated Municipality IDs (for locations.ts):")
        for province_id, municipalities in MISSING_MUNICIPALITIES.items():
            province = Province.query.get(province_id)
            for mun_name in municipalities.keys():
                base_slug = slugify(mun_name)
                province_suffix = slugify(province.name)
                unique_slug = f"{base_slug}-{province_suffix}"
                mun = Municipality.query.filter_by(slug=unique_slug).first()
                if mun:
                    print(f'  "{unique_slug}": {mun.id},  // {mun_name} ({province.name})')


if __name__ == '__main__':
    add_missing_municipalities()

