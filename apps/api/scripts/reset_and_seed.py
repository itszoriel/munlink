#!/usr/bin/env python3
"""
Reset and seed the MunLink Region 3 database while preserving municipalities and barangays.

Features:
- Backup existing SQLite DB file
- Clear all non-geo tables (preserve `municipalities` and `barangays`)
- Seed document types
- Create municipal admin users for all municipalities from data/admins_gmails.txt
  (bypasses admin ID upload requirement by inserting directly)
- Seed distinct benefit programs per municipality

Usage (from repo root, venv active):
    python apps/api/scripts/reset_and_seed.py \
      --confirm \
      --admins from-file \
      --admins-file data/admins_gmails.txt \
      --benefits-per-muni 3
"""

import sys
import os
import re
import shutil
import argparse
from datetime import datetime, date

# Ensure project root (two levels up from this file's parent) is importable
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '../../..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apps.api.app import create_app
from apps.api import db
from apps.api.models.user import User
from apps.api.models.municipality import Municipality
from apps.api.models.document import DocumentType
from apps.api.models.benefit import BenefitProgram

# Optional model imports for clearing tables safely
from apps.api.models.announcement import Announcement
from apps.api.models.issue import Issue, IssueCategory
from apps.api.models.document import DocumentRequest
from apps.api.models.marketplace import Item, Transaction
from apps.api.models.token_blacklist import TokenBlacklist
from apps.api.models.transfer import TransferRequest

# Reuse seeders for document types if available
try:
    from apps.api.scripts.seed_data import seed_document_types, seed_issue_categories
except Exception:
    seed_document_types = None
    seed_issue_categories = None

import bcrypt


def backup_database_file(app) -> str:
    """Backup the SQLite DB file next to the original file.

    Returns the backup file path (or empty string if not applicable).
    """
    # Determine DB file path from app config (sqlite:///absolute_path)
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI')
    if not (db_uri and db_uri.startswith('sqlite:///')):
        return ''
    db_path = db_uri.replace('sqlite:///', '')
    if not os.path.isabs(db_path):
        db_path = os.path.join(PROJECT_ROOT, db_path)

    if not os.path.exists(db_path):
        return ''

    ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    backup_path = f"{db_path}.backup-{ts}.db"
    shutil.copy2(db_path, backup_path)
    return backup_path


def clear_non_geo_tables() -> None:
    """Delete rows from all tables except municipalities and barangays.

    Order matters due to FKs. We'll disable SQLite FK checks while doing ordered deletes.
    """
    # Disable FK constraints (SQLite)
    try:
        db.session.execute(db.text('PRAGMA foreign_keys = OFF;'))
    except Exception:
        pass

    # Child-first deletion order
    deletion_models = [
        # Issues
        Issue,
        IssueCategory,
        # Document requests and types
        DocumentRequest,
        DocumentType,
        # Marketplace
        Transaction,  # depends on Item and Users
        Item,
        # Benefit applications then programs
        # BenefitApplication is referenced inside BenefitProgram model file
    ]

    # BenefitApplication may not be imported above due to circular/type order; import inline
    try:
        from apps.api.models.benefit import BenefitApplication
        deletion_models.insert(deletion_models.index(DocumentType) + 1, BenefitApplication)
    except Exception:
        pass

    # Continue with benefits and remaining tables
    deletion_models += [
        BenefitProgram,
        Announcement,
        TransferRequest,
        TokenBlacklist,
        # Users last among domain tables
        User,
    ]

    for model in deletion_models:
        try:
            deleted = model.query.delete(synchronize_session=False)
            # print(f"Cleared {model.__tablename__}: {deleted}")
        except Exception:
            db.session.rollback()
            # Try raw SQL fallback
            try:
                table = getattr(model, '__tablename__', None)
                if table:
                    db.session.execute(db.text(f'DELETE FROM {table};'))
            except Exception:
                db.session.rollback()
        finally:
            db.session.commit()

    # Re-enable FK constraints
    try:
        db.session.execute(db.text('PRAGMA foreign_keys = ON;'))
    except Exception:
        pass


