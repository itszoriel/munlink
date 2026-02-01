#!/usr/bin/env python3
"""
Document Regeneration Script for MunLink Region 3.

This script regenerates QR codes and PDFs for document requests that have
missing or broken files. It uploads the regenerated files to Supabase Storage.

Usage:
    # Regenerate on both dev and prod
    python regenerate_documents.py --all
    
    # Regenerate on dev only
    python regenerate_documents.py --dev --all
    
    # Regenerate on prod only
    python regenerate_documents.py --prod --all
    
    # Dry run (show what would be regenerated)
    python regenerate_documents.py --all --dry-run
    
    # QR codes only
    python regenerate_documents.py --qr-codes
    
    # PDFs only
    python regenerate_documents.py --pdfs
    
    # Specific request
    python regenerate_documents.py --request-id 123 --prod
"""
from __future__ import annotations

import os
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import List, Optional

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
    
    # Force production mode for Supabase Storage
    os.environ['FLASK_ENV'] = 'production'
    
    # Load config
    from apps.api.config import Config
    app.config.from_object(Config)
    
    # Override with specific environment
    env = ENVIRONMENTS[env_key]
    app.config['SQLALCHEMY_DATABASE_URI'] = env['database_url']
    app.config['SUPABASE_URL'] = env['url']
    app.config['SUPABASE_SERVICE_KEY'] = env['service_key']
    
    # Initialize database
    from apps.api import db
    db.init_app(app)
    
    return app


def is_legacy_or_missing(path: str, upload_folder: str) -> bool:
    """Check if a path is legacy (not Supabase) or missing."""
    if not path:
        return True
    
    # Supabase URLs are valid
    if 'supabase' in path.lower() and '/storage/' in path.lower():
        return False
    
    # External URLs are valid
    if path.startswith(('http://', 'https://')):
        return False
    
    # Check if file exists locally
    normalized = path.replace('\\', '/')
    if normalized.startswith('/'):
        normalized = normalized[1:]
    
    full_path = os.path.join(upload_folder, normalized)
    return not os.path.exists(full_path)


def regenerate_qr_code(request_obj, municipality_slug: str, dry_run: bool = False) -> Optional[str]:
    """Regenerate QR code for a document request."""
    from apps.api.utils.qr_generator import regenerate_qr_code as qr_regenerate
    
    if dry_run:
        print(f"    Would regenerate QR code for request {request_obj.request_number}")
        return None
    
    try:
        new_url = qr_regenerate(request_obj, municipality_slug)
        print(f"    ✓ QR code regenerated: {new_url[:60]}...")
        return new_url
    except Exception as e:
        print(f"    ✗ Failed to regenerate QR code: {e}")
        return None


def regenerate_pdf(request_obj, document_type, user, admin_user, dry_run: bool = False) -> Optional[str]:
    """Regenerate PDF for a document request."""
    from apps.api.utils.pdf_generator import generate_document_pdf
    
    if dry_run:
        print(f"    Would regenerate PDF for request {request_obj.request_number}")
        return None
    
    try:
        _, url_or_path = generate_document_pdf(request_obj, document_type, user, admin_user)
        print(f"    ✓ PDF regenerated: {url_or_path[:60]}...")
        return url_or_path
    except Exception as e:
        print(f"    ✗ Failed to regenerate PDF: {e}")
        return None


def get_municipality_slug(municipality_obj) -> str:
    """Get slug from municipality object."""
    if municipality_obj:
        return getattr(municipality_obj, 'slug', None) or \
               getattr(municipality_obj, 'name', 'unknown').lower().replace(' ', '-')
    return 'unknown'


