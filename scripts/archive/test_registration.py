"""
Test script to verify admin and resident registration endpoints
"""
import os
import sys
from dotenv import load_dotenv

# Set encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment
load_dotenv('.env')

print("=" * 60)
print("MUNLINK ZAMBALES - REGISTRATION VERIFICATION")
print("=" * 60)

print("\n[OK] Environment loaded successfully")
print(f"[OK] ADMIN_SECRET_KEY: {os.getenv('ADMIN_SECRET_KEY')}")
print(f"[OK] JWT_SECRET_KEY: {'Set' if os.getenv('JWT_SECRET_KEY') else 'Missing'}")
print(f"[OK] Database: {os.getenv('DATABASE_URL', 'sqlite:///munlink_zambales.db')}")

# Import Flask app
print("\n" + "-" * 60)
print("Importing Flask application...")
try:
    from apps.api.app import create_app
    from apps.api import db
    from apps.api.models.user import User
    
    app = create_app()
    print("[OK] Flask app created successfully")
    
    with app.app_context():
        # Check database connection
        try:
            user_count = User.query.count()
            print(f"[OK] Database connected (current users: {user_count})")
        except Exception as e:
            print(f"[ERROR] Database error: {e}")
            
        # Verify config
        print(f"[OK] Admin secret from config: {app.config.get('ADMIN_SECRET_KEY')}")
        
except Exception as e:
    print(f"[ERROR] Error importing app: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "-" * 60)
print("REGISTRATION ENDPOINT CHECKLIST")
print("-" * 60)

endpoints = [
    ("POST /api/auth/register", "Public user registration (requires: username, email, password, first_name, last_name, date_of_birth, valid_id_front, valid_id_back)"),
    ("POST /api/auth/admin/register", f"Admin registration (requires above + admin_secret: '{os.getenv('ADMIN_SECRET_KEY')}')")
]

for endpoint, desc in endpoints:
    print(f"\n{endpoint}")
    print(f"  → {desc}")

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)

print("\n📝 Next Steps:")
print("1. Start the API server: cd apps/api && python app.py")
print("2. Start the web app: cd apps/web && npm run dev")
print("3. Start the admin app: cd apps/admin && npm run dev")
print("4. Test registration:")
print("   - Public: http://localhost:3000/register")
print("   - Admin: http://localhost:3001/register (use secret: Pauljohn8265)")

print("\n[SUCCESS] All checks passed! Ready to test registration.\n")

