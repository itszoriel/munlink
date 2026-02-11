"""
Seed script to populate database with initial data.
Run this after creating the database tables.
"""
import sys
import os
# Ensure project root is importable so `apps.api.*` works
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from apps.api.app import create_app
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.document import DocumentType
from apps.api.models.issue import IssueCategory
from apps.api.models.benefit import BenefitProgram
from apps.api.scripts.seed_lgu_document_types import seed_lgu_document_types
from apps.api.utils.constants import ISSUE_CATEGORIES as ISSUE_CATEGORY_SLUGS
from datetime import datetime
import json
from pathlib import Path

# Region 3 Province PSGC codes (approximate - may need verification)
REGION3_PROVINCE_PSGC = {
    'Aurora': '037700000',
    'Bataan': '030800000',
    'Bulacan': '031400000',
    'Nueva Ecija': '034900000',
    'Pampanga': '035400000',
    'Tarlac': '036900000',
    'Zambales': '037100000',
}

# Municipality data for Zambales (EXACTLY 13) - kept for backward compatibility
ZAMBALES_MUNICIPALITIES = [
    {
        'name': 'Botolan',
        'slug': 'botolan',
        'psgc_code': '037103000',
        'description': 'Home of Mount Pinatubo',
        'barangays': ['Bangan', 'Batonlapoc', 'Beneg', 'Binuclutan', 'Burgos', 'Cabatuan', 'Capayawan', 'Carael', 'Dampay', 'Maguisguis', 'Malomboy', 'Moraza', 'Nacolcol', 'Paco (Pob.)', 'Palis', 'Pangolingan', 'Paudpod', 'Porac', 'Poonbato', 'Salaza', 'San Isidro', 'San Juan', 'San Miguel', 'Santiago (Pob.)', 'Tampo (Pob.)', 'Taugtog', 'Villar', 'Balaybay', 'Bancal', 'Barangay I (Pob.)', 'Barangay II (Pob.)', 'Barangay III (Pob.)']
    },
    {
        'name': 'Cabangan',
        'slug': 'cabangan',
        'psgc_code': '037104000',
        'description': 'A coastal municipality in Zambales',
        'barangays': ['Anonang', 'Banuambayo', 'Cadmang-Reserva', 'Camiling', 'Casabaan', 'Conacon', 'Felmida-Diaz', 'Gomoil', 'Laoag', 'Lomboy', 'Longos', 'New San Juan', 'Pinalusan', 'San Rafael', 'Siminublan', 'Tondo', 'Felmida-Diaz (Del Pilar)', 'Camiling (New San Andres)']
    },
    {
        'name': 'Candelaria',
        'slug': 'candelaria',
        'psgc_code': '037105000',
        'description': 'A progressive municipality',
        'barangays': ['Bacundao', 'Baloguen', 'Binabalian', 'Bulawen', 'Catol', 'Dampay', 'Libertador', 'Looc', 'Malabon', 'Malacampa', 'Palacpalac', 'Poblacion', 'Sinabacan', 'Tapuac', 'Uacon']
    },
    {
        'name': 'Castillejos',
        'slug': 'castillejos',
        'psgc_code': '037106000',
        'description': 'Home of Ramon Magsaysay Ancestral House',
        'barangays': ['Balaybay', 'Del Pilar', 'Looc', 'Magsaysay', 'Nagbayan', 'Nagbunga', 'Poblacion', 'San Agustin', 'San Jose', 'San Juan', 'San Nicolas', 'San Roque', 'Santa Maria', 'Talisay']
    },
    {
        'name': 'Iba',
        'slug': 'iba',
        'psgc_code': '037107000',
        'description': 'Capital of Zambales Province',
        'barangays': ['Amungan', 'Aglao', 'Bangantalinga', 'Dirita-Baloguen', 'Lipay-Dingin-Panibuatan', 'Palanginan (Palanguinan)', 'San Agustin', 'Santa Barbara', 'Santo Rosario (Pob.)', 'Bano', 'Lipay', 'Zone 1 (Pob.)', 'Zone 2 (Pob.)', 'Zone 3 (Pob.)', 'Zone 4 (Pob.)', 'Zone 5 (Pob.)', 'Zone 6 (Pob.)']
    },
    {
        'name': 'Masinloc',
        'slug': 'masinloc',
        'psgc_code': '037108000',
        'description': 'Home of historic Masinloc Church',
        'barangays': ['Baloganon', 'Bamban', 'Bani', 'Collat', 'Inhobol', 'North Poblacion', 'San Lorenzo', 'San Salvador', 'Santa Rita', 'Santo Rosario (Culibasa)', 'South Poblacion', 'Taltal', 'Taposo']
    },
    {
        'name': 'Palauig',
        'slug': 'palauig',
        'psgc_code': '037109000',
        'description': 'A coastal municipality',
        'barangays': ['Alwa', 'Bato', 'Bulawen', 'Garreta', 'Liozon', 'Lipay', 'Locloc', 'Pangolingan', 'Poblacion', 'Salaza', 'San Juan', 'Santa Cruz', 'Tition', 'Taugtog']
    },
    {
        'name': 'San Antonio',
        # Align slug with frontend/constants (avoid collision with other San Antonio cities)
        'slug': 'san-antonio-zambales',
        'psgc_code': '037111000',
        'description': 'Home to Pundaquit Beach',
        'barangays': ['Beddeng', 'Burgos', 'Estansa', 'San Gregorio', 'Pundaquit', 'Rizal', 'San Pablo']
    },
    {
        'name': 'San Felipe',
        'slug': 'san-felipe',
        'psgc_code': '037112000',
        'description': 'Famous for Arko Entrance',
        'barangays': ['Amagna', 'Apostol', 'Balincaguing', 'Farañal', 'Maloma', 'Manglicmot', 'Poblacion', 'Rosete', 'San Rafael']
    },
    {
        'name': 'San Marcelino',
        'slug': 'san-marcelino',
        'psgc_code': '037113000',
        'description': 'A progressive municipality',
        'barangays': ['Aglao', 'Buyon', 'Central', 'Consuelo Norte', 'Consuelo Sur', 'Linasin', 'Luan', 'Lucero', 'Nagbunga', 'Poblacion', 'Porac', 'San Guillermo', 'San Isidro', 'San Rafael', 'Santa Fe', 'Tabalong']
    },
    {
        'name': 'San Narciso',
        'slug': 'san-narciso',
        'psgc_code': '037114000',
        'description': 'A coastal municipality with beautiful beaches',
        'barangays': ['Alusiis', 'Beddeng', 'Grullo', 'La Paz', 'Libertad', 'Namatacan', 'Nangatngatan', 'Omaya', 'Paite Norte', 'Paite Sur', 'Patrocinio', 'Poblacion', 'San Jose', 'San Juan', 'San Pascual', 'Santa Rosa', 'Siminublan', 'Tampunan']
    },
    {
        'name': 'Santa Cruz',
        'slug': 'santa-cruz',
        'psgc_code': '037115000',
        'description': 'A municipality in Zambales',
        'barangays': ['Biay', 'Bolitoc', 'Candelaria', 'Lambingan', 'Lipay', 'Lucapon North', 'Lucapon South', 'Malabago', 'Naulo', 'Poblacion Zone I', 'Poblacion Zone II', 'Poblacion Zone III', 'Santa Cruz']
    },
    {
        'name': 'Subic',
        'slug': 'subic',
        'psgc_code': '037116000',
        'description': 'A coastal municipality',
        'barangays': ['Aningway Sacatihan', 'Asinan Poblacion', 'Asinan Proper', 'Baraca-Camachile (Pob.)', 'Batiawan', 'Calapacuan', 'Calapandayan (Pob.)', 'Cawag', 'Ilwas (Pob.)', 'Mangan-Vaca', 'Matain', 'Naugsol', 'Pamatawan', 'San Isidro', 'Santo Tomas', 'Wawandue (Pob.)']
    }
]

