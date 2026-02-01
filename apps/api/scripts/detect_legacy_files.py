#!/usr/bin/env python3
"""
Legacy File Detection & Migration Script for MunLink Region 3.

This script scans the database for records with legacy filesystem paths
and identifies files that are missing/broken. It can:

1. DETECT: Find all records with non-Supabase file paths
2. REPORT: Generate a report of affected records
3. FLAG: Mark records with missing files (optional)

Usage:
    # Scan both dev and prod
    python detect_legacy_files.py --report
    
    # Scan dev only
    python detect_legacy_files.py --dev --report
    
    # Scan prod only
    python detect_legacy_files.py --prod --report

Output:
    - Console report of affected records
    - JSON file with detailed findings (legacy_files_report_{env}.json)
"""
from __future__ import annotations

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add parent directories to path for imports
script_dir = Path(__file__).parent
api_dir = script_dir.parent
project_root = api_dir.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(api_dir))

from flask import Flask

# Import environment configurations
from db_environments import ENVIRONMENTS, get_database_url


def create_app(env_key: str = 'dev'):
    """Create minimal Flask app for database access."""
    app = Flask(__name__)
    
    # Load config
    from apps.api.config import Config
    app.config.from_object(Config)
    
    # Override with specific environment database
    app.config['SQLALCHEMY_DATABASE_URI'] = get_database_url(env_key)
    
    # Initialize database
    from apps.api import db
    db.init_app(app)
    
    return app


def is_legacy_path(path: str) -> bool:
    """Check if a path is a legacy filesystem path (not Supabase URL)."""
    if not path:
        return False
    
    # Supabase URLs contain 'supabase' and '/storage/'
    if 'supabase' in path.lower() and '/storage/' in path.lower():
        return False
    
    # External URLs that aren't Supabase
    if path.startswith(('http://', 'https://')):
        return False
    
    # Everything else is legacy
    return True


def check_file_exists(path: str, upload_folder: str) -> bool:
    """Check if a legacy file exists on the filesystem."""
    if not path:
        return False
    
    # Normalize path
    normalized = path.replace('\\', '/')
    if normalized.startswith('/'):
        normalized = normalized[1:]
    
    full_path = os.path.join(upload_folder, normalized)
    return os.path.exists(full_path)


def scan_users(db, upload_folder: str) -> List[Dict[str, Any]]:
    """Scan User model for legacy file paths."""
    from apps.api.models.user import User
    
    results = []
    file_columns = ['profile_picture', 'valid_id_front', 'valid_id_back', 'selfie_with_id', 'proof_of_residency']
    
    users = User.query.all()
    
    for user in users:
        for col in file_columns:
            path = getattr(user, col, None)
            if path and is_legacy_path(path):
                exists = check_file_exists(path, upload_folder)
                results.append({
                    'model': 'User',
                    'id': user.id,
                    'column': col,
                    'path': path,
                    'file_exists': exists,
                    'municipality_id': user.municipality_id,
                    'username': user.username
                })
    
    return results


def scan_items(db, upload_folder: str) -> List[Dict[str, Any]]:
    """Scan Item model for legacy image paths."""
    from apps.api.models.marketplace import Item
    
    results = []
    
    items = Item.query.all()
    
    for item in items:
        images = item.images or []
        if isinstance(images, str):
            try:
                images = json.loads(images)
            except:
                images = [images] if images else []
        
        for idx, path in enumerate(images):
            if path and is_legacy_path(path):
                exists = check_file_exists(path, upload_folder)
                results.append({
                    'model': 'Item',
                    'id': item.id,
                    'column': f'images[{idx}]',
                    'path': path,
                    'file_exists': exists,
                    'municipality_id': item.municipality_id,
                    'title': item.title
                })
    
    return results


def scan_issues(db, upload_folder: str) -> List[Dict[str, Any]]:
    """Scan Issue model for legacy attachment paths."""
    from apps.api.models.issue import Issue
    
    results = []
    
    issues = Issue.query.all()
    
    for issue in issues:
        attachments = issue.attachments or []
        if isinstance(attachments, str):
            try:
                attachments = json.loads(attachments)
            except:
                attachments = [attachments] if attachments else []
        
        for idx, path in enumerate(attachments):
            if path and is_legacy_path(path):
                exists = check_file_exists(path, upload_folder)
                results.append({
                    'model': 'Issue',
                    'id': issue.id,
                    'column': f'attachments[{idx}]',
                    'path': path,
                    'file_exists': exists,
                    'municipality_id': issue.municipality_id,
                    'issue_number': issue.issue_number
                })
    
    return results


