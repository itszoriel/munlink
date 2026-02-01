#!/usr/bin/env python3
"""
PSGC Location Sync Script

Parses the official PSGC (Philippine Standard Geographic Code) Excel file,
extracts Region 3 data, and syncs to both DEV and PROD databases.
Also generates updated frontend location files.

Usage:
    python scripts/psgc_sync.py
"""

import json
import os
import re
import sys
from pathlib import Path

import openpyxl
import psycopg2
from psycopg2.extras import RealDictCursor

# Database connections
DATABASES = {
    'DEV': 'postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'PROD': 'postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
}

# HUC (Highly Urbanized Cities) province mapping
# These cities have different PSGC codes but belong to specific provinces
HUC_PROVINCE_MAPPING = {
    '03301': '03054',  # City of Angeles -> Pampanga
    '03314': '03071',  # City of Olongapo -> Zambales
}

# File paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
PSGC_FILE = PROJECT_ROOT / 'data' / 'PSGC-July-2025-Publication-Datafile.xlsx'
WEB_LOCATIONS_TS = PROJECT_ROOT / 'apps' / 'web' / 'src' / 'lib' / 'locations.ts'
WEB_BARANGAY_JSON = PROJECT_ROOT / 'apps' / 'web' / 'src' / 'lib' / 'barangay_ids.json'
ADMIN_LOCATIONS_TS = PROJECT_ROOT / 'apps' / 'admin' / 'src' / 'lib' / 'locations.ts'
ADMIN_BARANGAY_JSON = PROJECT_ROOT / 'apps' / 'admin' / 'src' / 'lib' / 'barangay_ids.json'


def slugify(name: str) -> str:
    """Convert name to URL-friendly slug."""
    # Handle special characters
    slug = name.lower()
    slug = slug.replace('ñ', 'n')
    slug = slug.replace('ü', 'u')
    slug = slug.replace('ö', 'o')
    # Remove parenthetical content
    slug = re.sub(r'\s*\([^)]*\)', '', slug)
    # Replace special chars with hyphen
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    # Clean up hyphens
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug


def parse_psgc_excel():
    """Parse the PSGC Excel file and extract Region 3 data."""
    print(f"Reading PSGC file: {PSGC_FILE}")
    
    wb = openpyxl.load_workbook(PSGC_FILE, read_only=True)
    ws = wb['PSGC']
    
    provinces = []
    municipalities = []
    barangays = []
    
    current_province_id = 0
    current_municipality_id = 0
    province_code_to_id = {}
    municipality_code_to_id = {}
    
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0] or not str(row[0]).startswith('03'):
            continue
            
        psgc_code = str(row[0])
        name = str(row[1]).strip() if row[1] else ''
        level = row[3]
        
        if level == 'Prov':
            current_province_id += 1
            province_code_to_id[psgc_code[:5]] = current_province_id
            provinces.append({
                'id': current_province_id,
                'name': name,
                'slug': slugify(name),
                'psgc_code': psgc_code,
                'region_code': '03',
                'region_name': 'Central Luzon',
            })
            
        elif level in ('Mun', 'City'):
            current_municipality_id += 1
            province_code = psgc_code[:5]
            
            # Handle HUCs (Highly Urbanized Cities) with different province codes
            if province_code in HUC_PROVINCE_MAPPING:
                province_code = HUC_PROVINCE_MAPPING[province_code]
            
            province_id = province_code_to_id.get(province_code)
            
            if not province_id:
                print(f"  WARNING: No province found for municipality {name} (code: {psgc_code})")
                continue
            
            municipality_code_to_id[psgc_code[:7]] = current_municipality_id
            
            # Create slug - handle duplicates by adding province suffix
            base_slug = slugify(name)
            
            municipalities.append({
                'id': current_municipality_id,
                'name': name,
                'slug': base_slug,
                'province_id': province_id,
                'psgc_code': psgc_code,
            })
            
        elif level == 'Bgy':
            municipality_code = psgc_code[:7]
            municipality_id = municipality_code_to_id.get(municipality_code)
            
            if not municipality_id:
                print(f"  WARNING: No municipality found for barangay {name} (code: {psgc_code})")
                continue
            
            barangays.append({
                'id': len(barangays) + 1,
                'name': name,
                'slug': slugify(name),
                'municipality_id': municipality_id,
                'psgc_code': psgc_code,
            })
    
    # Handle duplicate municipality names AND slugs by adding province suffix
    # This is needed because some databases have unique constraint on name
    name_counts = {}
    slug_counts = {}
    for muni in municipalities:
        name_counts[muni['name']] = name_counts.get(muni['name'], 0) + 1
        slug_counts[muni['slug']] = slug_counts.get(muni['slug'], 0) + 1
    
    duplicate_names = {name for name, count in name_counts.items() if count > 1}
    duplicate_slugs = {slug for slug, count in slug_counts.items() if count > 1}
    
    province_id_to_name = {p['id']: p['name'] for p in provinces}
    province_id_to_slug = {p['id']: p['slug'] for p in provinces}
    
    for muni in municipalities:
        if muni['name'] in duplicate_names:
            province_name = province_id_to_name[muni['province_id']]
            muni['name'] = f"{muni['name']} ({province_name})"
        if muni['slug'] in duplicate_slugs:
            province_slug = province_id_to_slug[muni['province_id']]
            muni['slug'] = f"{muni['slug']}-{province_slug}"
    
    if duplicate_names:
        print(f"  Note: Added province suffix to {len(duplicate_names)} duplicate municipality names: {', '.join(sorted(duplicate_names))}")
    
    print(f"  Parsed: {len(provinces)} provinces, {len(municipalities)} municipalities, {len(barangays)} barangays")
    
    return provinces, municipalities, barangays


