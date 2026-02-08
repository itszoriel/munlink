#!/usr/bin/env python3
"""
Check a specific user's municipality information from the database.
"""
from apps.api import db

import sys
import os

# Ensure project root is importable
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '../../..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apps.api.app import create_app
from apps.api.models.user import User
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.province import Province

def check_user(username):
    app = create_app()
    with app.app_context():
        print("\n" + "=" * 64)
        print(f"CHECKING USER: {username}")
        print("=" * 64 + "\n")
        
        # Find user by username
        user = User.query.filter_by(username=username).first()
        
        if not user:
            print(f"[ERROR] User '{username}' not found in database.")
            return
        
        print(f"[OK] User found:")
        print(f"   ID: {user.id}")
        print(f"   Username: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   Name: {user.first_name} {user.middle_name or ''} {user.last_name}".strip())
        print(f"   Role: {user.role}")
        print()
        
        # Check municipality
        if user.municipality_id:
            municipality = db.session.get(Municipality, user.municipality_id)
            if municipality:
                print(f"[LOCATION] Registered Municipality:")
                print(f"   ID: {municipality.id}")
                print(f"   Name: {municipality.name}")
                print(f"   Slug: {municipality.slug}")
                
                # Get province
                if municipality.province_id:
                    province = db.session.get(Province, municipality.province_id)
                    if province:
                        print(f"   Province: {province.name} (ID: {province.id}, Slug: {province.slug})")
                print()
            else:
                print(f"[WARNING] Municipality ID {user.municipality_id} not found in database.")
        else:
            print(f"[WARNING] User has no municipality_id set.")
        
        # Check barangay
        if user.barangay_id:
            barangay = db.session.get(Barangay, user.barangay_id)
            if barangay:
                print(f"[BARANGAY] Registered Barangay:")
                print(f"   ID: {barangay.id}")
                print(f"   Name: {barangay.name}")
                print(f"   Slug: {barangay.slug}")
                if barangay.municipality_id:
                    brgy_muni = db.session.get(Municipality, barangay.municipality_id)
                    if brgy_muni:
                        print(f"   Municipality: {brgy_muni.name}")
                print()
            else:
                print(f"[WARNING] Barangay ID {user.barangay_id} not found in database.")
        else:
            print(f"[WARNING] User has no barangay_id set.")
        
        # Check admin municipality (if admin)
        if user.role == 'municipal_admin' and user.admin_municipality_id:
            admin_muni = db.session.get(Municipality, user.admin_municipality_id)
            if admin_muni:
                print(f"[ADMIN] Admin Municipality:")
                print(f"   ID: {admin_muni.id}")
                print(f"   Name: {admin_muni.name}")
                print(f"   Slug: {admin_muni.slug}")
                print()
        
        print("=" * 64 + "\n")

if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'princhprays'
    check_user(username)

