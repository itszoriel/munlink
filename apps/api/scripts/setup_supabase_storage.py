#!/usr/bin/env python3
"""
Setup Supabase Storage for MunLink Region 3.

This script creates the required storage buckets on BOTH dev and prod
Supabase projects using direct HTTP requests (no supabase package needed).

Usage:
    python setup_supabase_storage.py          # Setup both environments
    python setup_supabase_storage.py --dev    # Setup dev only
    python setup_supabase_storage.py --prod   # Setup prod only
"""
from __future__ import annotations

import sys
import argparse
import json
from pathlib import Path
from typing import Dict, Any, Optional

# Use requests which is already installed
import requests

# Add parent directories to path for imports
script_dir = Path(__file__).parent
api_dir = script_dir.parent
project_root = api_dir.parent.parent
sys.path.insert(0, str(project_root))

# =============================================================================
# SUPABASE CONFIGURATIONS
# =============================================================================

ENVIRONMENTS = {
    'dev': {
        'name': 'munlink-dev',
        'url': 'https://lapooogulvdbhbvvycbe.supabase.co',
        'anon_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcG9vb2d1bHZkYmhidnZ5Y2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMTA0MjgsImV4cCI6MjA4MTc4NjQyOH0.ErAunpvuqcgdTkByiZxpss10r9pEqLWN73IgVnjM-1s',
        'service_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcG9vb2d1bHZkYmhidnZ5Y2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIxMDQyOCwiZXhwIjoyMDgxNzg2NDI4fQ.9cFcjInFd3bpnw_3uDyQaRMCnnBqHqUJ1_baUC5VCHI',
        'database_url': 'postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    },
    'prod': {
        'name': 'munlink-prod',
        'url': 'https://xzkhavrjfaxsqxyptbgm.supabase.co',
        'anon_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6a2hhdnJqZmF4c3F4eXB0YmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MDI2NDMsImV4cCI6MjA4MzE3ODY0M30.c2c2KDAeFyHQSkmgZyLEl1m3EtDVI3oKDsekApUzCco',
        'service_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6a2hhdnJqZmF4c3F4eXB0YmdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzYwMjY0MywiZXhwIjoyMDgzMTc4NjQzfQ.jJMBmhZEbsIMSyTEto2zlrzbmtZdy0IlXWd_lX-oHuM',
        'database_url': 'postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    }
}

# Default bucket name
BUCKET_NAME = 'munlink-files'


def list_buckets(base_url: str, service_key: str) -> list:
    """List all storage buckets using REST API."""
    url = f"{base_url}/storage/v1/bucket"
    headers = {
        'Authorization': f'Bearer {service_key}',
        'apikey': service_key,
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"    Failed to list buckets: {response.status_code} - {response.text}")
        return []


def create_bucket(base_url: str, service_key: str, bucket_name: str, public: bool = True) -> bool:
    """Create a storage bucket using REST API."""
    url = f"{base_url}/storage/v1/bucket"
    headers = {
        'Authorization': f'Bearer {service_key}',
        'apikey': service_key,
        'Content-Type': 'application/json',
    }
    
    payload = {
        'id': bucket_name,
        'name': bucket_name,
        'public': public,
        'file_size_limit': 10485760,  # 10MB
        'allowed_mime_types': [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]
    }
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code in (200, 201):
        return True
    elif response.status_code == 400 and 'already exists' in response.text.lower():
        return True  # Bucket already exists
    else:
        print(f"    Failed to create bucket: {response.status_code} - {response.text}")
        return False


def test_bucket(base_url: str, service_key: str, bucket_name: str) -> bool:
    """Test bucket access by listing files."""
    url = f"{base_url}/storage/v1/object/list/{bucket_name}"
    headers = {
        'Authorization': f'Bearer {service_key}',
        'apikey': service_key,
        'Content-Type': 'application/json',
    }
    
    # List root of bucket
    payload = {'prefix': '', 'limit': 10}
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        files = response.json()
        return True, len(files) if isinstance(files, list) else 0
    else:
        return False, 0


def setup_environment(env_key: str, env_config: Dict[str, str]) -> bool:
    """Setup storage for a single environment."""
    print(f"\n{'='*60}")
    print(f"Setting up: {env_config['name'].upper()}")
    print(f"{'='*60}")
    print(f"  URL: {env_config['url']}")
    
    base_url = env_config['url']
    service_key = env_config['service_key']
    
    # Check existing buckets
    print(f"\n  Checking existing buckets...")
    buckets = list_buckets(base_url, service_key)
    bucket_names = [b.get('name') or b.get('id') for b in buckets]
    print(f"    Found {len(buckets)} bucket(s): {bucket_names}")
    
    # Create bucket if needed
    if BUCKET_NAME in bucket_names:
        print(f"\n  [OK] Bucket '{BUCKET_NAME}' already exists")
    else:
        print(f"\n  Creating bucket '{BUCKET_NAME}'...")
        if create_bucket(base_url, service_key, BUCKET_NAME, public=True):
            print(f"  [OK] Bucket '{BUCKET_NAME}' created successfully")
        else:
            print(f"  [FAILED] Failed to create bucket")
            return False
    
    # Test access
    print(f"\n  Testing bucket access...")
    success, file_count = test_bucket(base_url, service_key, BUCKET_NAME)
    if success:
        print(f"  [OK] Bucket access verified ({file_count} files)")
    else:
        print(f"  [WARN] Could not verify bucket access (may need policies)")
    
    print(f"\n  [OK] {env_config['name']} setup complete!")
    return True


def print_policy_guidance():
    """Print storage policy guidance."""
    print(f"\n{'='*60}")
    print("STORAGE POLICIES (Apply in Supabase Dashboard)")
    print(f"{'='*60}")
    print("""
For BOTH dev and prod Supabase projects, go to:
  Storage > Policies > New Policy

OPTION 1: Simple Public Access (Recommended)
-------------------------------------------
In Supabase Dashboard:
1. Go to Storage > munlink-files bucket
2. Click on "Policies" tab
3. Create policies:

   SELECT (read): Allow public read
   - Click "New Policy" > "For full customization"
   - Policy name: "Public read"
   - Allowed operation: SELECT
   - Policy: (bucket_id = 'munlink-files')

   INSERT (upload): Allow service role
   - This is automatic with service_role key

   UPDATE/DELETE: Allow service role
   - This is automatic with service_role key

OPTION 2: SQL in SQL Editor
---------------------------
Run this in Supabase SQL Editor:

-- Allow public read access to all files
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'munlink-files');

-- Allow service role full access (automatic, but explicit)
CREATE POLICY "Service role full access"
ON storage.objects
USING (auth.role() = 'service_role');
""")


def main():
    parser = argparse.ArgumentParser(
        description='Setup Supabase Storage for MunLink (dev and prod)'
    )
    parser.add_argument('--dev', action='store_true', help='Setup dev environment only')
    parser.add_argument('--prod', action='store_true', help='Setup prod environment only')
    args = parser.parse_args()
    
    print("=" * 60)
    print("MunLink Supabase Storage Setup")
    print("=" * 60)
    
    # Determine which environments to setup
    if args.dev and not args.prod:
        envs_to_setup = ['dev']
    elif args.prod and not args.dev:
        envs_to_setup = ['prod']
    else:
        envs_to_setup = ['dev', 'prod']
    
    print(f"\nEnvironments to setup: {', '.join(envs_to_setup)}")
    print(f"Bucket name: {BUCKET_NAME}")
    
    results = {}
    
    for env_key in envs_to_setup:
        env_config = ENVIRONMENTS[env_key]
        results[env_key] = setup_environment(env_key, env_config)
    
    # Print summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    
    all_success = True
    for env_key, success in results.items():
        status = "[OK] SUCCESS" if success else "[FAILED]"
        if not success:
            all_success = False
        print(f"  {ENVIRONMENTS[env_key]['name']}: {status}")
    
    # Print policy guidance
    if all_success:
        print_policy_guidance()
    
    # Print next steps
    print(f"\n{'='*60}")
    print("NEXT STEPS")
    print(f"{'='*60}")
    print("""
1. Apply storage policies in Supabase Dashboard (see above)

2. The storage buckets are now ready for file uploads!

3. To verify everything works:
   python detect_legacy_files.py --report
""")
    
    # Exit with error code if any failed
    if not all_success:
        sys.exit(1)
    
    print("\n[OK] Setup completed successfully!")


if __name__ == '__main__':
    main()