def process_environment(env_key: str, args) -> dict:
    """Process regeneration for a single environment."""
    env_name = ENVIRONMENTS[env_key]['name']
    
    print(f"\n{'='*60}")
    print(f"Processing: {env_name.upper()}")
    print(f"{'='*60}")
    
    do_qr = args.qr_codes or args.all
    do_pdf = args.pdfs or args.all
    
    app = create_app(env_key)
    
    results = {'qr_regenerated': 0, 'pdf_regenerated': 0, 'errors': 0}
    
    with app.app_context():
        from apps.api import db
        from apps.api.models.document import DocumentRequest
        from apps.api.models.user import User
        
        upload_folder = str(app.config.get('UPLOAD_FOLDER', 'uploads'))
        
        # Build query
        query = DocumentRequest.query
        
        if args.request_id:
            query = query.filter(DocumentRequest.id == args.request_id)
        else:
            # Filter by status
            statuses = [s.strip() for s in args.status.split(',')]
            query = query.filter(DocumentRequest.status.in_(statuses))
        
        if args.municipality:
            from apps.api.models.municipality import Municipality
            mun = Municipality.query.filter(
                (Municipality.slug == args.municipality) | 
                (Municipality.name.ilike(f'%{args.municipality}%'))
            ).first()
            if mun:
                query = query.filter(DocumentRequest.municipality_id == mun.id)
            else:
                print(f"  Municipality not found: {args.municipality}")
                return results
        
        requests = query.all()
        print(f"  Found {len(requests)} document request(s) to process")
        
        for req in requests:
            needs_qr = do_qr and is_legacy_or_missing(req.qr_code, upload_folder)
            needs_pdf = do_pdf and is_legacy_or_missing(req.document_file, upload_folder)
            
            if not needs_qr and not needs_pdf:
                continue
            
            municipality_slug = get_municipality_slug(req.municipality)
            print(f"\n  Processing: {req.request_number} (Municipality: {municipality_slug})")
            
            # Regenerate QR code
            if needs_qr:
                new_qr = regenerate_qr_code(req, municipality_slug, args.dry_run)
                if new_qr:
                    req.qr_code = new_qr
                    results['qr_regenerated'] += 1
                elif not args.dry_run:
                    results['errors'] += 1
            
            # Regenerate PDF
            if needs_pdf:
                user = User.query.get(req.user_id)
                document_type = req.document_type
                admin_user = None
                
                new_pdf = regenerate_pdf(req, document_type, user, admin_user, args.dry_run)
                if new_pdf:
                    req.document_file = new_pdf
                    results['pdf_regenerated'] += 1
                elif not args.dry_run:
                    results['errors'] += 1
            
            # Commit changes
            if not args.dry_run and (needs_qr or needs_pdf):
                try:
                    db.session.commit()
                except Exception as e:
                    print(f"      ✗ Failed to save changes: {e}")
                    db.session.rollback()
                    results['errors'] += 1
        
        print(f"\n  {env_name} results:")
        print(f"    QR codes regenerated: {results['qr_regenerated']}")
        print(f"    PDFs regenerated:     {results['pdf_regenerated']}")
        print(f"    Errors:               {results['errors']}")
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Regenerate documents for MunLink')
    parser.add_argument('--dev', action='store_true', help='Process dev environment only')
    parser.add_argument('--prod', action='store_true', help='Process prod environment only')
    parser.add_argument('--qr-codes', action='store_true', help='Regenerate QR codes')
    parser.add_argument('--pdfs', action='store_true', help='Regenerate PDFs')
    parser.add_argument('--all', action='store_true', help='Regenerate both QR codes and PDFs')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--request-id', type=int, help='Regenerate for specific request ID')
    parser.add_argument('--municipality', type=str, help='Filter by municipality slug')
    parser.add_argument('--status', type=str, default='ready,completed', help='Filter by status (comma-separated)')
    args = parser.parse_args()
    
    if not (args.qr_codes or args.pdfs or args.all or args.request_id):
        parser.print_help()
        return
    
    print("=" * 60)
    print("MunLink Document Regeneration Script")
    print("=" * 60)
    
    if args.dry_run:
        print("\n*** DRY RUN MODE - No changes will be made ***")
    
    # Determine which environments to process
    if args.dev and not args.prod:
        envs_to_process = ['dev']
    elif args.prod and not args.dev:
        envs_to_process = ['prod']
    else:
        envs_to_process = ['dev', 'prod']
    
    print(f"\nEnvironments to process: {', '.join(envs_to_process)}")
    
    all_results = {}
    
    for env_key in envs_to_process:
        all_results[env_key] = process_environment(env_key, args)
    
    # Combined summary
    print(f"\n{'='*60}")
    print("COMBINED SUMMARY")
    print(f"{'='*60}")
    
    total_qr = sum(r['qr_regenerated'] for r in all_results.values())
    total_pdf = sum(r['pdf_regenerated'] for r in all_results.values())
    total_errors = sum(r['errors'] for r in all_results.values())
    
    for env_key, results in all_results.items():
        env_name = ENVIRONMENTS[env_key]['name']
        print(f"\n{env_name}:")
        print(f"  QR codes: {results['qr_regenerated']}, PDFs: {results['pdf_regenerated']}, Errors: {results['errors']}")
    
    print(f"\nTOTAL:")
    print(f"  QR codes regenerated: {total_qr}")
    print(f"  PDFs regenerated:     {total_pdf}")
    print(f"  Errors:               {total_errors}")
    
    if args.dry_run:
        print("\nThis was a dry run. No changes were made.")
        print("Run without --dry-run to apply changes.")
    else:
        print("\nDone!")


if __name__ == '__main__':
    main()

