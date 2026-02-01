"""
Seed per-municipality and per-barangay document types for Zambales.

Usage:
    python apps/api/scripts/seed_lgu_document_types.py
"""
import os
import sys
from typing import List, Dict

# Ensure project root is importable so `apps.api.*` works
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from apps.api.app import create_app
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.document import DocumentType

# Templates for LGU-scoped documents (fees reflect free digital availability; paper/cert copies may incur local fees)
BARANGAY_DOC_TEMPLATES: List[Dict] = [
    {
        'code': 'ORD_RES',
        'name': 'Barangay Ordinances & Resolutions',
        'description': 'Certified copies of barangay ordinances/resolutions',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 3,
    },
    {
        'code': 'ASSEMBLY_MINUTES',
        'name': 'Barangay Assembly Minutes',
        'description': 'Minutes and attendance of Barangay Assembly sessions',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 3,
    },
    {
        'code': 'BUDGET_UTILIZATION',
        'name': 'Barangay Budget & Utilization',
        'description': 'Annual/Supplemental budget and utilization (20% DF, BDRRM, SK, special funds)',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 5,
    },
    {
        'code': 'DRRM_PLAN',
        'name': 'Barangay DRRM Plan & Utilization',
        'description': 'DRRM plan and fund utilization reports',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 5,
    },
    {
        'code': 'PROJECT_STATUS',
        'name': 'Barangay Project Status Reports',
        'description': 'Status/implementation reports for barangay-funded projects',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 5,
    },
    {
        'code': 'CITIZENS_CHARTER',
        'name': 'Barangay Citizen\'s Charter',
        'description': 'Citizen\'s Charter/service standards for the barangay',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 2,
    },
    {
        'code': 'PERMIT_LOGS',
        'name': 'Barangay Permit/Clearance Logs',
        'description': 'Logs of permits/clearances issued (copy fees may apply for certifications)',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 3,
    },
    # Common certificates requested by residents
    {
        'code': 'RESIDENCY',
        'name': 'Certificate of Residency',
        'description': 'Certification that the requester resides in the barangay',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 3,
    },
    {
        'code': 'INDIGENCY',
        'name': 'Certificate of Indigency',
        'description': 'Certification for indigent residents (for assistance programs)',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 2,
    },
    {
        'code': 'GOOD_MORAL',
        'name': 'Certificate of Good Moral Character',
        'description': 'Certification of good moral character issued by the barangay',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 2,
    },
    {
        'code': 'NO_CASE',
        'name': 'Certificate of No Barangay Case',
        'description': 'Certification that there is no pending barangay case',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 2,
    },
    {
        'code': 'CLEARANCE',
        'name': 'Barangay Clearance',
        'description': 'Clearance for general purposes (employment, school, etc.)',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 1,
    },
    {
        'code': 'BUSINESS_CLEARANCE',
        'name': 'Barangay Business Clearance',
        'description': 'Clearance for businesses operating within the barangay',
        'fee': 100.00,
        'supports_digital': False,
        'processing_days': 2,
    },
    {
        'code': 'BLOTTER_CERT',
        'name': 'Barangay Blotter Certification',
        'description': 'Certification referencing barangay blotter (restricted release)',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'BPO_ASSIST',
        'name': 'Barangay Protection Order (Assisted)',
        'description': 'Assisted request for Barangay Protection Order (RA 9262)',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 0,
    },
]

MUNICIPAL_DOC_TEMPLATES: List[Dict] = [
    {
        'code': 'ORD_RES',
        'name': 'Municipal Ordinances & Resolutions',
        'description': 'Sanggunian ordinances/resolutions/journals and revenue measures',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 5,
    },
    {
        'code': 'BUDGET_REPORTS',
        'name': 'Budget & Utilization Reports',
        'description': 'Annual/Supplemental Budget, AIP, 20% DF, SEF, GAD Plan & AR, 5% DRRM, Trust Fund, SRE/Quarterly Cash Flow',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 5,
    },
    {
        'code': 'PROCUREMENT',
        'name': 'Procurement Files',
        'description': 'APP/PPMPs, ITB/RFQ, Abstract of Bids, Minutes, NOA/NTP/Contracts',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 5,
    },
    {
        'code': 'INFRA_STATUS',
        'name': 'Infrastructure Project Status',
        'description': 'List/status of infrastructure projects with contract details',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 5,
    },
    {
        'code': 'TAX_FEES',
        'name': 'Local Tax & Fee Schedule',
        'description': 'Current schedule of local taxes, fees, and charges',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 3,
    },
    {
        'code': 'CITIZENS_CHARTER',
        'name': 'Citizen\'s Charter',
        'description': 'LGU Citizen\'s Charter/service standards (RA 11032)',
        'fee': 0.00,
        'supports_digital': True,
        'processing_days': 2,
    },
]

