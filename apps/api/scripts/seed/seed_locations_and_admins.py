
"""
Seed all locations and create admin users for all municipalities.
Format:
- username: municipalityname_admin
- password: municipalityname@Munlink2026
- email: municipalityname.munlink@gmail.com
"""
import sys
from apps.api.utils.time import utc_now
import os
from datetime import datetime, date
from pathlib import Path
from dotenv import load_dotenv

# Ensure project root is importable (four levels up from seed folder)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
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
from apps.api.models.user import User
from apps.api.models.municipality import Municipality
from apps.api.scripts.seed_data import seed_provinces, seed_municipalities, get_slug
import bcrypt

app = create_app(ProductionConfig)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

print("\n" + "="*60)
print("SEEDING LOCATIONS AND CREATING ADMIN USERS")
print("="*60)

with app.app_context():
    # Step 1: Seed locations
    print("\n[STEP 1] Seeding locations (provinces, municipalities, barangays)...")
    try:
        seed_provinces()
        seed_municipalities()
        print("[OK] Locations seeded successfully!")
    except Exception as e:
        print(f"[WARNING] Location seeding error (may already exist): {e}")
        db.session.rollback()
    
    # Step 2: Get all municipalities (with fresh session)
    try:
        municipalities = Municipality.query.filter_by(is_active=True).order_by(Municipality.name).all()
    except Exception as e:
        print(f"[ERROR] Failed to query municipalities: {e}")
        db.session.rollback()
        # Try again with fresh connection
        municipalities = Municipality.query.filter_by(is_active=True).order_by(Municipality.name).all()
    print(f"\n[STEP 2] Found {len(municipalities)} municipalities")
    
    # Step 3: Create admin users
    print("\n[STEP 3] Creating admin users...")
    
    credentials = []
    created_count = 0
    skipped_count = 0
    
    for municipality in municipalities:
        # Generate credentials based on municipality name
        mun_name_lower = municipality.name.lower().replace(' ', '')
        username = f"{mun_name_lower}_admin"
        password = f"{mun_name_lower}@Munlink2026"
        email = f"{mun_name_lower}.munlink@gmail.com"
        
        # Check if user already exists
        existing_user = User.query.filter(
            (User.username == username) | (User.email == email)
        ).first()
        
        if existing_user:
            print(f"  [SKIP] {municipality.name} - Admin already exists")
            skipped_count += 1
            # Still add to credentials list for output
            credentials.append({
                'province': municipality.province.name if municipality.province else 'N/A',
                'municipality': municipality.name,
                'username': username,
                'password': password,
                'email': email,
                'status': 'EXISTING'
            })
            continue
        
        try:
            # Hash password
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create admin user
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
                email_verified_at=utc_now(),
                admin_verified_at=utc_now(),
                is_active=True
            )
            
            db.session.add(admin_user)
            db.session.flush()
            
            print(f"  [OK] {municipality.name}")
            created_count += 1
            
            credentials.append({
                'province': municipality.province.name if municipality.province else 'N/A',
                'municipality': municipality.name,
                'username': username,
                'password': password,
                'email': email,
                'status': 'CREATED'
            })
        except Exception as e:
            print(f"  [ERROR] {municipality.name} - Failed: {e}")
            try:
                db.session.rollback()
            except:
                pass
    
    # Commit all changes
    try:
        db.session.commit()
        print(f"\n[OK] Committed all changes")
    except Exception as e:
        print(f"\n[ERROR] Failed to commit: {e}")
        db.session.rollback()
    
    # Step 4: Output credentials
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"  Total municipalities: {len(municipalities)}")
    print(f"  Created: {created_count}")
    print(f"  Skipped (already exist): {skipped_count}")
    
    print("\n" + "="*60)
    print("FULL CREDENTIALS LIST")
    print("="*60)
    print("\nFormat: Province | Municipality | Username | Password | Email")
    print("-" * 100)
    
    for cred in credentials:
        status_marker = "[EXISTING]" if cred['status'] == 'EXISTING' else "[NEW]"
        print(f"{status_marker} {cred['province']:20s} | {cred['municipality']:30s} | {cred['username']:30s} | {cred['password']:30s} | {cred['email']}")
    
    # Also save to file
    output_file = os.path.join(project_root, 'admin_credentials.txt')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("="*80 + "\n")
        f.write("MUNLINK REGION 3 - ADMIN CREDENTIALS\n")
        f.write("="*80 + "\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total municipalities: {len(municipalities)}\n")
        f.write(f"Created: {created_count}\n")
        f.write(f"Skipped: {skipped_count}\n\n")
        f.write("="*80 + "\n")
        f.write("CREDENTIALS\n")
        f.write("="*80 + "\n\n")
        f.write(f"{'Province':<20} | {'Municipality':<30} | {'Username':<30} | {'Password':<30} | {'Email':<50}\n")
        f.write("-" * 160 + "\n")
        for cred in credentials:
            f.write(f"{cred['province']:<20} | {cred['municipality']:<30} | {cred['username']:<30} | {cred['password']:<30} | {cred['email']:<50}\n")
    
    print(f"\n[OK] Credentials saved to: {output_file}")
    print("\n" + "="*60)
    print("COMPLETE!")
    print("="*60 + "\n")
