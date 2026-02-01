"""
Shared database environment configurations for MunLink Region 3.

This module provides centralized configuration for both dev and prod
Supabase environments, used by various scripts.

Usage:
    from db_environments import ENVIRONMENTS, get_database_url, get_supabase_client
    
    # Get specific environment
    dev_url = get_database_url('dev')
    prod_client = get_supabase_client('prod')
"""
from __future__ import annotations

from typing import Dict, Any, Optional

# =============================================================================
# SUPABASE CONFIGURATIONS
# =============================================================================

ENVIRONMENTS: Dict[str, Dict[str, str]] = {
    'dev': {
        'name': 'munlink-dev',
        'url': 'https://lapooogulvdbhbvvycbe.supabase.co',
        'anon_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcG9vb2d1bHZkYmhidnZ5Y2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMTA0MjgsImV4cCI6MjA4MTc4NjQyOH0.ErAunpvuqcgdTkByiZxpss10r9pEqLWN73IgVnjM-1s',
        'service_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcG9vb2d1bHZkYmhidnZ5Y2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIxMDQyOCwiZXhwIjoyMDgxNzg2NDI4fQ.9cFcjInFd3bpnw_3uDyQaRMCnnBqHqUJ1_baUC5VCHI',
        'database_url': 'postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
        'project_ref': 'lapooogulvdbhbvvycbe',
    },
    'prod': {
        'name': 'munlink-prod',
        'url': 'https://xzkhavrjfaxsqxyptbgm.supabase.co',
        'anon_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6a2hhdnJqZmF4c3F4eXB0YmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MDI2NDMsImV4cCI6MjA4MzE3ODY0M30.c2c2KDAeFyHQSkmgZyLEl1m3EtDVI3oKDsekApUzCco',
        'service_key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6a2hhdnJqZmF4c3F4eXB0YmdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzYwMjY0MywiZXhwIjoyMDgzMTc4NjQzfQ.jJMBmhZEbsIMSyTEto2zlrzbmtZdy0IlXWd_lX-oHuM',
        'database_url': 'postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
        'project_ref': 'xzkhavrjfaxsqxyptbgm',
    }
}

# Storage bucket name (same for both environments)
STORAGE_BUCKET = 'munlink-files'


def get_environment(env_key: str) -> Dict[str, str]:
    """Get configuration for a specific environment."""
    if env_key not in ENVIRONMENTS:
        raise ValueError(f"Unknown environment: {env_key}. Use 'dev' or 'prod'.")
    return ENVIRONMENTS[env_key]


def get_database_url(env_key: str) -> str:
    """Get database URL for a specific environment."""
    return get_environment(env_key)['database_url']


def get_supabase_url(env_key: str) -> str:
    """Get Supabase project URL for a specific environment."""
    return get_environment(env_key)['url']


def get_service_key(env_key: str) -> str:
    """Get Supabase service key for a specific environment."""
    return get_environment(env_key)['service_key']


def get_supabase_client(env_key: str):
    """Get Supabase client for a specific environment."""
    try:
        from supabase import create_client
    except ImportError:
        raise ImportError("supabase package not installed. Run: pip install supabase")
    
    env = get_environment(env_key)
    return create_client(env['url'], env['service_key'])


def get_sqlalchemy_engine(env_key: str):
    """Get SQLAlchemy engine for a specific environment."""
    from sqlalchemy import create_engine
    
    db_url = get_database_url(env_key)
    
    # Add SSL mode for Supabase
    if '?' not in db_url:
        db_url += '?sslmode=require'
    elif 'sslmode' not in db_url:
        db_url += '&sslmode=require'
    
    return create_engine(db_url)


def list_environments() -> list:
    """List all available environment keys."""
    return list(ENVIRONMENTS.keys())


def print_environment_info(env_key: str):
    """Print information about an environment."""
    env = get_environment(env_key)
    print(f"Environment: {env['name']}")
    print(f"  URL: {env['url']}")
    print(f"  Database: {env['database_url'][:50]}...")
    print(f"  Project Ref: {env['project_ref']}")