MUNICIPAL_FEE_DOC_TEMPLATES: List[Dict] = [
    {
        'code': 'BUSINESS_PERMIT',
        'name': 'Business Permit (New/Renewal)',
        'description': 'Permit to operate a business (application only)',
        'fee': 500.00,
        'supports_digital': False,
        'processing_days': 7,
    },
    {
        'code': 'SANITARY_PERMIT',
        'name': 'Sanitary Permit',
        'description': 'Sanitary clearance for establishments (application only)',
        'fee': 200.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'ZONING_CLEARANCE',
        'name': 'Zoning/Locational Clearance',
        'description': 'Locational clearance from planning/zoning office (application only)',
        'fee': 300.00,
        'supports_digital': False,
        'processing_days': 5,
    },
    {
        'code': 'BUILDING_PERMIT',
        'name': 'Building Permit',
        'description': 'Permit to construct/renovate structures (application only)',
        'fee': 1000.00,
        'supports_digital': False,
        'processing_days': 10,
    },
    {
        'code': 'OCCUPANCY_CERT',
        'name': 'Occupancy Certificate',
        'description': 'Certificate of Occupancy (application only)',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 7,
    },
    {
        'code': 'CEDULA',
        'name': 'Community Tax Certificate (Cedula)',
        'description': 'Community Tax Certificate issuance',
        'fee': 30.00,
        'supports_digital': False,
        'processing_days': 1,
    },
    {
        'code': 'TAX_DECLARATION_COPY',
        'name': 'Tax Declaration Copy (Certified)',
        'description': 'Certified true copy of tax declaration (Assessor)',
        'fee': 50.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'RPT_CLEARANCE',
        'name': 'Real Property Tax Clearance',
        'description': 'Clearance for real property taxes',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 2,
    },
    {
        'code': 'CR_COPY_BIRTH',
        'name': 'Civil Registry Copy - Birth',
        'description': 'Certified copy/transcription from Local Civil Registrar',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'CR_COPY_MARRIAGE',
        'name': 'Civil Registry Copy - Marriage',
        'description': 'Certified copy/transcription from Local Civil Registrar',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'CR_COPY_DEATH',
        'name': 'Civil Registry Copy - Death',
        'description': 'Certified copy/transcription from Local Civil Registrar',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 3,
    },
    {
        'code': 'MARRIAGE_LICENSE',
        'name': 'Marriage License',
        'description': 'Application for marriage license',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 10,
    },
    {
        'code': 'PWD_ID_APP',
        'name': 'PWD ID Application',
        'description': 'Application for Persons with Disability ID',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 7,
    },
    {
        'code': 'SENIOR_ID_APP',
        'name': 'Senior Citizen ID Application',
        'description': 'Application for Senior Citizen ID',
        'fee': 0.00,
        'supports_digital': False,
        'processing_days': 7,
    },
    {
        'code': 'SOLO_PARENT_ID_APP',
        'name': 'Solo Parent ID Application',
        'description': 'Application for Solo Parent ID',
        'fee': 0.00,
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
        zambales = Province.query.filter_by(slug='zambales').first()
        if not zambales:
            print("Zambales province not found. Run the main seed script first.")
            return

        municipalities = Municipality.query.filter_by(province_id=zambales.id).all()
        if not municipalities:
            print("No municipalities found for Zambales. Seed municipalities first.")
            return

        # Seed municipal-level documents
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
