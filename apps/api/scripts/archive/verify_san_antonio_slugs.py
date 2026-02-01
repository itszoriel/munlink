"""
Verify and fix San Antonio slugs in database to match locations.ts
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

env_path = Path(project_root) / '.env'
if env_path.exists():
    load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required.")

from apps.api.app import create_app
from apps.api.config import ProductionConfig
from apps.api import db
from apps.api.models.municipality import Municipality
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

with app.app_context():
    nueva_ecija = Province.query.filter_by(name='Nueva Ecija').first()
    zambales = Province.query.filter_by(name='Zambales').first()
    
    san_antonio_ne = Municipality.query.filter_by(province_id=nueva_ecija.id, name='San Antonio').first()
    san_antonio_z = Municipality.query.filter_by(province_id=zambales.id, name='San Antonio').first()
    
    print(f"Nueva Ecija San Antonio: ID={san_antonio_ne.id}, slug={san_antonio_ne.slug}")
    print(f"Zambales San Antonio: ID={san_antonio_z.id}, slug={san_antonio_z.slug}")
    
    # Update slugs to match locations.ts
    if san_antonio_ne.slug != 'san-antonio-nueva-ecija':
        print(f"\nUpdating Nueva Ecija San Antonio slug from '{san_antonio_ne.slug}' to 'san-antonio-nueva-ecija'")
        san_antonio_ne.slug = 'san-antonio-nueva-ecija'
        db.session.commit()
        print("[OK] Updated")
    
    if san_antonio_z.slug != 'san-antonio-zambales':
        print(f"\nUpdating Zambales San Antonio slug from '{san_antonio_z.slug}' to 'san-antonio-zambales'")
        san_antonio_z.slug = 'san-antonio-zambales'
        db.session.commit()
        print("[OK] Updated")
    
    if san_antonio_ne.slug == 'san-antonio-nueva-ecija' and san_antonio_z.slug == 'san-antonio-zambales':
        print("\n[OK] All slugs are correct!")

