def scan_announcements(db, upload_folder: str) -> List[Dict[str, Any]]:
    """Scan Announcement model for legacy image paths."""
    from apps.api.models.announcement import Announcement
    
    results = []
    
    announcements = Announcement.query.all()
    
    for announcement in announcements:
        images = announcement.images or []
        if isinstance(images, str):
            try:
                images = json.loads(images)
            except:
                images = [images] if images else []
        
        for idx, path in enumerate(images):
            if path and is_legacy_path(path):
                exists = check_file_exists(path, upload_folder)
                results.append({
                    'model': 'Announcement',
                    'id': announcement.id,
                    'column': f'images[{idx}]',
                    'path': path,
                    'file_exists': exists,
                    'municipality_id': announcement.municipality_id,
                    'title': announcement.title
                })
    
    return results


def scan_document_requests(db, upload_folder: str) -> List[Dict[str, Any]]:
    """Scan DocumentRequest model for legacy file paths."""
    from apps.api.models.document import DocumentRequest
    
    results = []
    
    requests = DocumentRequest.query.all()
    
    for req in requests:
        # Check QR code
        if req.qr_code and is_legacy_path(req.qr_code):
            exists = check_file_exists(req.qr_code, upload_folder)
            results.append({
                'model': 'DocumentRequest',
                'id': req.id,
                'column': 'qr_code',
                'path': req.qr_code,
                'file_exists': exists,
                'municipality_id': req.municipality_id,
                'request_number': req.request_number,
                'can_regenerate': True  # QR codes can be regenerated
            })
        
        # Check document file
        if req.document_file and is_legacy_path(req.document_file):
            exists = check_file_exists(req.document_file, upload_folder)
            results.append({
                'model': 'DocumentRequest',
                'id': req.id,
                'column': 'document_file',
                'path': req.document_file,
                'file_exists': exists,
                'municipality_id': req.municipality_id,
                'request_number': req.request_number,
                'can_regenerate': True  # PDFs can be regenerated
            })
        
        # Check supporting documents
        supporting_docs = req.supporting_documents or []
        if isinstance(supporting_docs, str):
            try:
                supporting_docs = json.loads(supporting_docs)
            except:
                supporting_docs = [supporting_docs] if supporting_docs else []
        
        for idx, path in enumerate(supporting_docs):
            if path and is_legacy_path(path):
                exists = check_file_exists(path, upload_folder)
                results.append({
                    'model': 'DocumentRequest',
                    'id': req.id,
                    'column': f'supporting_documents[{idx}]',
                    'path': path,
                    'file_exists': exists,
                    'municipality_id': req.municipality_id,
                    'request_number': req.request_number,
                    'can_regenerate': False  # User uploads cannot be regenerated
                })
    
    return results


