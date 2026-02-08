"""
Seed per-municipality and per-barangay document types for Zambales.

Usage:
    python apps/api/scripts/seed_lgu_document_types.py
"""
import os
import sys
import logging
from typing import List, Dict

# Ensure project root is importable so `apps.api.*` works
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
api_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
for path in (api_root, project_root):
    if path not in sys.path:
        sys.path.insert(0, path)

# Quiet SQLAlchemy engine logs for faster seeding output
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

# Prefer local imports when running from apps/api to avoid duplicate model registration
try:
    from app import create_app
    from apps.api import db
    from apps.api.models.province import Province
    from apps.api.models.municipality import Municipality, Barangay
    from apps.api.models.document import DocumentType
except ImportError:
    from apps.api.app import create_app
    from apps.api import db
    from apps.api.models.province import Province
    from apps.api.models.municipality import Municipality, Barangay
    from apps.api.models.document import DocumentType

# Templates for LGU-scoped documents (limited to the requested barangay and municipal services)
BARANGAY_DOC_TEMPLATES: List[Dict] = [
    {
        'code': 'CLEARANCE',
        'name': 'Barangay Clearance',
        'description': 'Clearance for general purposes (employment, school, etc.)',
        'requirements': ['Cedula', 'Valid ID'],
        'fee': 50.00,
        'exemption_rules': {'student': {'requires_purpose': 'educational'}},
        'supports_digital': True,
        'processing_days': 1,
    },
    {
        'code': 'CERTIFICATION',
        'name': 'Barangay Certification',
        'description': 'General barangay certification for residents',
        'requirements': ['Valid ID'],
        'fee': 50.00,
        'exemption_rules': {'pwd': True, 'senior': True},
        'supports_digital': True,
        'processing_days': 1,
    },
    {
        'code': 'RECORDS',
        'name': 'Barangay Records',
        'description': 'Certification or copy of barangay records',
        'requirements': ['Valid ID'],
        'fee': 50.00,
        'supports_digital': True,
        'processing_days': 2,
    },
    {
        'code': 'RESIDENCY',
        'name': 'Barangay Residency',
        'description': 'Certification that the requester resides in the barangay',
        'requirements': ['Valid ID'],
        'fee': 50.00,
        'supports_digital': True,
        'processing_days': 3,
    },
    {
        'code': 'INDIGENCY',
        'name': 'Barangay Indigency',
        'description': 'Certification for indigent residents (for assistance programs)',
        'requirements': ['Valid ID'],
        'fee': 50.00,
        'supports_digital': True,
        'processing_days': 2,
    },
    {
        'code': 'BUSINESS_CLEARANCE',
        'name': 'Business Clearance',
        'description': 'Clearance for businesses operating within the barangay',
        'requirements': ['Valid ID', 'DTI Registration', 'Proof of Ownership'],
        'fee': 300.00,
        'fee_tiers': {
            'big_business': 300,
            'small_business': 150,
            'banca_tricycle': 100
        },
        'supports_digital': False,
        'processing_days': 2,
    },
]

# No additional municipal templates beyond the specified services
MUNICIPAL_DOC_TEMPLATES: List[Dict] = []