# Document types - REMOVED: Global unscoped document types previously here had
# municipality_id=NULL which caused them to appear for ALL users regardless of
# location. All document types are now seeded per-municipality and per-barangay
# by seed_lgu_document_types.py with proper municipality_id/barangay_id set.
DOCUMENT_TYPES = []

def _slugify(text: str) -> str:
    """Basic slugify for province/municipality/barangay names."""
    return (
        text.strip()
        .lower()
        .replace('&', 'and')
        .replace('(', '')
        .replace(')', '')
        .replace('.', '')
        .replace(',', '')
        .replace('  ', ' ')
        .replace(' ', '-')
    )


ISSUE_CATEGORY_META = {
    'infrastructure': {
        'name': 'Infrastructure',
        'description': 'Roads, bridges, public facilities, and utilities.',
        'icon': 'construction',
    },
    'public_safety': {
        'name': 'Public Safety',
        'description': 'Safety hazards, crime, and emergency concerns.',
        'icon': 'shield',
    },
    'environmental': {
        'name': 'Environmental',
        'description': 'Waste, pollution, and environmental hazards.',
        'icon': 'leaf',
    },
    'administrative': {
        'name': 'Administrative',
        'description': 'Government services and administrative issues.',
        'icon': 'file-text',
    },
    'health_sanitation': {
        'name': 'Health & Sanitation',
        'description': 'Health hazards, sanitation issues, and disease-related concerns.',
        'icon': 'heart-pulse',
    },
    'community_social': {
        'name': 'Community & Social',
        'description': 'Neighbor disputes, noise complaints, and community concerns.',
        'icon': 'users',
    },
    'utilities_services': {
        'name': 'Utilities & Services',
        'description': 'Water, electricity, internet, and public service disruptions.',
        'icon': 'zap',
    },
    'other': {
        'name': 'Other',
        'description': 'Issues that do not fit into the other categories.',
        'icon': 'help-circle',
    },
}

