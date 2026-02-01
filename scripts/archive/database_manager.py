#!/usr/bin/env python3
"""
MunLink Zambales - Database Management Script
Comprehensive script for managing users, admins, and database cleanup
"""

import sys
import os
import json
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

class DatabaseManager:
    def __init__(self, db_path='munlink_zambales.db'):
        """Initialize database manager."""
        self.db_path = db_path
        self.upload_dir = Path('uploads')
        self.municipalities_file = 'data/locations/zambales_municipalities.json'
        
    def connect(self):
        """Connect to database."""
        return sqlite3.connect(self.db_path)
    
    def check_all_users(self):
        """Check all users in the database."""
        print("\n" + "="*60)
        print("ALL USERS IN DATABASE")
        print("="*60)
        
        conn = self.connect()
        cursor = conn.cursor()
        
        # Get all users
        cursor.execute("""
            SELECT id, username, email, first_name, last_name, role, 
                   profile_picture, valid_id_front, valid_id_back, created_at
            FROM users 
            ORDER BY created_at DESC
        """)
        
        users = cursor.fetchall()
        
        if not users:
            print("No users found in database.")
            return []
        
        print(f"Total users: {len(users)}")
        print("-" * 60)
        
        for user in users:
            user_id, username, email, first_name, last_name, role, profile_pic, id_front, id_back, created_at = user
            admin_status = "ADMIN" if role in ("admin", "municipal_admin") else "RESIDENT"
            print(f"ID: {user_id:3d} | {admin_status:8s} | {username:20s} | {email:30s} | {first_name} {last_name}")
            if profile_pic:
                print(f"     Profile: {profile_pic}")
            if id_front:
                print(f"     ID Front: {id_front}")
            if id_back:
                print(f"     ID Back: {id_back}")
            print(f"     Created: {created_at}")
            print("-" * 60)
        
        conn.close()
        return users
    
    def check_admin_users(self):
        """Check only admin users."""
        print("\n" + "="*60)
        print("ADMIN USERS ONLY")
        print("="*60)
        
        conn = self.connect()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, username, email, first_name, last_name, 
                   profile_picture, valid_id_front, valid_id_back, created_at
            FROM users 
            WHERE role IN ('admin', 'municipal_admin')
            ORDER BY created_at DESC
        """)
        
        admins = cursor.fetchall()
        
        if not admins:
            print("No admin users found.")
            return []
        
        print(f"Total admin users: {len(admins)}")
        print("-" * 60)
        
        for admin in admins:
            user_id, username, email, first_name, last_name, profile_pic, id_front, id_back, created_at = admin
            print(f"ID: {user_id:3d} | ADMIN | {username:20s} | {email:30s} | {first_name} {last_name}")
            if profile_pic:
                print(f"     Profile: {profile_pic}")
            if id_front:
                print(f"     ID Front: {id_front}")
            if id_back:
                print(f"     ID Back: {id_back}")
            print(f"     Created: {created_at}")
            print("-" * 60)
        
        conn.close()
        return admins
    
    def delete_user(self, user_id):
        """Delete a specific user and their files."""
        conn = self.connect()
        cursor = conn.cursor()
        
        # Get user info before deletion
        cursor.execute("SELECT username, role, profile_picture, valid_id_front, valid_id_back FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            print(f"User with ID {user_id} not found.")
            conn.close()
            return False
        
        username, role, profile_pic, id_front, id_back = user
        user_type = "ADMIN" if role in ("admin", "municipal_admin") else "RESIDENT"
        
        print(f"\nDeleting {user_type} user: {username} (ID: {user_id})")
        
        # Delete user files
        files_deleted = []
        if profile_pic:
            file_path = self.upload_dir / profile_pic
            if file_path.exists():
                file_path.unlink()
                files_deleted.append(str(file_path))
        
        if id_front:
            file_path = self.upload_dir / id_front
            if file_path.exists():
                file_path.unlink()
                files_deleted.append(str(file_path))
        
        if id_back:
            file_path = self.upload_dir / id_back
            if file_path.exists():
                file_path.unlink()
                files_deleted.append(str(file_path))
        
        # Delete user directory if empty
        if profile_pic:
            user_dir = self.upload_dir / os.path.dirname(profile_pic)
            if user_dir.exists() and not any(user_dir.iterdir()):
                user_dir.rmdir()
                print(f"Removed empty directory: {user_dir}")
        
        # Delete from database
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        
        print(f"✓ User {username} deleted successfully")
        if files_deleted:
            print(f"✓ Deleted {len(files_deleted)} files")
            for file in files_deleted:
                print(f"  - {file}")
        
        conn.close()
        return True
    
    def delete_all_admins(self):
        """Delete all admin users."""
        print("\n" + "="*60)
        print("DELETING ALL ADMIN USERS")
        print("="*60)
        
        conn = self.connect()
        cursor = conn.cursor()
        
        # Get all admin users
        cursor.execute("SELECT id, username FROM users WHERE role IN ('admin', 'municipal_admin')")
        admins = cursor.fetchall()
        
        if not admins:
            print("No admin users found to delete.")
            conn.close()
            return
        
        print(f"Found {len(admins)} admin users to delete:")
        for admin_id, username in admins:
            print(f"  - {username} (ID: {admin_id})")
        
        # Confirm deletion
        confirm = input(f"\nAre you sure you want to delete all {len(admins)} admin users? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Deletion cancelled.")
            conn.close()
            return
        
        # Delete each admin
        deleted_count = 0
        for admin_id, username in admins:
            if self.delete_user(admin_id):
                deleted_count += 1
        
        print(f"\n✓ Deleted {deleted_count} admin users")
        conn.close()
    
    def delete_all_residents(self):
        """Delete all resident users."""
        print("\n" + "="*60)
        print("DELETING ALL RESIDENT USERS")
        print("="*60)
        
        conn = self.connect()
        cursor = conn.cursor()
        
        # Get all resident users
        cursor.execute("SELECT id, username FROM users WHERE role = 'resident'")
        residents = cursor.fetchall()
        
        if not residents:
            print("No resident users found to delete.")
            conn.close()
            return
        
        print(f"Found {len(residents)} resident users to delete:")
        for user_id, username in residents:
            print(f"  - {username} (ID: {user_id})")
        
        # Confirm deletion
        confirm = input(f"\nAre you sure you want to delete all {len(residents)} resident users? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Deletion cancelled.")
            conn.close()
            return
        
        # Delete each resident
        deleted_count = 0
        for user_id, username in residents:
            if self.delete_user(user_id):
                deleted_count += 1
        
        print(f"\n✓ Deleted {deleted_count} resident users")
        conn.close()
    
    def clear_all_users(self):
        """Delete all users (both admins and residents)."""
        print("\n" + "="*60)
        print("CLEARING ALL USERS")
        print("="*60)
        
        conn = self.connect()
        cursor = conn.cursor()
        
        # Get all users
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        if total_users == 0:
            print("No users found to delete.")
            conn.close()
            return
        
        print(f"Found {total_users} users to delete.")
        
        # Confirm deletion
        confirm = input(f"\nAre you sure you want to delete ALL {total_users} users? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Deletion cancelled.")
            conn.close()
            return
        
        # Delete all users
        cursor.execute("DELETE FROM users")
        conn.commit()
        
        print(f"✓ Deleted all {total_users} users")
        conn.close()
    
    def clear_uploads(self):
        """Clear all uploads directory while preserving structure."""
        print("\n" + "="*60)
        print("CLEARING UPLOADS DIRECTORY")
        print("="*60)
        
        if not self.upload_dir.exists():
            print("Uploads directory does not exist.")
            return
        
        # Get all files in uploads
        all_files = list(self.upload_dir.rglob('*'))
        files = [f for f in all_files if f.is_file()]
        
        if not files:
            print("No files found in uploads directory.")
            return
        
        print(f"Found {len(files)} files in uploads directory:")
        for file in files[:10]:  # Show first 10 files
            print(f"  - {file}")
        if len(files) > 10:
            print(f"  ... and {len(files) - 10} more files")
        
        # Confirm deletion
        confirm = input(f"\nAre you sure you want to delete all {len(files)} files? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Deletion cancelled.")
            return
        
        # Delete all files
        deleted_count = 0
        for file in files:
            try:
                file.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"Error deleting {file}: {e}")
        
        # Remove empty directories
        for dir_path in sorted(self.upload_dir.rglob('*'), reverse=True):
            if dir_path.is_dir() and dir_path != self.upload_dir:
                try:
                    if not any(dir_path.iterdir()):
                        dir_path.rmdir()
                except Exception as e:
                    print(f"Error removing directory {dir_path}: {e}")
        
        print(f"✓ Deleted {deleted_count} files")
        print("✓ Cleaned up empty directories")
    
    def preserve_municipalities(self):
        """Ensure municipalities data is preserved."""
        print("\n" + "="*60)
        print("PRESERVING MUNICIPALITIES DATA")
        print("="*60)
        
        # Check if municipalities file exists
        if not os.path.exists(self.municipalities_file):
            print(f"Municipalities file not found: {self.municipalities_file}")
            return False
        
        # Load municipalities data
        with open(self.municipalities_file, 'r') as f:
            municipalities_data = json.load(f)
        
        print(f"Loaded {len(municipalities_data)} municipalities from {self.municipalities_file}")
        
        # Check current municipalities in database
        conn = self.connect()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM municipalities")
        current_count = cursor.fetchone()[0]
        print(f"Current municipalities in database: {current_count}")
        
        # Clear and repopulate municipalities
        cursor.execute("DELETE FROM municipalities")
        
        # Insert all municipalities
        for name, data in municipalities_data.items():
            slug = name.lower().replace(' ', '-')
            cursor.execute("""
                INSERT INTO municipalities (name, slug, psgc_code, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (name, slug, data['psgc_code'], 1))
        
        conn.commit()
        print(f"✓ Preserved {len(municipalities_data)} municipalities in database")
        
        conn.close()
        return True
    
    def full_cleanup(self):
        """Perform full database cleanup while preserving municipalities."""
        print("\n" + "="*60)
        print("FULL DATABASE CLEANUP")
        print("="*60)
        
        print("This will:")
        print("1. Delete ALL users (admins and residents)")
        print("2. Clear ALL uploads")
        print("3. Preserve municipalities data")
        print("4. Keep database structure intact")
        
        confirm = input("\nAre you sure you want to proceed? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Cleanup cancelled.")
            return
        
        # Step 1: Clear all users
        self.clear_all_users()
        
        # Step 2: Clear uploads
        self.clear_uploads()
        
        # Step 3: Preserve municipalities
        self.preserve_municipalities()
        
        print("\n✓ Full cleanup completed successfully!")
        print("✓ Database structure preserved")
        print("✓ Municipalities data preserved")
        print("✓ All users and files removed")
    
    def show_menu(self):
        """Show main menu."""
        while True:
            print("\n" + "="*60)
            print("MUNLINK ZAMBALES - DATABASE MANAGER")
            print("="*60)
            print("1. Check all users")
            print("2. Check admin users only")
            print("3. Delete specific user")
            print("4. Delete all admin users")
            print("5. Delete all resident users")
            print("6. Clear all users")
            print("7. Clear uploads directory")
            print("8. Preserve municipalities data")
            print("9. Full cleanup (users + uploads + preserve municipalities)")
            print("0. Exit")
            print("="*60)
            
            choice = input("Enter your choice (0-9): ").strip()
            
            if choice == '0':
                print("Goodbye!")
                break
            elif choice == '1':
                self.check_all_users()
            elif choice == '2':
                self.check_admin_users()
            elif choice == '3':
                try:
                    user_id = int(input("Enter user ID to delete: "))
                    self.delete_user(user_id)
                except ValueError:
                    print("Invalid user ID.")
            elif choice == '4':
                self.delete_all_admins()
            elif choice == '5':
                self.delete_all_residents()
            elif choice == '6':
                self.clear_all_users()
            elif choice == '7':
                self.clear_uploads()
            elif choice == '8':
                self.preserve_municipalities()
            elif choice == '9':
                self.full_cleanup()
            else:
                print("Invalid choice. Please try again.")
            
            input("\nPress Enter to continue...")

def main():
    """Main function."""
    print("MunLink Zambales - Database Manager")
    print("=" * 60)
    
    # Check if database exists
    db_path = 'munlink_zambales.db'
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        print("Please run this script from the project root directory.")
        return
    
    # Initialize database manager
    db_manager = DatabaseManager(db_path)
    
    # Show menu
    db_manager.show_menu()

if __name__ == '__main__':
    main()
