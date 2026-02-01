#!/usr/bin/env python
"""
Delete all programs and repopulate with new tag-based eligibility programs.
Uses raw SQL to avoid Flask-SQLAlchemy complications.
"""
import os
import sys
import json
from datetime import datetime

# Load environment variables
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
project_root = Path(__file__).parent.parent.parent
env_path = project_root / '.env'
if env_path.exists():
    load_dotenv(env_path)

# Get database URL
DATABASE_URL = os.environ.get('DATABASE_URL', '')

if not DATABASE_URL or 'postgresql' not in DATABASE_URL:
    print("ERROR: DATABASE_URL not set or not PostgreSQL!")
    print(f"Current value: {DATABASE_URL[:50]}..." if DATABASE_URL else "Not set")
    print("\nPlease ensure DATABASE_URL is set in your .env file")
    sys.exit(1)

print(f"Database: PostgreSQL (Supabase)")

# Use psycopg2 for direct PostgreSQL connection
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Installing psycopg2-binary...")
    os.system('pip install psycopg2-binary')
    import psycopg2
    from psycopg2.extras import RealDictCursor

# Connect to database
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 60)
print("PROGRAM REPOPULATION SCRIPT")
print("=" * 60)

# Get municipalities
cur.execute("SELECT id, name, slug FROM municipalities ORDER BY id")
municipalities = cur.fetchall()
print(f"\nFound {len(municipalities)} municipalities:")
for m in municipalities:
    print(f"  - ID: {m['id']}, Name: {m['name']}, Slug: {m['slug']}")

# Current counts
cur.execute("SELECT COUNT(*) as cnt FROM benefit_programs")
prog_count = cur.fetchone()['cnt']
cur.execute("SELECT COUNT(*) as cnt FROM benefit_applications")
app_count = cur.fetchone()['cnt']
print(f"\nCurrent data: {prog_count} programs, {app_count} applications")

print("\n" + "!" * 60)
print("WARNING: This will DELETE ALL existing programs and applications!")
print("!" * 60)

# Allow --yes flag to skip confirmation
if '--yes' in sys.argv:
    confirm = 'DELETE'
    print("\n--yes flag provided, skipping confirmation...")
else:
    try:
        confirm = input("\nType 'DELETE' to confirm: ")
    except EOFError:
        print("\nNo interactive input available. Use --yes flag to confirm.")
        conn.close()
        sys.exit(1)

if confirm != 'DELETE':
    print("Aborted.")
    conn.close()
    sys.exit(0)

