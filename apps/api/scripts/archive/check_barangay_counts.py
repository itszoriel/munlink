"""
Check barangay counts by province.
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
from apps.api.models.municipality import Barangay, Municipality
from apps.api.models.province import Province

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

with app.app_context():
    provinces = Province.query.order_by(Province.name).all()
    
    print("\n" + "="*70)
    print("BARANGAY COUNT BY PROVINCE")
    print("="*70)
    
    total = 0
    for province in provinces:
        municipalities = Municipality.query.filter_by(
            province_id=province.id,
            is_active=True
        ).all()
        
        province_count = 0
        for mun in municipalities:
            barangays = Barangay.query.filter_by(
                municipality_id=mun.id,
                is_active=True
            ).count()
            province_count += barangays
        
        total += province_count
        print(f"  {province.name}: {province_count} barangays")
    
    print(f"\n  Total barangays: {total}")
    print("="*70 + "\n")

