MUNICIPAL_FEE_DOC_TEMPLATES: List[Dict] = [
    {
        'code': 'MAYORS_CLEARANCE',
        'name': "Mayor's Clearance",
        'description': "Clearance issued by the Mayor's Office",
        'requirements': [
            'Barangay Clearance (original)',
            'Police Clearance (original)',
            'Community Tax Certificate/CTC (original)'
        ],
        'fee': 50.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'INDIGENCY_MAYOR',
        'name': 'Certificate of Indigency (Mayor Office)',
        'description': "Indigency certificate issued by the Mayor's Office (free upon requirements)",
        'requirements': [
            'Barangay Clearance (original)',
            'MSWD Certification (original)'
        ],
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'INDIGENCY_MSWDO',
        'name': 'Certificate of Indigency (MSWDO)',
        'description': 'Indigency certificate issued by MSWDO (free upon requirements)',
        'requirements': [
            'Barangay Certificate of Indigency (original)',
            'Valid ID (photocopy)',
            'Community Tax Certificate/CTC (original)',
            'Possible additional requirements depending on purpose (e.g., parental consent, cert of no property, medical cert, certificate of enrollment)'
        ],
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'CTC',
        'name': 'Community Tax Certificate (Cedula / CTC)',
        'description': 'Fee varies by income: PHP 20 (no income) or basic tax formula; final fee assessed at office',
        'requirements': [
            'Identification card or old CTC (individuals)',
            "SEC Registration or previous year's declared gross sales (corporation)"
        ],
        'fee': 20.00,
        'supports_digital': False,
        'processing_days': 1,
    },
    {
        'code': 'TAX_CLEARANCE',
        'name': 'Tax Clearance Certification',
        'description': 'Certification for tax clearance',
        'requirements': [
            'Official Receipt of Real Property Tax payment (original or photocopy)'
        ],
        'fee': 50.00,
        'supports_digital': False,
        'processing_days': 2,
    },
    {
        'code': 'PROPERTY_HOLDINGS',
        'name': 'Certificate of Property Holdings (Municipal Assessor)',
        'description': 'Certificate of property holdings (per certification)',
        'requirements': [
            'Authorization letter (if not owner) (original)',
            'Photocopy of valid ID/proof of identity (owner/authorized rep)',
            'Official receipt evidencing full payment of real property tax for current year (original)'
        ],
        'fee': 50.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'MARRIAGE_LICENSE',
        'name': 'Application for Marriage License',
        'description': 'Application fee PHP 420 + PHP 2 license; final fee assessed at office',
        'requirements': [
            'Applicants must be male and female; at least one applicant is a resident of Porac',
            'PSA CENOMAR (orig + photocopy)',
            'Pre-marriage counseling/responsible parenthood certificate (orig + photocopy)',
            'Parental consent (18-20) / parental advice (21-24) (2 originals)',
            'As applicable: death cert (widowed), court decision/decree (annulled), divorce decree (divorced), certificate of legal capacity (foreigner)',
            'Community Tax Certificate/CTC (original)'
        ],
        'fee': 422.00,
        'supports_digital': False,
        'processing_days': 7,
    },
    {
        'code': 'SANITARY_PERMIT_MHO',
        'name': 'Sanitary Permit (Municipal Health Office)',
        'description': 'Sanitary permit; free upon requirements',
        'requirements': [
            'Barangay Business Clearance (latest orig/photocopy)',
            'DTI name or SEC registration (latest orig/photocopy)',
            'Environmental Compliance Certificate (ECC)'
        ],
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'CIVIL_REGISTRY_CORRECTION',
        'name': 'Civil Registry Corrections (RA 9048/10172)',
        'description': 'Fee varies: PHP 1,000 (clerical error) or PHP 3,000 (change of name/gender/DOB); free for indigent petitioners',
        'requirements': [
            'Detailed checklist varies per petition type',
            'Free if indigent petitioner (subject to assessment)'
        ],
        'fee': 1000.00,
        'supports_digital': False,
        'processing_days': 10,
    },
    {
        'code': 'CIVIL_REGISTRY_ANNOTATION',
        'name': 'Annotation of Civil Registry Documents (Court Decree/Order)',
        'description': 'Annotation per document',
        'requirements': [
            'Court decision/order (2 originals)',
            'Certificate of Finality (2 originals)',
            'Certificate of Authenticity (2 originals)',
            'Certificate of Registration (2 originals)'
        ],
        'fee': 50.00,
        'supports_digital': False,
        'processing_days': 7,
    },
]



def build_code(prefix: str, slug: str, suffix: str) -> str:
    """Build a unique, ASCII-safe code within 50 characters."""
    safe_slug = (slug or '').upper().replace('-', '_')
    code = f"{prefix}_{safe_slug}_{suffix}"
    return code[:50]