def generate_report(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate summary report from scan results."""
    total = len(results)
    missing = sum(1 for r in results if not r.get('file_exists', False))
    regeneratable = sum(1 for r in results if r.get('can_regenerate', False) and not r.get('file_exists', False))
    
    by_model = {}
    for r in results:
        model = r['model']
        if model not in by_model:
            by_model[model] = {'total': 0, 'missing': 0}
        by_model[model]['total'] += 1
        if not r.get('file_exists', False):
            by_model[model]['missing'] += 1
    
    return {
        'scan_time': datetime.utcnow().isoformat(),
        'summary': {
            'total_legacy_paths': total,
            'missing_files': missing,
            'existing_files': total - missing,
            'regeneratable_missing': regeneratable,
            'requires_user_action': missing - regeneratable
        },
        'by_model': by_model,
        'details': results
    }


def scan_environment(env_key: str, output_file: str):
    """Scan a single environment for legacy files."""
    env_name = ENVIRONMENTS[env_key]['name']
    
    print(f"\n{'='*60}")
    print(f"Scanning: {env_name.upper()}")
    print(f"{'='*60}")
    
    app = create_app(env_key)
    
    with app.app_context():
        from apps.api import db
        
        upload_folder = str(app.config.get('UPLOAD_FOLDER', 'uploads'))
        print(f"Upload folder: {upload_folder}")
        print()
        
        print("Scanning database for legacy file paths...")
        print()
        
        all_results = []
        
        # Scan each model
        print("  Scanning Users...")
        all_results.extend(scan_users(db, upload_folder))
        
        print("  Scanning Marketplace Items...")
        all_results.extend(scan_items(db, upload_folder))
        
        print("  Scanning Issues...")
        all_results.extend(scan_issues(db, upload_folder))
        
        print("  Scanning Announcements...")
        all_results.extend(scan_announcements(db, upload_folder))
        
        print("  Scanning Document Requests...")
        all_results.extend(scan_document_requests(db, upload_folder))
        
        print()
        
        # Generate report
        report = generate_report(all_results)
        report['environment'] = env_name
        
        # Print summary
        print(f"RESULTS for {env_name}:")
        print(f"  Total legacy paths: {report['summary']['total_legacy_paths']}")
        print(f"  Files exist:        {report['summary']['existing_files']}")
        print(f"  Files MISSING:      {report['summary']['missing_files']}")
        print(f"  Can regenerate:     {report['summary']['regeneratable_missing']}")
        print(f"  Need re-upload:     {report['summary']['requires_user_action']}")
        
        # Save detailed report
        env_output = output_file.replace('.json', f'_{env_key}.json')
        with open(env_output, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        print(f"\nReport saved to: {env_output}")
        
        return report


def main():
    parser = argparse.ArgumentParser(description='Detect legacy file paths in MunLink database')
    parser.add_argument('--dev', action='store_true', help='Scan dev environment only')
    parser.add_argument('--prod', action='store_true', help='Scan prod environment only')
    parser.add_argument('--report', action='store_true', help='Generate report (default behavior)')
    parser.add_argument('--output', default='legacy_files_report.json', help='Output file for report')
    args = parser.parse_args()
    
    print("=" * 60)
    print("MunLink Legacy File Detection Script")
    print("=" * 60)
    
    # Determine which environments to scan
    if args.dev and not args.prod:
        envs_to_scan = ['dev']
    elif args.prod and not args.dev:
        envs_to_scan = ['prod']
    else:
        envs_to_scan = ['dev', 'prod']
    
    print(f"\nEnvironments to scan: {', '.join(envs_to_scan)}")
    
    all_reports = {}
    
    for env_key in envs_to_scan:
        all_reports[env_key] = scan_environment(env_key, args.output)
    
    # Print combined summary
    print(f"\n{'='*60}")
    print("COMBINED SUMMARY")
    print(f"{'='*60}")
    
    total_legacy = 0
    total_missing = 0
    total_regeneratable = 0
    
    for env_key, report in all_reports.items():
        env_name = ENVIRONMENTS[env_key]['name']
        total_legacy += report['summary']['total_legacy_paths']
        total_missing += report['summary']['missing_files']
        total_regeneratable += report['summary']['regeneratable_missing']
        print(f"\n{env_name}:")
        print(f"  Legacy paths: {report['summary']['total_legacy_paths']}")
        print(f"  Missing:      {report['summary']['missing_files']}")
    
    print(f"\nTOTAL across all environments:")
    print(f"  Legacy paths:    {total_legacy}")
    print(f"  Missing files:   {total_missing}")
    print(f"  Can regenerate:  {total_regeneratable}")
    
    if total_missing > 0:
        print(f"\n{'='*60}")
        print("RECOMMENDED ACTIONS")
        print(f"{'='*60}")
        print("\n1. Regenerate QR codes and PDFs:")
        print("   python apps/api/scripts/regenerate_documents.py --all")
        print("\n2. User uploads that need re-upload:")
        print("   - Frontend now shows placeholders for missing images")
        print("   - Affected users should be notified to re-upload")
    else:
        print("\n✓ No missing files detected!")
    
    print("\nDone.")


if __name__ == '__main__':
    main()

