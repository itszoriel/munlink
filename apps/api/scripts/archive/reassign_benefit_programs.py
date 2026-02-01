"""
Attempt to reassign benefit_programs to municipalities.
Since we don't have a direct mapping, we'll check if there's any pattern
in the program code or name that might indicate municipality.
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Ensure project root is importable
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Load environment variables from .env file
env_path = Path(project_root) / '.env'
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
from apps.api import db
from apps.api.models.benefit import BenefitProgram
from apps.api.models.municipality import Municipality
from sqlalchemy import text

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*70)
print("CHECKING BENEFIT PROGRAMS MUNICIPALITY ASSIGNMENT")
print("="*70)

with app.app_context():
    # Check current state
    total_programs = BenefitProgram.query.count()
    programs_with_municipality = BenefitProgram.query.filter(
        BenefitProgram.municipality_id.isnot(None)
    ).count()
    programs_without_municipality = BenefitProgram.query.filter(
        BenefitProgram.municipality_id.is_(None)
    ).count()
    
    print(f"\nCurrent State:")
    print(f"  Total programs: {total_programs}")
    print(f"  Programs with municipality_id: {programs_with_municipality}")
    print(f"  Programs without municipality_id (NULL): {programs_without_municipality}")
    
    if programs_without_municipality == 0:
        print("\n[OK] All programs are already assigned to municipalities!")
        print("No action needed.\n")
    else:
        print(f"\n[INFO] {programs_without_municipality} programs need municipality assignment.")
        print("\nOptions:")
        print("1. Leave them NULL - Admins can manually assign in the admin panel")
        print("2. Try to match by program code/name pattern (if any pattern exists)")
        print("3. Assign all to a default municipality (not recommended)")
        
        # Check if there's any pattern in program codes
        print("\n" + "="*70)
        print("ANALYZING PROGRAM CODES FOR PATTERNS")
        print("="*70)
        
        programs = BenefitProgram.query.filter(
            BenefitProgram.municipality_id.is_(None)
        ).limit(20).all()
        
        if programs:
            print("\nSample programs without municipality_id:")
            for prog in programs[:10]:
                print(f"  - ID {prog.id}: {prog.name} (Code: {prog.code})")
        
        # Check if program codes contain municipality slugs
        municipalities = Municipality.query.filter_by(is_active=True).all()
        mun_slugs = {mun.slug: mun for mun in municipalities}
        mun_names_lower = {mun.name.lower(): mun for mun in municipalities}
        
        print("\n" + "="*70)
        print("ATTEMPTING TO MATCH PROGRAMS TO MUNICIPALITIES")
        print("="*70)
        
        matched_count = 0
        unmatched_programs = []
        
        all_null_programs = BenefitProgram.query.filter(
            BenefitProgram.municipality_id.is_(None)
        ).all()
        
        for program in all_null_programs:
            matched = False
            
            # Try matching by slug in program code
            program_code_lower = program.code.lower()
            program_name_lower = program.name.lower()
            
            for slug, municipality in mun_slugs.items():
                # Check if slug appears in program code or name
                if slug in program_code_lower or slug in program_name_lower:
                    program.municipality_id = municipality.id
                    matched = True
                    matched_count += 1
                    print(f"  [MATCHED] {program.name} -> {municipality.name} (matched by slug: {slug})")
                    break
            
            # If not matched by slug, try by municipality name
            if not matched:
                for mun_name_lower, municipality in mun_names_lower.items():
                    # Remove common words and check
                    clean_name = mun_name_lower.replace('city of ', '').replace('city', '').strip()
                    if clean_name in program_code_lower or clean_name in program_name_lower:
                        program.municipality_id = municipality.id
                        matched = True
                        matched_count += 1
                        print(f"  [MATCHED] {program.name} -> {municipality.name} (matched by name)")
                        break
            
            if not matched:
                unmatched_programs.append(program)
        
        if matched_count > 0:
            db.session.commit()
            print(f"\n[OK] Matched {matched_count} programs to municipalities!")
        else:
            print("\n[INFO] No automatic matches found based on program codes/names.")
        
        remaining = len(unmatched_programs)
        if remaining > 0:
            print(f"\n[INFO] {remaining} programs could not be automatically matched.")
            print("These will remain NULL and can be assigned manually in the admin panel.")
            
            if remaining <= 20:
                print("\nUnmatched programs:")
                for prog in unmatched_programs[:20]:
                    print(f"  - {prog.name} (Code: {prog.code})")
        
        print("\n" + "="*70)
        print("SUMMARY")
        print("="*70)
        print(f"  Total programs: {total_programs}")
        print(f"  Programs with municipality: {programs_with_municipality + matched_count}")
        print(f"  Programs without municipality: {remaining}")
        print("\n[OK] Reassignment complete!\n")

