# Issue categories used by seed_issue_categories()
ISSUE_CATEGORIES = [
    {
        'name': ISSUE_CATEGORY_META.get(slug, {}).get('name', slug.replace('_', ' ').title()),
        'slug': slug,
        'description': ISSUE_CATEGORY_META.get(slug, {}).get('description', ''),
        'icon': ISSUE_CATEGORY_META.get(slug, {}).get('icon', None),
    }
    for slug in ISSUE_CATEGORY_SLUGS
]


def seed_provinces():
    """Seed provinces for Region 3."""
    print("Seeding provinces...")
    for name, psgc_code in REGION3_PROVINCE_PSGC.items():
        existing = Province.query.filter_by(psgc_code=psgc_code).first()
        if existing:
            print(f"  - {name} already exists, skipping...")
            continue
        province = Province(
            name=name,
            slug=_slugify(name),
            psgc_code=psgc_code,
            region_code='03',
            region_name='Central Luzon',
            is_active=True,
        )
        db.session.add(province)
        print(f"  - Created {name}")

    db.session.commit()
    print("Provinces seeded successfully\n")


def seed_municipalities():
    """Seed municipalities and barangays for Zambales."""
    print("Seeding municipalities...")
    zambales = Province.query.filter_by(slug='zambales').first()
    if not zambales:
        zambales = Province.query.filter_by(name='Zambales').first()
    if not zambales:
        raise RuntimeError("Zambales province not found. Run seed_provinces first.")

    for mun_data in ZAMBALES_MUNICIPALITIES:
        existing = Municipality.query.filter_by(psgc_code=mun_data['psgc_code']).first()
        if existing:
            print(f"  - {mun_data['name']} already exists, skipping...")
            continue

        municipality = Municipality(
            name=mun_data['name'],
            slug=mun_data['slug'],
            province_id=zambales.id,
            psgc_code=mun_data['psgc_code'],
            description=mun_data.get('description'),
            is_active=True,
        )
        db.session.add(municipality)
        db.session.flush()

        barangays = mun_data.get('barangays', [])
        for idx, brgy_name in enumerate(barangays, start=1):
            brgy_slug = _slugify(brgy_name)
            brgy_exists = Barangay.query.filter_by(
                municipality_id=municipality.id,
                slug=brgy_slug,
            ).first()
            if brgy_exists:
                continue
            barangay = Barangay(
                name=brgy_name,
                slug=brgy_slug,
                municipality_id=municipality.id,
                psgc_code=f"{mun_data['psgc_code']}{idx:03d}",
                is_active=True,
            )
            db.session.add(barangay)

        print(f"  - Created {mun_data['name']} with {len(barangays)} barangays")

    db.session.commit()
    print("Municipalities seeded successfully\n")



