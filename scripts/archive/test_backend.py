#!/usr/bin/env python3
"""
Test script for MunLink Zambales Backend API
Run this from the project root directory
"""
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.abspath('.'))

def test_backend():
    print("Testing MunLink Zambales Backend API...")
    print("=" * 50)
    
    try:
        # Test imports
        print("1. Testing imports...")
        from apps.api.app import create_app, db, jwt
        print("   [OK] App and extensions imported")
        
        from apps.api.models import User, Municipality, Barangay
        print("   [OK] Models imported")
        
        from apps.api.routes import auth_bp, municipalities_bp, marketplace_bp
        print("   [OK] Routes imported")
        
        from apps.api.utils import validate_email, validate_username
        print("   [OK] Utilities imported")
        
        # Test app creation
        print("\n2. Testing Flask app creation...")
        app = create_app()
        print(f"   [OK] App created: {app.name}")
        print(f"   [OK] Debug mode: {app.config.get('DEBUG', False)}")
        print(f"   [OK] Registered blueprints: {len(app.blueprints)}")
        
        # Test routes
        print("\n3. Testing routes...")
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append(f"{rule.methods} {rule.rule}")
        
        print(f"   [OK] Found {len(routes)} routes:")
        for route in sorted(routes):
            print(f"     {route}")
        
        # Test database connection
        print("\n4. Testing database connection...")
        with app.app_context():
            # This will create the database file if it doesn't exist
            db.create_all()
            print("   [OK] Database connection successful")
            print("   [OK] Tables created successfully")
        
        print("\n" + "=" * 50)
        print("[SUCCESS] ALL TESTS PASSED!")
        print("[OK] Backend API is ready to use!")
        print("\nTo start the server:")
        print("  cd apps/api")
        print("  python app.py")
        print("\nServer will be available at: http://localhost:5000")
        
        return True
        
    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_backend()
    sys.exit(0 if success else 1)