def parse_markdown_admins_table(file_path: str):
    """Parse data/admins_gmails.txt (Markdown table) -> list of dicts.

    Expected columns: Municipality | Username | Email | Password | User ID
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Admins file not found: {file_path}")

    entries = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # Skip headers/separators/blank
            if not line or not line.startswith('|'):
                continue
            # Skip header and divider rows
            if 'Municipality' in line and 'Username' in line:
                continue
            if set(line.replace('|', '').strip()) <= set('-: '):
                continue

            # Split by '|' and strip cells
            parts = [c.strip() for c in line.split('|') if c.strip()]
            if len(parts) < 4:
                continue

            municipality = parts[0]
            username = parts[1]
            email_cell = parts[2]
            password_cell = parts[3]

            # Extract email from Markdown mailto link: [x](mailto:x)
            m = re.search(r"\(mailto:([^\)]+)\)", email_cell)
            email = m.group(1).strip() if m else re.sub(r"[\[\]]", "", email_cell)

            # Strip emphasis from password like **Pass**
            password = password_cell.replace('*', '').strip()

            entries.append({
                'municipality': municipality,
                'username': username,
                'email': email,
                'password': password,
            })

    return entries


def ensure_municipalities_exist():
    """Ensure municipalities are present; if none, seed them using seed_data.py."""
    count = Municipality.query.count()
    if count > 0:
        return
    # Attempt to seed municipalities using seed_data.py if available
    try:
        from apps.api.scripts.seed_data import seed_municipalities
        seed_municipalities()
    except Exception as e:
        raise RuntimeError("No municipalities found and seeding failed. Please run seed_data.py") from e


def create_admin_accounts_from_entries(entries):
    """Create municipal admin accounts using provided entries.

    Skips creation if username or email already exists.
    """
    created = 0
    skipped = 0

    # Map municipality names (case-insensitive) to Municipality records
    municipalities = {m.name.lower(): m for m in Municipality.query.filter_by(is_active=True).all()}

    for e in entries:
        muni_name_key = e['municipality'].strip().lower()
        municipality = municipalities.get(muni_name_key)
        if not municipality:
            # Try partial or slug-insensitive matching
            municipality = next((m for k, m in municipalities.items() if muni_name_key.replace(' ', '-') in m.slug), None)
        if not municipality:
            skipped += 1
            continue

        username = e['username'].strip().lower()
        email = e['email'].strip().lower()
        raw_password = e['password']

        if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
            skipped += 1
            continue

        # Hash password with bcrypt
        password_hash = bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        admin_user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            first_name='Admin',
            last_name=municipality.name,
            date_of_birth=date(1990, 1, 1),
            role='municipal_admin',
            admin_municipality_id=municipality.id,
            municipality_id=municipality.id,
            email_verified=True,
            admin_verified=True,
            email_verified_at=datetime.utcnow(),
            admin_verified_at=datetime.utcnow(),
            is_active=True,
        )
        db.session.add(admin_user)
        created += 1

    db.session.commit()
    return created, skipped


def seed_distinct_benefits(per_muni: int = 3):
    """Seed distinct benefit programs for each municipality.

    Uses varied program types and amounts; codes are unique per municipality.
    """
    per_muni = max(1, min(int(per_muni or 3), 5))

    program_catalog = [
        {
            'key': 'EDU_ASSIST',
            'name': 'Educational Assistance',
            'type': 'educational',
            'base_amount': 1500.0,
            'requirements': ['Valid ID', 'Enrollment Certificate']
        },
        {
            'key': 'HEALTH_CARE',
            'name': 'Community Health Care Support',
            'type': 'health',
            'base_amount': 1000.0,
            'requirements': ['Valid ID', 'Medical Certificate']
        },
        {
            'key': 'LIVELIHOOD',
            'name': 'Livelihood Starter Kit',
            'type': 'livelihood',
            'base_amount': 3000.0,
            'requirements': ['Valid ID', 'Intent Letter']
        },
        {
            'key': 'SENIOR_SUBSIDY',
            'name': 'Senior Citizen Subsidy',
            'type': 'financial',
            'base_amount': 500.0,
            'requirements': ['Senior Citizen ID']
        },
        {
            'key': 'YOUTH_SKILLS',
            'name': 'Youth Skills Training',
            'type': 'educational',
            'base_amount': 0.0,
            'requirements': ['Valid ID']
        },
    ]

    municipalities = Municipality.query.filter_by(is_active=True).all()
    created = 0
    skipped = 0

    for idx, mun in enumerate(municipalities):
        slug = mun.slug.lower().replace(' ', '-').replace('_', '-')
        # Rotate selection to vary across municipalities
        start = idx % len(program_catalog)
        selected = [program_catalog[(start + i) % len(program_catalog)] for i in range(per_muni)]

        for j, p in enumerate(selected):
            code = f"{p['key']}_{slug}".upper()
            if BenefitProgram.query.filter_by(code=code).first():
                skipped += 1
                continue

            amount = p['base_amount'] + (j * 100.0) + (idx % 4) * 50.0
            program = BenefitProgram(
                name=f"{p['name']} - {mun.name}",
                code=code,
                description=f"{p['name']} program for residents of {mun.name}.",
                program_type=p['type'],
                municipality_id=mun.id,
                eligibility_criteria={'resident': True, 'municipality': mun.slug},
                required_documents=p['requirements'],
                application_start=None,
                application_end=None,
                benefit_amount=amount if amount > 0 else None,
                benefit_description=None,
                max_beneficiaries=None,
                current_beneficiaries=0,
                is_active=True,
                is_accepting_applications=True,
            )
            db.session.add(program)
            created += 1

    db.session.commit()
    return created, skipped


def main():
    parser = argparse.ArgumentParser(description='Reset and seed MunLink Region 3 database (preserve municipalities and barangays).')
    parser.add_argument('--confirm', action='store_true', help='Confirm destructive reset of non-geo tables')
    parser.add_argument('--admins', choices=['from-file', 'none'], default='from-file', help='Create admin users from file or skip')
    parser.add_argument('--admins-file', default=os.path.join(PROJECT_ROOT, 'data', 'admins_gmails.txt'), help='Path to Markdown admins table file')
    parser.add_argument('--benefits-per-muni', type=int, default=3, help='Number of benefit programs to create per municipality (1-5)')
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        print("\n" + "=" * 64)
        print("MUNLINK REGION 3 - RESET AND SEED (PRESERVE MUNICIPALITIES)")
        print("=" * 64 + "\n")

        # Safety confirmation
        if not args.confirm:
            print("ERROR: --confirm flag is required to proceed.")
            sys.exit(1)

        # Backup DB
        backup_path = backup_database_file(app)
        if backup_path:
            print(f"✓ Database backed up: {backup_path}")
        else:
            print("! No SQLite DB file found to backup (continuing).")

        # Ensure geography exists
        ensure_municipalities_exist()

        # Clear non-geo tables
        print("Clearing non-geo tables (users, issues, documents, benefits, marketplace, etc.)...")
        clear_non_geo_tables()
        print("✓ Cleared non-geo tables\n")

        # Seed document types
        print("Seeding document types...")
        try:
            if seed_document_types is not None:
                seed_document_types()
            else:
                # Fallback: ensure at least one document type exists (minimal)
                if DocumentType.query.count() == 0:
                    dt = DocumentType(name='Barangay Clearance', code='BRGY_CLEARANCE', description='Certificate of good standing from barangay', authority_level='barangay', requirements=['Valid ID', 'Purpose of request'], fee=50.00, processing_days=1, supports_physical=True, supports_digital=True, is_active=True)
                    db.session.add(dt)
                    db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"! Failed to seed document types: {e}")
            raise
        print("✓ Document types seeded\n")

        # Seed issue categories
        print("Seeding issue categories...")
        try:
            if seed_issue_categories is not None:
                seed_issue_categories()
            else:
                # If missing, skip silently
                pass
        except Exception as e:
            db.session.rollback()
            print(f"! Failed to seed issue categories: {e}")
            raise
        print("✓ Issue categories seeded\n")

        # Create admins from file
        created_admins = (0, 0)
        if args.admins == 'from-file':
            admins_file = args.admins_file
            # Support alternate path if caller passes relative path
            if not os.path.isabs(admins_file):
                admins_file = os.path.join(PROJECT_ROOT, admins_file)
            print(f"Creating municipal admins from file: {admins_file}")
            entries = parse_markdown_admins_table(admins_file)
            created_admins = create_admin_accounts_from_entries(entries)
            print(f"✓ Admin creation complete (created: {created_admins[0]}, skipped: {created_admins[1]})\n")
        else:
            print("Skipping admin creation (per flag).\n")

        # Seed distinct benefits per municipality
        print(f"Seeding benefits (per municipality: {args.benefits_per_muni})...")
        created_benefits = seed_distinct_benefits(args.benefits_per_muni)
        print(f"✓ Benefits seeded (created: {created_benefits[0]}, skipped: {created_benefits[1]})\n")

        print("=" * 64)
        print("ALL DONE ✔")
        print("=" * 64 + "\n")


if __name__ == '__main__':
    main()