def seed_document_types():
    """Seed document types."""
    print("Seeding document types...")
    
    for doc_data in DOCUMENT_TYPES:
        # Check if document type already exists
        existing = DocumentType.query.filter_by(code=doc_data['code']).first()
        
        if existing:
            print(f"  - {doc_data['name']} already exists, skipping...")
            continue
        
        doc_type = DocumentType(
            name=doc_data['name'],
            code=doc_data['code'],
            description=doc_data.get('description'),
            authority_level=doc_data['authority_level'],
            requirements=doc_data.get('requirements'),
            fee=doc_data.get('fee', 0.00),
            fee_tiers=doc_data.get('fee_tiers'),
            exemption_rules=doc_data.get('exemption_rules'),
            processing_days=doc_data.get('processing_days', 3),
            supports_physical=doc_data.get('supports_physical', True),
            supports_digital=doc_data.get('supports_digital', True),
            is_active=True
        )
        
        db.session.add(doc_type)
        print(f"  - Created {doc_data['name']}")
    
    db.session.commit()
    print("Document types seeded successfully\n")


def seed_issue_categories():
    """Seed issue categories."""
    print("Seeding issue categories...")
    
    for cat_data in ISSUE_CATEGORIES:
        # Check if category already exists
        existing = IssueCategory.query.filter_by(slug=cat_data['slug']).first()
        
        if existing:
            print(f"  - {cat_data['name']} already exists, skipping...")
            continue
        
        category = IssueCategory(
            name=cat_data['name'],
            slug=cat_data['slug'],
            description=cat_data['description'],
            icon=cat_data['icon'],
            is_active=True
        )
        
        db.session.add(category)
        print(f"  - Created {cat_data['name']}")
    
    db.session.commit()
    print("Issue categories seeded successfully\n")


def main():
    """Run all seed functions."""
    app = create_app()
    
    with app.app_context():
        print("\n" + "="*50)
        print("MUNLINK REGION 3 - DATABASE SEEDING")
        print("="*50 + "\n")
        
        try:
            seed_provinces()
            seed_municipalities()
            seed_document_types()
            seed_issue_categories()
            seed_lgu_document_types()
            # Seed a few benefit programs if none exist
            print("Seeding benefit programs...")
            if BenefitProgram.query.count() == 0:
                samples = [
                    BenefitProgram(name='Educational Assistance', code='EDU_ASSIST', description='Financial aid for qualified students', program_type='educational', municipality_id=None, eligibility_criteria={'resident': True}, required_documents=['Valid ID','Enrollment certificate'], is_active=True, is_accepting_applications=True),
                    BenefitProgram(name='Senior Citizen Subsidy', code='SENIOR_SUBSIDY', description='Monthly subsidy for seniors', program_type='financial', municipality_id=None, eligibility_criteria={'age': '>=60'}, required_documents=['Senior citizen ID'], is_active=True, is_accepting_applications=True),
                    BenefitProgram(name='Livelihood Starter Kit', code='LIVELIHOOD_KIT', description='Starter kits and training', program_type='livelihood', municipality_id=None, eligibility_criteria={'training': True}, required_documents=['Valid ID','Intent letter'], is_active=True, is_accepting_applications=True),
                ]
                for p in samples:
                    db.session.add(p)
                db.session.commit()
                print("Benefit programs seeded")
            else:
                print("Benefit programs already exist, skipping...")
            
            print("="*50)
            print("ALL DATA SEEDED SUCCESSFULLY!")
            print("="*50 + "\n")
            
        except Exception as e:
            print(f"\nERROR: {str(e)}\n")
            db.session.rollback()
            raise


if __name__ == '__main__':
    main()