try:
    # Delete all applications first (foreign key)
    print(f"\nDeleting {app_count} applications...")
    cur.execute("DELETE FROM benefit_applications")
    
    # Delete all programs
    print(f"Deleting {prog_count} programs...")
    cur.execute("DELETE FROM benefit_programs")
    conn.commit()
    print("Done!")
    
    # Program templates with tag-based eligibility
    templates = [
        {
            'name': 'Senior Citizen Cash Assistance',
            'code': 'SCCA',
            'description': 'Monthly cash assistance program for senior citizens aged 60 and above. Provides financial support for basic needs including food, medicine, and utilities. Beneficiaries receive monthly stipends to improve their quality of life.',
            'program_type': 'financial',
            'duration_days': 365,
            'eligibility_criteria': {'age_min': 60, 'location_required': True},
            'required_documents': ['Senior Citizen ID', 'Valid Government ID', 'Proof of Residence']
        },
        {
            'name': 'Youth Skills Training Program',
            'code': 'YSTP',
            'description': 'Free vocational skills training for youth aged 18-30. Includes computer literacy, technical skills, and entrepreneurship courses with TESDA certification.',
            'program_type': 'educational',
            'duration_days': 180,
            'eligibility_criteria': {'age_min': 18, 'age_max': 30, 'location_required': True},
            'required_documents': ['Birth Certificate', 'Barangay Clearance', 'Valid ID']
        },
        {
            'name': 'PWD Medical Assistance',
            'code': 'PWDMA',
            'description': 'Healthcare support for Persons with Disabilities covering consultations, laboratory tests, medications, and assistive devices.',
            'program_type': 'health',
            'duration_days': 365,
            'eligibility_criteria': {'location_required': True},
            'required_documents': ['PWD ID', 'Medical Certificate', 'Prescription/Medical Records']
        },
        {
            'name': 'Livelihood Starter Kit',
            'code': 'LSK',
            'description': 'Starter kit for aspiring entrepreneurs including equipment, materials, and initial capital. Includes business orientation and mentorship.',
            'program_type': 'livelihood',
            'duration_days': 90,
            'eligibility_criteria': {'age_min': 21, 'location_required': True},
            'required_documents': ['Business Plan', 'Valid ID', 'Barangay Clearance', 'Certificate of Indigency']
        },
        {
            'name': 'Solo Parent Support Program',
            'code': 'SPSP',
            'description': 'Financial and social support for solo parents including monthly allowance, priority government services, and skills training.',
            'program_type': 'financial',
            'duration_days': 365,
            'eligibility_criteria': {'age_min': 18, 'location_required': True},
            'required_documents': ['Solo Parent ID', 'Birth Certificate of Children', 'Valid ID']
        },
        {
            'name': 'Educational Scholarship Grant',
            'code': 'ESG',
            'description': 'Scholarship for students from low-income families covering tuition, supplies, and monthly allowance for elementary to college students.',
            'program_type': 'educational',
            'duration_days': 300,
            'eligibility_criteria': {'age_min': 6, 'age_max': 25, 'location_required': True},
            'required_documents': ['Report Card', 'Certificate of Enrollment', 'Certificate of Indigency', 'Birth Certificate']
        },
        {
            'name': 'Emergency Medical Fund',
            'code': 'EMF',
            'description': 'Emergency financial assistance for medical emergencies including hospitalization and critical procedures.',
            'program_type': 'health',
            'duration_days': None,
            'eligibility_criteria': {'location_required': True},
            'required_documents': ['Medical Certificate', 'Hospital Bill', 'Valid ID', 'Barangay Certificate']
        },
        {
            'name': 'Farmers Assistance Program',
            'code': 'FAP',
            'description': 'Support for local farmers including seeds, fertilizers, equipment, and agricultural training.',
            'program_type': 'livelihood',
            'duration_days': 180,
            'eligibility_criteria': {'age_min': 18, 'location_required': True},
            'required_documents': ['Farm Registration', 'Valid ID', 'Barangay Clearance']
        },
        {
            'name': 'Community Development Grant',
            'code': 'CDG',
            'description': 'Open grant for community projects and initiatives. No eligibility restrictions - open to all registered residents who want to propose community improvements.',
            'program_type': 'general',
            'duration_days': 120,
            'eligibility_criteria': None,
            'required_documents': ['Project Proposal', 'Budget Plan', 'Barangay Endorsement']
        },
        {
            'name': 'Women Empowerment Program',
            'code': 'WEP',
            'description': 'Skills development and livelihood program for women including handicrafts, food processing, and entrepreneurship training with starter kits.',
            'program_type': 'livelihood',
            'duration_days': 90,
            'eligibility_criteria': {'age_min': 18, 'location_required': True},
            'required_documents': ['Valid ID', 'Barangay Clearance']
        }
    ]
    
    # Create programs for each municipality
    count = 0
    now = datetime.now(datetime.UTC) if hasattr(datetime, 'UTC') else datetime.utcnow()
    
    insert_sql = """
        INSERT INTO benefit_programs (
            name, code, description, program_type, municipality_id,
            duration_days, eligibility_criteria, required_documents,
            is_active, is_accepting_applications, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """
    
    # Track used codes to avoid duplicates
    used_codes = set()
    
    for m in municipalities:
        # Use municipality ID for unique codes
        slug_part = str(m['id']).zfill(3)
        print(f"\nCreating programs for {m['name']} (ID: {m['id']})...")
        
        for t in templates:
            code = f"{t['code']}-{slug_part}"
            cur.execute(insert_sql, (
                t['name'],
                code,
                t['description'],
                t['program_type'],
                m['id'],
                t['duration_days'],
                json.dumps(t['eligibility_criteria']) if t['eligibility_criteria'] else None,
                json.dumps(t['required_documents']),
                True,
                True,
                now,
                now
            ))
            count += 1
            print(f"  + {t['name']} ({code})")
    
    conn.commit()
    
    print("\n" + "=" * 60)
    print(f"SUCCESS! Created {count} programs for {len(municipalities)} municipalities")
    print("=" * 60)
    print("\nNote: Programs created without images. Edit in admin panel to add images.")
    
except Exception as e:
    conn.rollback()
    print(f"\nERROR: {e}")
    raise
finally:
    cur.close()
    conn.close()
