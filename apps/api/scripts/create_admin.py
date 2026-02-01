"""
Script to create a municipal admin user.
Run this script to create admin accounts for each municipality.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from apps.api.app import create_app, db
from apps.api.models.user import User
from apps.api.models.municipality import Municipality
from datetime import datetime, date
from getpass import getpass
import bcrypt


def create_admin():
    """Create a municipal admin user interactively."""
    print("\n" + "="*50)
    print("MUNLINK REGION 3 - CREATE ADMIN USER")
    print("="*50 + "\n")
    
    # List municipalities
    municipalities = Municipality.query.filter_by(is_active=True).all()
    
    print("Available Municipalities:")
    for idx, mun in enumerate(municipalities, 1):
        print(f"  {idx}. {mun.name}")
    
    print()
    
    # Get municipality selection
    while True:
        try:
            mun_choice = int(input("Select municipality number (or 0 to cancel): "))
            if mun_choice == 0:
                print("Cancelled.")
                return
            if 1 <= mun_choice <= len(municipalities):
                selected_municipality = municipalities[mun_choice - 1]
                break
            else:
                print("Invalid selection. Please try again.")
        except ValueError:
            print("Please enter a valid number.")
    
    print(f"\nCreating admin for: {selected_municipality.name}\n")
    
    # Get admin details
    username = input("Username: ").strip()
    email = input("Email: ").strip()
    
    # Check if username or email already exists
    if User.query.filter_by(username=username.lower()).first():
        print(f"Error: Username '{username}' already exists!")
        return
    
    if User.query.filter_by(email=email.lower()).first():
        print(f"Error: Email '{email}' already exists!")
        return
    
    # Get password
    while True:
        password = getpass("Password: ")
        password_confirm = getpass("Confirm Password: ")
        
        if password != password_confirm:
            print("Passwords do not match. Please try again.")
            continue
        
        if len(password) < 8:
            print("Password must be at least 8 characters long.")
            continue
        
        break
    
    # Get admin's personal information
    first_name = input("First Name: ").strip()
    middle_name = input("Middle Name (optional): ").strip() or None
    last_name = input("Last Name: ").strip()
    suffix = input("Suffix (optional): ").strip() or None
    
    # Get date of birth
    while True:
        try:
            dob_str = input("Date of Birth (YYYY-MM-DD): ").strip()
            dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
            break
        except ValueError:
            print("Invalid date format. Please use YYYY-MM-DD.")
    
    phone = input("Phone Number (optional): ").strip() or None
    
    # Hash password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create admin user
    admin_user = User(
        username=username.lower(),
        email=email.lower(),
        password_hash=password_hash,
        first_name=first_name.title(),
        middle_name=middle_name.title() if middle_name else None,
        last_name=last_name.title(),
        suffix=suffix,
        date_of_birth=dob,
        phone_number=phone,
        role='municipal_admin',
        admin_municipality_id=selected_municipality.id,
        municipality_id=selected_municipality.id,
        email_verified=True,
        admin_verified=True,
        email_verified_at=datetime.utcnow(),
        admin_verified_at=datetime.utcnow(),
        is_active=True
    )
    
    db.session.add(admin_user)
    db.session.commit()
    
    print("\n" + "="*50)
    print("✓ ADMIN USER CREATED SUCCESSFULLY!")
    print("="*50)
    print(f"\nUsername: {admin_user.username}")
    print(f"Email: {admin_user.email}")
    print(f"Municipality: {selected_municipality.name}")
    print(f"Role: {admin_user.role}")
    print("\nThe admin can now log in to the system.\n")


def create_admin_batch():
    """Create admin users from admins_gmails.txt file."""
    print("\n" + "="*50)
    print("MUNLINK REGION 3 - BATCH CREATE ADMIN USERS")
    print("="*50 + "\n")
    
    # Read admins file
    admins_file = os.path.join(os.path.dirname(__file__), '../../../admins_gmails.txt')
    
    if not os.path.exists(admins_file):
        print(f"Error: File not found: {admins_file}")
        print("Please create admins_gmails.txt with admin email addresses.")
        return
    
    with open(admins_file, 'r') as f:
        admin_emails = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    
    if not admin_emails:
        print("No admin emails found in file.")
        return
    
    print(f"Found {len(admin_emails)} admin emails.\n")
    
    # Get default password
    default_password = getpass("Enter default password for all admins: ")
    
    if len(default_password) < 8:
        print("Error: Password must be at least 8 characters long.")
        return
    
    # Hash password
    password_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create admins
    created_count = 0
    skipped_count = 0
    
    for email in admin_emails:
        # Extract municipality from email or prompt
        email_lower = email.lower()
        
        # Check if admin already exists
        if User.query.filter_by(email=email_lower).first():
            print(f"  - Skipping {email} (already exists)")
            skipped_count += 1
            continue
        
        # Generate username from email
        username = email_lower.split('@')[0].replace('.', '_')
        
        # Check if username exists
        if User.query.filter_by(username=username).first():
            username = f"{username}_{datetime.utcnow().strftime('%Y%m%d')}"
        
        # Prompt for municipality
        print(f"\nSetting up admin for: {email}")
        municipalities = Municipality.query.filter_by(is_active=True).all()
        
        for idx, mun in enumerate(municipalities, 1):
            print(f"  {idx}. {mun.name}")
        
        while True:
            try:
                mun_choice = int(input("Select municipality number: "))
                if 1 <= mun_choice <= len(municipalities):
                    selected_municipality = municipalities[mun_choice - 1]
                    break
                else:
                    print("Invalid selection.")
            except ValueError:
                print("Please enter a valid number.")
        
        # Create admin
        admin_user = User(
            username=username,
            email=email_lower,
            password_hash=password_hash,
            first_name='Admin',
            last_name=selected_municipality.name,
            date_of_birth=date(1990, 1, 1),  # Placeholder
            role='municipal_admin',
            admin_municipality_id=selected_municipality.id,
            municipality_id=selected_municipality.id,
            email_verified=True,
            admin_verified=True,
            email_verified_at=datetime.utcnow(),
            admin_verified_at=datetime.utcnow(),
            is_active=True
        )
        
        db.session.add(admin_user)
        print(f"  ✓ Created admin for {selected_municipality.name}")
        created_count += 1
    
    db.session.commit()
    
    print("\n" + "="*50)
    print(f"✓ BATCH ADMIN CREATION COMPLETE!")
    print("="*50)
    print(f"\nCreated: {created_count}")
    print(f"Skipped: {skipped_count}")
    print(f"\nAll admins have been created with the same password.")
    print("Please advise them to change their password after first login.\n")


def main():
    """Main function."""
    app = create_app()
    
    with app.app_context():
        # Check if municipalities exist
        mun_count = Municipality.query.count()
        
        if mun_count == 0:
            print("\nError: No municipalities found in database!")
            print("Please run seed_data.py first.\n")
            return
        
        print("\nSelect option:")
        print("  1. Create single admin user (interactive)")
        print("  2. Batch create admin users from file")
        print("  0. Cancel")
        
        choice = input("\nYour choice: ").strip()
        
        if choice == '1':
            create_admin()
        elif choice == '2':
            create_admin_batch()
        elif choice == '0':
            print("Cancelled.")
        else:
            print("Invalid choice.")


if __name__ == '__main__':
    main()