def seed_lgu_document_types():
    app = create_app()
    created = 0

    with app.app_context():
        scope = os.getenv('SEED_LGU_SCOPE', 'all').lower()
        municipality_slug = os.getenv('SEED_MUNICIPALITY_SLUG')
        prune = os.getenv('SEED_LGU_PRUNE', '0').lower() in ('1', 'true', 'yes', 'y')

        zambales = Province.query.filter_by(slug='zambales').first()
        if not zambales:
            print("Zambales province not found. Run the main seed script first.")
            return

        municipalities = Municipality.query.filter_by(province_id=zambales.id).all()
        if not municipalities:
            print("No municipalities found for Zambales. Seed municipalities first.")
            return
        if municipality_slug:
            municipalities = [mun for mun in municipalities if mun.slug == municipality_slug]
            if not municipalities:
                print(f"Municipality with slug '{municipality_slug}' not found in Zambales.")
                return

        if prune:
            deleted = 0
            if scope in ('all', 'municipal'):
                allowed_templates = (MUNICIPAL_DOC_TEMPLATES or []) + (MUNICIPAL_FEE_DOC_TEMPLATES or [])
                allowed_muni_codes = {
                    build_code('MUNI', mun.slug, tmpl['code'])
                    for mun in municipalities
                    for tmpl in allowed_templates
                }
                if allowed_muni_codes:
                    muni_ids = [mun.id for mun in municipalities]
                    deleted += DocumentType.query.filter(
                        DocumentType.authority_level == 'municipal',
                        DocumentType.municipality_id.in_(muni_ids),
                        ~DocumentType.code.in_(allowed_muni_codes),
                    ).delete(synchronize_session=False)

            if scope in ('all', 'barangay'):
                for mun in municipalities:
                    barangays = mun.barangays.all() if hasattr(mun.barangays, 'all') else mun.barangays
                    for brgy in barangays:
                        allowed_codes = {
                            build_code('BRGY', brgy.slug, tmpl['code'])
                            for tmpl in BARANGAY_DOC_TEMPLATES
                        }
                        if not allowed_codes:
                            continue
                        deleted += DocumentType.query.filter(
                            DocumentType.authority_level == 'barangay',
                            DocumentType.barangay_id == brgy.id,
                            ~DocumentType.code.in_(allowed_codes),
                        ).delete(synchronize_session=False)

            if deleted:
                db.session.commit()
            print(f"Pruned document types outside the allowed list: {deleted}")

        # Seed municipal-level documents
        if scope in ('all', 'municipal'):
            for mun in municipalities:
                for tmpl in MUNICIPAL_DOC_TEMPLATES:
                    code = build_code('MUNI', mun.slug, tmpl['code'])
                    if DocumentType.query.filter_by(code=code).first():
                        continue
                    doc = DocumentType(
                        name=f"{tmpl['name']} ({mun.name})",
                        code=code,
                        description=f"{tmpl['description']} - {mun.name}",
                        authority_level='municipal',
                        municipality_id=mun.id,
                        barangay_id=None,
                        requirements=tmpl.get('requirements') or [],
                        fee=tmpl.get('fee', 0.00),
                        fee_tiers=tmpl.get('fee_tiers'),
                        exemption_rules=tmpl.get('exemption_rules'),
                        processing_days=tmpl.get('processing_days', 3),
                        supports_physical=True,
                        supports_digital=tmpl.get('supports_digital', True),
                        is_active=True,
                    )
                    db.session.add(doc)
                    created += 1

                # Fee-bearing / in-person municipal documents
                for tmpl in MUNICIPAL_FEE_DOC_TEMPLATES:
                    code = build_code('MUNI', mun.slug, tmpl['code'])
                    if DocumentType.query.filter_by(code=code).first():
                        continue
                    doc = DocumentType(
                        name=f"{tmpl['name']} ({mun.name})",
                        code=code,
                        description=f"{tmpl['description']} - {mun.name}",
                        authority_level='municipal',
                        municipality_id=mun.id,
                        barangay_id=None,
                        requirements=tmpl.get('requirements') or [],
                        fee=tmpl.get('fee', 0.00),
                        fee_tiers=tmpl.get('fee_tiers'),
                        exemption_rules=tmpl.get('exemption_rules'),
                        processing_days=tmpl.get('processing_days', 3),
                        supports_physical=True,
                        supports_digital=tmpl.get('supports_digital', False),
                        is_active=True,
                    )
                    db.session.add(doc)
                    created += 1

            db.session.commit()
            print(f"Municipal-level documents seeded/ensured for {len(municipalities)} municipalities.")

        # Seed barangay-level documents
        if scope in ('all', 'barangay'):
            for mun in municipalities:
                barangays = mun.barangays.all() if hasattr(mun.barangays, 'all') else mun.barangays
                for brgy in barangays:
                    for tmpl in BARANGAY_DOC_TEMPLATES:
                        code = build_code('BRGY', brgy.slug, tmpl['code'])
                        if DocumentType.query.filter_by(code=code).first():
                            continue
                        doc = DocumentType(
                            name=f"{tmpl['name']} - {brgy.name}, {mun.name}",
                            code=code,
                            description=f"{tmpl['description']} - {brgy.name}, {mun.name}",
                            authority_level='barangay',
                            municipality_id=mun.id,
                            barangay_id=brgy.id,
                            requirements=tmpl.get('requirements') or [],
                            fee=tmpl.get('fee', 0.00),
                            fee_tiers=tmpl.get('fee_tiers'),
                            exemption_rules=tmpl.get('exemption_rules'),
                            processing_days=tmpl.get('processing_days', 3),
                            supports_physical=True,
                            supports_digital=tmpl.get('supports_digital', True),
                            is_active=True,
                        )
                        db.session.add(doc)
                        created += 1

                db.session.commit()

            print(f"Barangay-level documents seeded/ensured for all barangays in Zambales.")
        print(f"Total new document types created: {created}")


if __name__ == '__main__':
    seed_lgu_document_types()
