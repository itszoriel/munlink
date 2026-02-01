#!/usr/bin/env python3
"""
MunLink Zambales - Quick Database Operations
Command-line script for quick database operations
"""

import sys
import os
import json
import sqlite3
import shutil
from pathlib import Path

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

def connect_db():
    """Connect to database."""
    return sqlite3.connect('munlink_zambales.db')

def check_users():
    """Check all users."""
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM users")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE role IN ('admin', 'municipal_admin')")
    admins = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'resident'")
    residents = cursor.fetchone()[0]
    
    print(f"Total users: {total}")
    print(f"Admins: {admins}")
    print(f"Residents: {residents}")
    
    conn.close()

def list_users():
    """List all users."""
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, first_name, last_name, role, created_at
        FROM users 
        ORDER BY created_at DESC
    """)
    
    users = cursor.fetchall()
    
    if not users:
        print("No users found.")
        return
    
    print(f"{'ID':<3} {'Type':<8} {'Username':<20} {'Email':<30} {'Name':<25} {'Created'}")
    print("-" * 100)
    
    for user in users:
        user_id, username, email, first_name, last_name, role, created_at = user
        user_type = "ADMIN" if role in ("admin", "municipal_admin") else "RESIDENT"
        name = f"{first_name} {last_name}"
        print(f"{user_id:<3} {user_type:<8} {username:<20} {email:<30} {name:<25} {created_at}")
    
    conn.close()

def delete_user(user_id):
    """Delete specific user."""
    conn = connect_db()
    cursor = conn.cursor()
    
    # Get user info
    cursor.execute("SELECT username, role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        print(f"User with ID {user_id} not found.")
        conn.close()
        return
    
    username, role = user
    user_type = "ADMIN" if role in ("admin", "municipal_admin") else "RESIDENT"
    
    # Delete user
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    
    print(f"Deleted {user_type} user: {username} (ID: {user_id})")
    conn.close()

def clear_all_users():
    """Clear all users."""
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    
    if count == 0:
        print("No users to delete.")
        conn.close()
        return
    
    cursor.execute("DELETE FROM users")
    conn.commit()
    
    print(f"Deleted {count} users")
    conn.close()

def clear_uploads():
    """Clear uploads directory."""
    upload_dir = Path('uploads')
    
    if not upload_dir.exists():
        print("Uploads directory not found.")
        return
    
    # Count files
    files = list(upload_dir.rglob('*'))
    file_count = len([f for f in files if f.is_file()])
    
    if file_count == 0:
        print("No files to delete.")
        return
    
    # Delete all files
    deleted = 0
    for file in files:
        if file.is_file():
            try:
                file.unlink()
                deleted += 1
            except Exception as e:
                print(f"Error deleting {file}: {e}")
    
    # Remove empty directories
    for dir_path in sorted(upload_dir.rglob('*'), reverse=True):
        if dir_path.is_dir() and dir_path != upload_dir:
            try:
                if not any(dir_path.iterdir()):
                    dir_path.rmdir()
            except Exception:
                pass
    
    print(f"Deleted {deleted} files")

def preserve_municipalities():
    """Preserve municipalities data."""
    municipalities_file = 'data/locations/zambales_municipalities.json'
    
    if not os.path.exists(municipalities_file):
        print(f"Municipalities file not found: {municipalities_file}")
        return
    
    # Load municipalities data
    with open(municipalities_file, 'r') as f:
        municipalities_data = json.load(f)
    
    # Update database
    conn = connect_db()
    cursor = conn.cursor()
    
    # Clear existing municipalities
    cursor.execute("DELETE FROM municipalities")
    
    # Insert municipalities
    for name, data in municipalities_data.items():
        slug = name.lower().replace(' ', '-')
        cursor.execute("""
            INSERT INTO municipalities (name, slug, psgc_code, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        """, (name, slug, data['psgc_code'], 1))
    
    conn.commit()
    print(f"Preserved {len(municipalities_data)} municipalities")
    conn.close()

def full_cleanup():
    """Full cleanup: users + uploads + preserve municipalities."""
    print("Performing full cleanup...")
    
    # Clear users
    clear_all_users()
    
    # Clear uploads
    clear_uploads()
    
    # Preserve municipalities
    preserve_municipalities()
    
    print("Full cleanup completed!")

def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage: python quick_db_ops.py <command> [args]")
        print("\nCommands:")
        print("  check-users          - Check user counts")
        print("  list-users           - List all users")
        print("  delete-user <id>     - Delete specific user")
        print("  clear-users          - Clear all users")
        print("  clear-uploads        - Clear uploads directory")
        print("  preserve-municipalities - Preserve municipalities data")
        print("  full-cleanup         - Full cleanup (users + uploads + municipalities)")
        return
    
    command = sys.argv[1]
    
    if command == 'check-users':
        check_users()
    elif command == 'list-users':
        list_users()
    elif command == 'delete-user':
        if len(sys.argv) < 3:
            print("Usage: python quick_db_ops.py delete-user <user_id>")
            return
        try:
            user_id = int(sys.argv[2])
            delete_user(user_id)
        except ValueError:
            print("Invalid user ID")
    elif command == 'clear-users':
        clear_all_users()
    elif command == 'clear-uploads':
        clear_uploads()
    elif command == 'preserve-municipalities':
        preserve_municipalities()
    elif command == 'full-cleanup':
        full_cleanup()
    else:
        print(f"Unknown command: {command}")

if __name__ == '__main__':
    main()
