#!/usr/bin/env python3
"""
Update database schema for MunLink Region 3
This script adds missing columns to existing tables
"""

import sys
import os

# Resolve project root (three levels up) so we can import apps.api.* consistently
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, '../../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from apps.api.app import create_app
from apps.api import db

def update_database():
    """Add missing columns to existing tables"""
    print("Updating MunLink Region 3 database...")

    try:
        # Create Flask app
        app = create_app()

        with app.app_context():
            # Add images column to announcements table if it doesn't exist
            try:
                # Check if the column exists
                from sqlalchemy import text
                result = db.session.execute(text("PRAGMA table_info(announcements)")).fetchall()
                columns = [row[1] for row in result]

                if 'images' not in columns:
                    print("Adding 'images' column to announcements table...")
                    db.session.execute(text("ALTER TABLE announcements ADD COLUMN images TEXT"))
                    print("Added images column to announcements table")
                else:
                    print("Images column already exists in announcements table")

                # Add ready_at and completed_at columns to document_requests table if they don't exist
                result = db.session.execute(text("PRAGMA table_info(document_requests)")).fetchall()
                columns = [row[1] for row in result]

                if 'ready_at' not in columns:
                    print("Adding 'ready_at' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN ready_at DATETIME"))
                    print("Added ready_at column to document_requests table")
                else:
                    print("Ready_at column already exists in document_requests table")

                if 'completed_at' not in columns:
                    print("Adding 'completed_at' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN completed_at DATETIME"))
                    print("Added completed_at column to document_requests table")
                else:
                    print("Completed_at column already exists in document_requests table")

                # Add approved_at column to document_requests table if it doesn't exist
                if 'approved_at' not in columns:
                    print("Adding 'approved_at' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN approved_at DATETIME"))
                    print("Added approved_at column to document_requests table")
                else:
                    print("Approved_at column already exists in document_requests table")

                # Add qr_code and qr_data columns to document_requests table if they don't exist
                if 'qr_code' not in columns:
                    print("Adding 'qr_code' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN qr_code TEXT"))
                    print("Added qr_code column to document_requests table")
                else:
                    print("QR_code column already exists in document_requests table")

                if 'qr_data' not in columns:
                    print("Adding 'qr_data' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN qr_data TEXT"))
                    print("Added qr_data column to document_requests table")
                else:
                    print("QR_data column already exists in document_requests table")

                # Add document_file column to document_requests table if it doesn't exist
                if 'document_file' not in columns:
                    print("Adding 'document_file' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN document_file TEXT"))
                    print("Added document_file column to document_requests table")
                else:
                    print("Document_file column already exists in document_requests table")

                # Add rejection_reason column to document_requests table if it doesn't exist
                if 'rejection_reason' not in columns:
                    print("Adding 'rejection_reason' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN rejection_reason TEXT"))
                    print("Added rejection_reason column to document_requests table")
                else:
                    print("Rejection_reason column already exists in document_requests table")

                # Add audit JSON columns to document_requests table if they don't exist
                if 'resident_input' not in columns:
                    print("Adding 'resident_input' column to document_requests table...")
                    # Use TEXT for SQLite compatibility; app treats as JSON
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN resident_input TEXT"))
                    print("Added resident_input column to document_requests table")
                else:
                    print("Resident_input column already exists in document_requests table")

                if 'admin_edited_content' not in columns:
                    print("Adding 'admin_edited_content' column to document_requests table...")
                    db.session.execute(text("ALTER TABLE document_requests ADD COLUMN admin_edited_content TEXT"))
                    print("Added admin_edited_content column to document_requests table")
                else:
                    print("Admin_edited_content column already exists in document_requests table")

                # Check and add columns to issues table
                result = db.session.execute(text("PRAGMA table_info(issues)")).fetchall()
                columns = [row[1] for row in result]

                # Add columns that might be missing from issues table
                missing_issue_columns = [
                    'admin_notes', 'admin_response', 'admin_response_by', 'admin_response_at',
                    'resolution_notes', 'status_updated_by', 'status_updated_at', 'reviewed_at',
                    'resolved_at', 'is_public', 'upvote_count', 'issue_number'
                ]

                for col in missing_issue_columns:
                    if col not in columns:
                        if col in ['admin_notes', 'admin_response', 'resolution_notes', 'issue_number']:
                            col_type = 'TEXT'
                        elif col in ['admin_response_by', 'status_updated_by']:
                            col_type = 'INTEGER'
                        elif col in ['admin_response_at', 'status_updated_at', 'reviewed_at', 'resolved_at']:
                            col_type = 'DATETIME'
                        elif col in ['is_public', 'upvote_count']:
                            col_type = 'INTEGER' if col == 'upvote_count' else 'BOOLEAN'
                        else:
                            col_type = 'TEXT'

                        print(f"Adding '{col}' column to issues table...")
                        db.session.execute(text(f"ALTER TABLE issues ADD COLUMN {col} {col_type}"))
                        print(f"Added {col} column to issues table")
                    else:
                        print(f"{col} column already exists in issues table")

                # Check and add columns to items table (marketplace)
                result = db.session.execute(text("PRAGMA table_info(items)")).fetchall()
                columns = [row[1] for row in result]

                missing_item_columns = [
                    'approved_by', 'approved_at', 'rejected_by', 'rejected_at', 'rejection_reason',
                    'view_count', 'completed_at', 'updated_at'
                ]

                for col in missing_item_columns:
                    if col not in columns:
                        if col in ['approved_by', 'rejected_by', 'view_count']:
                            col_type = 'INTEGER'
                        elif col in ['approved_at', 'rejected_at', 'completed_at', 'updated_at']:
                            col_type = 'DATETIME'
                        else:
                            col_type = 'TEXT'

                        print(f"Adding '{col}' column to items table...")
                        db.session.execute(text(f"ALTER TABLE items ADD COLUMN {col} {col_type}"))
                        print(f"Added {col} column to items table")
                    else:
                        print(f"{col} column already exists in items table")

                # Check and add columns to users table
                result = db.session.execute(text("PRAGMA table_info(users)")).fetchall()
                columns = [row[1] for row in result]

                missing_user_columns = [
                    'admin_municipality_id', 'valid_id_front', 'valid_id_back', 'proof_of_residency',
                    'selfie_with_id', 'email_verified_at', 'admin_verified_at', 'last_login'
                ]

                for col in missing_user_columns:
                    if col not in columns:
                        if col == 'admin_municipality_id':
                            col_type = 'INTEGER'
                        elif col in ['valid_id_front', 'valid_id_back', 'proof_of_residency', 'selfie_with_id']:
                            col_type = 'TEXT'
                        elif col in ['email_verified_at', 'admin_verified_at', 'last_login']:
                            col_type = 'DATETIME'
                        else:
                            col_type = 'TEXT'

                        print(f"Adding '{col}' column to users table...")
                        db.session.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                        print(f"Added {col} column to users table")
                    else:
                        print(f"{col} column already exists in users table")

                # Check and add columns to benefit_programs table
                result = db.session.execute(text("PRAGMA table_info(benefit_programs)")).fetchall()
                columns = [row[1] for row in result]

                if 'duration_days' not in columns:
                    print("Adding 'duration_days' column to benefit_programs table...")
                    db.session.execute(text("ALTER TABLE benefit_programs ADD COLUMN duration_days INTEGER"))
                    print("Added duration_days column to benefit_programs table")
                else:
                    print("Duration_days column already exists in benefit_programs table")

                if 'completed_at' not in columns:
                    print("Adding 'completed_at' column to benefit_programs table...")
                    db.session.execute(text("ALTER TABLE benefit_programs ADD COLUMN completed_at DATETIME"))
                    print("Added completed_at column to benefit_programs table")
                else:
                    print("Completed_at column already exists in benefit_programs table")

                # Commit all changes
                db.session.commit()
                print("\nDatabase update complete!")

                # Check if transfer_requests table exists and create it if needed
                try:
                    result = db.session.execute(text("PRAGMA table_info(transfer_requests)")).fetchall()
                    print("Transfer_requests table exists")
                except Exception:
                    print("Creating transfer_requests table...")
                    from apps.api.models.transfer import TransferRequest
                    TransferRequest.__table__.create(db.engine)
                    print("Created transfer_requests table")

                # Show final table info
                print("\nUpdated table schemas:")
                for table_name in ['announcements', 'document_requests', 'issues', 'items', 'users', 'benefit_programs', 'transfer_requests']:
                    try:
                        result = db.session.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                        print(f"\n{table_name} table:")
                        for row in result:
                            print(f"  - {row[1]} ({row[2]})")
                    except Exception:
                        print(f"\n{table_name} table: Does not exist or error checking")

            except Exception as e:
                print(f"Error updating database: {e}")
                db.session.rollback()
                return False

    except Exception as e:
        print(f"Error initializing database update: {e}")
        return False

    return True

if __name__ == "__main__":
    success = update_database()
    sys.exit(0 if success else 1)