def clear_and_seed_database(db_name: str, db_url: str, provinces, municipalities, barangays):
    """Clear existing data and seed with new PSGC data."""
    print(f"\n{'='*60}")
    print(f"Syncing {db_name} database")
    print('='*60)
    
    conn = psycopg2.connect(db_url)
    
    try:
        cur = conn.cursor()
        
        # Step 1: Clear user location references (separate transaction)
        print("  Step 1: Clearing user location references...")
        cur.execute("SELECT COUNT(*) FROM users WHERE municipality_id IS NOT NULL OR barangay_id IS NOT NULL OR admin_municipality_id IS NOT NULL")
        user_count = cur.fetchone()[0]
        if user_count > 0:
            print(f"    {user_count} users have location references")
            cur.execute("UPDATE users SET municipality_id = NULL, barangay_id = NULL, admin_municipality_id = NULL")
            conn.commit()
            print(f"    Cleared")
        else:
            conn.commit()
            print(f"    No users to clear")
        
        # Step 2: Schema is handled by adding province suffix to duplicate names
        print("  Step 2: Schema ready (duplicate names handled via province suffix)")
        
        # Step 3: Clear existing data (in order due to foreign keys)
        print("  Step 3: Clearing existing location data...")
        cur.execute("DELETE FROM barangays")
        print("    Deleted barangays")
        cur.execute("DELETE FROM municipalities")
        print("    Deleted municipalities")
        cur.execute("DELETE FROM provinces")
        print("    Deleted provinces")
        conn.commit()
        
        # Step 4: Insert provinces
        print("  Step 4: Inserting provinces...")
        for p in provinces:
            cur.execute("""
                INSERT INTO provinces (id, name, slug, psgc_code, region_code, region_name)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (p['id'], p['name'], p['slug'], p['psgc_code'], p['region_code'], p['region_name']))
        conn.commit()
        print(f"    Inserted {len(provinces)} provinces")
        
        # Step 5: Insert municipalities
        print("  Step 5: Inserting municipalities...")
        for m in municipalities:
            cur.execute("""
                INSERT INTO municipalities (id, name, slug, province_id, psgc_code)
                VALUES (%s, %s, %s, %s, %s)
            """, (m['id'], m['name'], m['slug'], m['province_id'], m['psgc_code']))
        conn.commit()
        print(f"    Inserted {len(municipalities)} municipalities")
        
        # Step 6: Insert barangays in batches
        print("  Step 6: Inserting barangays...")
        batch_size = 500
        for i in range(0, len(barangays), batch_size):
            batch = barangays[i:i+batch_size]
            for b in batch:
                cur.execute("""
                    INSERT INTO barangays (id, name, slug, municipality_id, psgc_code)
                    VALUES (%s, %s, %s, %s, %s)
                """, (b['id'], b['name'], b['slug'], b['municipality_id'], b['psgc_code']))
            conn.commit()
            print(f"    Inserted {min(i+batch_size, len(barangays))}/{len(barangays)} barangays")
        
        # Step 7: Reset sequences
        print("  Step 7: Resetting sequences...")
        cur.execute("SELECT setval('provinces_id_seq', (SELECT MAX(id) FROM provinces), true)")
        cur.execute("SELECT setval('municipalities_id_seq', (SELECT MAX(id) FROM municipalities), true)")
        cur.execute("SELECT setval('barangays_id_seq', (SELECT MAX(id) FROM barangays), true)")
        conn.commit()
        
        print(f"\n  SUCCESS: {db_name} database synced!")
        print(f"    - {len(provinces)} provinces")
        print(f"    - {len(municipalities)} municipalities")
        print(f"    - {len(barangays)} barangays")
        
    except Exception as e:
        conn.rollback()
        print(f"  ERROR: {e}")
        raise
    finally:
        conn.close()


def generate_frontend_files(provinces, municipalities, barangays):
    """Generate updated frontend location files."""
    print(f"\n{'='*60}")
    print("Generating frontend files")
    print('='*60)
    
    # Create province lookup
    province_id_to_data = {p['id']: p for p in provinces}
    
    # Create municipality lookup by province
    municipalities_by_province = {}
    for m in municipalities:
        prov_id = m['province_id']
        if prov_id not in municipalities_by_province:
            municipalities_by_province[prov_id] = []
        municipalities_by_province[prov_id].append(m)
    
    # Create barangay data grouped by municipality slug
    municipality_id_to_slug = {m['id']: m['slug'] for m in municipalities}
    barangay_data = {}
    for b in barangays:
        muni_slug = municipality_id_to_slug.get(b['municipality_id'])
        if muni_slug:
            if muni_slug not in barangay_data:
                barangay_data[muni_slug] = []
            barangay_data[muni_slug].append({
                'id': b['id'],
                'name': b['name'],
                'slug': b['slug'],
                'municipality_id': b['municipality_id'],
            })
    
    # Sort barangays alphabetically
    for slug in barangay_data:
        barangay_data[slug].sort(key=lambda x: x['name'])
    
    # Generate locations.ts content
    locations_ts = generate_locations_ts(provinces, municipalities, municipalities_by_province)
    
    # Write files
    for locations_path in [WEB_LOCATIONS_TS, ADMIN_LOCATIONS_TS]:
        print(f"  Writing: {locations_path}")
        locations_path.write_text(locations_ts, encoding='utf-8')
    
    barangay_json = json.dumps(barangay_data, indent=2, ensure_ascii=False)
    for barangay_path in [WEB_BARANGAY_JSON, ADMIN_BARANGAY_JSON]:
        print(f"  Writing: {barangay_path}")
        barangay_path.write_text(barangay_json, encoding='utf-8')
    
    print("  Frontend files generated successfully!")


def generate_locations_ts(provinces, municipalities, municipalities_by_province):
    """Generate the locations.ts TypeScript file content."""
    
    # Generate province array string
    province_entries = []
    for p in sorted(provinces, key=lambda x: x['id']):
        province_entries.append(
            f"  {{ id: {p['id']}, name: '{p['name']}', slug: '{p['slug']}', region_name: 'Central Luzon' }}"
        )
    provinces_str = ',\n'.join(province_entries)
    
    # Generate municipality ID mapping
    muni_id_entries = []
    for m in sorted(municipalities, key=lambda x: x['id']):
        muni_id_entries.append(f'  "{m["slug"]}": {m["id"]}')
    muni_ids_str = ',\n'.join(muni_id_entries)
    
    # Generate municipalities data by province
    muni_data_entries = []
    for prov in sorted(provinces, key=lambda x: x['id']):
        prov_id = prov['id']
        prov_munis = municipalities_by_province.get(prov_id, [])
        muni_list = []
        for m in sorted(prov_munis, key=lambda x: x['name']):
            # Escape single quotes in names
            name = m['name'].replace("'", "\\'")
            muni_list.append(f"    {{ name: '{name}', slug: '{m['slug']}', province_id: {prov_id} }}")
        munis_str = ',\n'.join(muni_list)
        muni_data_entries.append(f"  // {prov['name']} (province_id: {prov_id}) - {len(prov_munis)} municipalities\n  {prov_id}: [\n{munis_str},\n  ]")
    
    muni_data_str = ',\n'.join(muni_data_entries)
    
    # Province IDs for the loop
    province_ids = ', '.join(str(p['id']) for p in sorted(provinces, key=lambda x: x['id']))
    
    return f'''/**
 * Static location data for Region 3 (Central Luzon).
 * Auto-generated from PSGC July 2025 data by scripts/psgc_sync.py
 * 
 * DO NOT EDIT MANUALLY - Run psgc_sync.py to regenerate
 */

import type {{ Province, Municipality }} from './store'

// Barangay type
export type Barangay = {{
  id: number
  name: string
  slug: string
  municipality_id: number
}}

// Import static barangay data (mapped by municipality slug)
import barangayData from './barangay_ids.json'

// Province data from PSGC
export const PROVINCES: Province[] = [
{provinces_str},
]

// Municipality ID mapping (slug -> database ID)
const DB_MUNICIPALITY_IDS: Record<string, number> = {{
{muni_ids_str},
}}

// Municipality data organized by province ID
const MUNICIPALITIES_DATA: Record<number, Omit<Municipality, 'id'>[]> = {{
{muni_data_str},
}}

// Generate municipalities with real database IDs
export const MUNICIPALITIES: Municipality[] = []

for (const provinceId of [{province_ids}]) {{
  const provinceMunicipalities = MUNICIPALITIES_DATA[provinceId] || []
  for (const mun of provinceMunicipalities) {{
    const dbId = DB_MUNICIPALITY_IDS[mun.slug]
    if (!dbId) {{
      console.warn(`[locations.ts] No DB ID found for municipality slug: ${{mun.slug}}`)
    }}
    MUNICIPALITIES.push({{
      id: dbId || 0,
      ...mun,
    }})
  }}
}}

// Validate that all municipalities have valid IDs (dev helper)
if (typeof window !== 'undefined' && import.meta.env.DEV) {{
  const missingIds = MUNICIPALITIES.filter(m => m.id === 0)
  if (missingIds.length > 0) {{
    console.warn('[locations.ts] Municipalities missing DB IDs:', missingIds.map(m => m.slug))
  }}
}}

/**
 * Get all provinces (static data, instant load)
 */
export function getProvinces(): Province[] {{
  return PROVINCES
}}

/**
 * Get municipalities filtered by province ID (static data, instant load)
 */
export function getMunicipalities(provinceId?: number): Municipality[] {{
  if (!provinceId) {{
    return MUNICIPALITIES
  }}
  return MUNICIPALITIES.filter(m => m.province_id === provinceId)
}}

/**
 * Get a province by ID
 */
export function getProvinceById(id: number): Province | undefined {{
  return PROVINCES.find(p => p.id === id)
}}

/**
 * Get a province by slug
 */
export function getProvinceBySlug(slug: string): Province | undefined {{
  return PROVINCES.find(p => p.slug === slug.toLowerCase())
}}

/**
 * Get a municipality by ID
 */
export function getMunicipalityById(id: number): Municipality | undefined {{
  return MUNICIPALITIES.find(m => m.id === id)
}}

/**
 * Get a municipality by slug
 */
export function getMunicipalityBySlug(slug: string): Municipality | undefined {{
  return MUNICIPALITIES.find(m => m.slug === slug.toLowerCase())
}}

// Static barangay data mapping
const DB_BARANGAY_IDS: Record<string, Barangay[]> = barangayData as any

/**
 * Get barangays by municipality slug (static data, instant load)
 */
export function getBarangaysByMunicipalitySlug(municipalitySlug: string): Barangay[] {{
  const slug = municipalitySlug.toLowerCase()
  return DB_BARANGAY_IDS[slug] || []
}}

/**
 * Get barangays by municipality ID (static data, instant load)
 */
export function getBarangaysByMunicipalityId(municipalityId: number): Barangay[] {{
  const municipality = getMunicipalityById(municipalityId)
  if (!municipality) return []
  return getBarangaysByMunicipalitySlug(municipality.slug)
}}
'''


def main():
    print("="*60)
    print("PSGC LOCATION SYNC")
    print("="*60)
    print(f"Source: {PSGC_FILE}")
    print()
    
    # Step 1: Parse PSGC Excel
    provinces, municipalities, barangays = parse_psgc_excel()
    
    # Step 2: Sync to both databases
    for db_name, db_url in DATABASES.items():
        clear_and_seed_database(db_name, db_url, provinces, municipalities, barangays)
    
    # Step 3: Generate frontend files
    generate_frontend_files(provinces, municipalities, barangays)
    
    print(f"\n{'='*60}")
    print("SYNC COMPLETE!")
    print("="*60)
    print(f"Total: {len(provinces)} provinces, {len(municipalities)} municipalities, {len(barangays)} barangays")
    print("\nBoth DEV and PROD databases are now synced with official PSGC data.")
    print("Frontend location files have been regenerated.")


if __name__ == '__main__':
    confirm = input("This will DELETE all location data and reseed from PSGC. Continue? (yes/no): ")
    if confirm.lower() == 'yes':
        main()
    else:
        print("Aborted.")

