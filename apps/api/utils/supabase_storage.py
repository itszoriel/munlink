"""
Supabase Storage client utilities for MunLink Region 3.

This module provides a centralized interface for all file storage operations
using Supabase Storage REST API directly (no supabase package needed).

Features:
- Upload files directly to Supabase Storage via REST API
- Generate public URLs for files
- Municipality-scoped storage paths
- MIME type validation
- File size limits

Usage:
    from apps.api.utils.supabase_storage import (
        upload_file,
        upload_bytes,
        get_public_url,
        delete_file,
        is_supabase_url,
        is_legacy_path,
    )
"""
from __future__ import annotations

from apps.api.utils.time import utc_now
import os
import uuid
import logging
from datetime import datetime
from urllib.parse import urlparse, unquote
from io import BytesIO
from typing import Optional, Tuple, Union, BinaryIO
from pathlib import Path

import requests
from flask import current_app
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)

# Storage bucket name - configurable via env
STORAGE_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET', 'munlink-files')

# MIME types
ALLOWED_IMAGE_MIMES = {
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
}

ALLOWED_DOCUMENT_MIMES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
}


class SupabaseStorageError(Exception):
    """Custom exception for Supabase Storage operations."""
    pass


def _get_supabase_config() -> Tuple[str, str]:
    """Get Supabase URL and service key."""
    supabase_url = current_app.config.get('SUPABASE_URL') or os.getenv('SUPABASE_URL')
    supabase_key = (
        current_app.config.get('SUPABASE_SERVICE_KEY') or 
        os.getenv('SUPABASE_SERVICE_KEY') or
        current_app.config.get('SUPABASE_KEY') or 
        os.getenv('SUPABASE_KEY')
    )
    
    if not supabase_url or not supabase_key:
        raise SupabaseStorageError(
            "Supabase credentials not configured. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
        )
    
    return supabase_url, supabase_key


def _get_storage_bucket(bucket_override: Optional[str] = None) -> str:
    """Get the storage bucket name (optionally overridden)."""
    if bucket_override:
        return bucket_override
    return current_app.config.get('SUPABASE_STORAGE_BUCKET') or os.getenv('SUPABASE_STORAGE_BUCKET') or STORAGE_BUCKET


def _normalize_storage_path(storage_path: str, bucket: str) -> str:
    """Normalize a storage path (strip bucket or public URLs if provided)."""
    if not storage_path:
        return storage_path
    path = storage_path.strip()
    if path.startswith('http://') or path.startswith('https://'):
        path = urlparse(path).path
    path = unquote(path)
    path = path.lstrip('/')

    # Strip known storage prefixes
    for prefix in (
        'storage/v1/object/public/',
        'storage/v1/object/sign/',
        'storage/v1/object/',
        'object/public/',
        'object/sign/',
        'object/',
    ):
        if path.startswith(prefix):
            path = path[len(prefix):]
            break

    # Remove bucket prefix if present
    if path.startswith(f"{bucket}/"):
        path = path[len(bucket) + 1:]

    return path


def _get_headers(service_key: str, content_type: Optional[str] = None) -> dict:
    """Get headers for Supabase REST API requests."""
    headers = {
        'Authorization': f'Bearer {service_key}',
        'apikey': service_key,
    }
    if content_type:
        headers['Content-Type'] = content_type
    return headers


def generate_unique_filename(original_filename: str, prefix: str = '') -> str:
    """
    Generate a unique filename while preserving extension.
    
    Args:
        original_filename: Original file name
        prefix: Optional prefix for the filename
    
    Returns:
        Unique filename string
    """
    # Get file extension
    _, ext = os.path.splitext(original_filename)
    ext = ext.lower()
    
    # Generate unique name with timestamp and UUID
    timestamp = utc_now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    
    if prefix:
        return f"{prefix}_{timestamp}_{unique_id}{ext}"
    return f"{timestamp}_{unique_id}{ext}"


def build_storage_path(
    category: str,
    municipality_slug: str,
    subcategory: Optional[str] = None,
    filename: Optional[str] = None,
    user_type: str = 'residents'
) -> str:
    """
    Build a structured storage path for municipality-scoped files.
    
    Structure: {category}/{user_type}/{municipality_slug}/{subcategory}/{filename}
    
    Args:
        category: Category of upload (profiles, marketplace, issues, etc.)
        municipality_slug: Municipality slug for scoping
        subcategory: Optional subcategory (e.g., user_123, item_456)
        filename: Optional filename to append
        user_type: Type of user (residents, admins)
    
    Returns:
        Storage path string
    """
    parts = [category, user_type, municipality_slug]
    
    if subcategory:
        parts.append(subcategory)
    
    if filename:
        parts.append(filename)
    
    return '/'.join(parts)


def upload_file(
    file: BinaryIO,
    category: str,
    municipality_slug: str,
    original_filename: str,
    subcategory: Optional[str] = None,
    user_type: str = 'residents',
    content_type: Optional[str] = None,
    max_size_mb: int = 10,
    bucket: Optional[str] = None,
    public: bool = True,
) -> Tuple[str, Optional[str]]:
    """
    Upload a file to Supabase Storage using REST API.
    
    Args:
        file: File-like object (BytesIO, FileStorage, etc.)
        category: Category of upload (profiles, marketplace, etc.)
        municipality_slug: Municipality slug for scoping
        original_filename: Original filename for extension extraction
        subcategory: Optional subcategory
        user_type: Type of user (residents, admins)
        content_type: MIME type (auto-detected if not provided)
        max_size_mb: Maximum file size in MB
    
    Returns:
        Tuple of (storage_path, public_url)
    
    Raises:
        SupabaseStorageError: If upload fails
    """
    try:
        # Ensure file pointer is at start
        file.seek(0)
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        max_size_bytes = max_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise SupabaseStorageError(f"File size exceeds {max_size_mb}MB limit")
        
        # Read file content
        content = file.read()
        file.seek(0)
        
        # Generate unique filename
        safe_filename = secure_filename(original_filename)
        unique_filename = generate_unique_filename(safe_filename)
        
        # Build storage path
        storage_path = build_storage_path(
            category=category,
            municipality_slug=municipality_slug,
            subcategory=subcategory,
            filename=unique_filename,
            user_type=user_type
        )
        
        # Get Supabase config
        supabase_url, service_key = _get_supabase_config()
        bucket = _get_storage_bucket(bucket)
        
        # Determine content type
        if not content_type:
            # Try to guess from extension
            ext = os.path.splitext(original_filename)[1].lower()
            content_type_map = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }
            content_type = content_type_map.get(ext, 'application/octet-stream')
        
        # Upload via REST API
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            'Authorization': f'Bearer {service_key}',
            'apikey': service_key,
            'Content-Type': content_type,
        }
        
        response = requests.post(upload_url, headers=headers, data=content)
        
        if response.status_code not in (200, 201):
            raise SupabaseStorageError(f"Upload failed: {response.status_code} - {response.text}")
        
        # Build public URL (optional; private buckets should use signed URLs)
        public_url = None
        if public:
            public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{storage_path}"
        
        logger.info(f"File uploaded to Supabase Storage: {storage_path}")
        
        return storage_path, public_url
    
    except SupabaseStorageError:
        raise
    except Exception as e:
        logger.error(f"Supabase Storage upload failed: {e}")
        raise SupabaseStorageError(f"Upload failed: {e}")


def upload_file_to_path(
    file: BinaryIO,
    storage_path: str,
    content_type: Optional[str] = None,
    max_size_mb: int = 10,
    bucket: Optional[str] = None,
) -> str:
    """
    Upload a file to a specific storage path (no auto path building).

    Returns:
        storage_path
    """
    try:
        if not storage_path:
            raise SupabaseStorageError("Storage path is required")

        # Ensure file pointer is at start
        file.seek(0)

        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        max_size_bytes = max_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise SupabaseStorageError(f"File size exceeds {max_size_mb}MB limit")

        # Read file content
        content = file.read()
        file.seek(0)

        # Determine content type
        if not content_type:
            # Try to guess from extension
            ext = os.path.splitext(storage_path)[1].lower()
            content_type_map = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }
            content_type = content_type_map.get(ext, 'application/octet-stream')

        # Get Supabase config
        supabase_url, service_key = _get_supabase_config()
        bucket = _get_storage_bucket(bucket)

        # Upload via REST API
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            'Authorization': f'Bearer {service_key}',
            'apikey': service_key,
            'Content-Type': content_type,
        }

        response = requests.post(upload_url, headers=headers, data=content)

        if response.status_code not in (200, 201):
            raise SupabaseStorageError(f"Upload failed: {response.status_code} - {response.text}")

        logger.info(f"File uploaded to Supabase Storage: {storage_path}")
        return storage_path

    except SupabaseStorageError:
        raise
    except Exception as e:
        logger.error(f"Supabase Storage upload failed: {e}")
        raise SupabaseStorageError(f"Upload failed: {e}")


def upload_bytes(
    data: bytes,
    category: str,
    municipality_slug: str,
    filename: str,
    subcategory: Optional[str] = None,
    user_type: str = 'residents',
    content_type: str = 'application/octet-stream',
    bucket: Optional[str] = None,
    public: bool = True,
) -> Tuple[str, Optional[str]]:
    """
    Upload raw bytes to Supabase Storage.
    
    Args:
        data: Raw bytes to upload
        category: Category of upload
        municipality_slug: Municipality slug for scoping
        filename: Filename with extension
        subcategory: Optional subcategory
        user_type: Type of user
        content_type: MIME type
    
    Returns:
        Tuple of (storage_path, public_url)
    """
    file_obj = BytesIO(data)
    return upload_file(
        file=file_obj,
        category=category,
        municipality_slug=municipality_slug,
        original_filename=filename,
        subcategory=subcategory,
        user_type=user_type,
        content_type=content_type,
        bucket=bucket,
        public=public,
    )


def get_public_url(storage_path: str, bucket: Optional[str] = None) -> str:
    """
    Get the public URL for a file in Supabase Storage.
    
    Args:
        storage_path: Path to file in storage bucket
    
    Returns:
        Public URL string
    """
    try:
        supabase_url, _ = _get_supabase_config()
        bucket = _get_storage_bucket(bucket)
        storage_path = _normalize_storage_path(storage_path, bucket)
        return f"{supabase_url}/storage/v1/object/public/{bucket}/{storage_path}"
    except Exception as e:
        logger.error(f"Failed to get public URL: {e}")
        raise SupabaseStorageError(f"Failed to get public URL: {e}")


def get_signed_url(storage_path: str, expires_in: int = 3600, bucket: Optional[str] = None) -> str:
    """
    Get a signed (temporary) URL for a file in Supabase Storage.
    
    Args:
        storage_path: Path to file in storage bucket
        expires_in: URL expiration time in seconds (default: 1 hour)
    
    Returns:
        Signed URL string
    """
    try:
        supabase_url, service_key = _get_supabase_config()
        bucket = _get_storage_bucket(bucket)
        storage_path = _normalize_storage_path(storage_path, bucket)
        
        url = f"{supabase_url}/storage/v1/object/sign/{bucket}/{storage_path}"
        headers = _get_headers(service_key, 'application/json')
        payload = {'expiresIn': expires_in}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            signed_url = data.get('signedURL') or data.get('signedUrl', '')
            if signed_url:
                if signed_url.startswith('http://') or signed_url.startswith('https://'):
                    return signed_url
                # Supabase sometimes returns /object/sign/...; normalize to /storage/v1/object/sign/...
                if signed_url.startswith('/storage/'):
                    return f"{supabase_url}{signed_url}"
                if signed_url.startswith('/object/'):
                    return f"{supabase_url}/storage/v1{signed_url}"
                if signed_url.startswith('storage/'):
                    return f"{supabase_url}/{signed_url}"
                if signed_url.startswith('object/'):
                    return f"{supabase_url}/storage/v1/{signed_url}"
                return f"{supabase_url}/{signed_url.lstrip('/')}"
        
        raise SupabaseStorageError(f"Failed to create signed URL: {response.text}")
    except SupabaseStorageError:
        raise
    except Exception as e:
        logger.error(f"Failed to get signed URL: {e}")
        raise SupabaseStorageError(f"Failed to get signed URL: {e}")


def delete_file(storage_path: str, bucket: Optional[str] = None) -> bool:
    """
    Delete a file from Supabase Storage.
    
    Args:
        storage_path: Path to file in storage bucket
    
    Returns:
        True if deleted successfully
    """
    try:
        supabase_url, service_key = _get_supabase_config()
        bucket = _get_storage_bucket(bucket)
        
        url = f"{supabase_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = _get_headers(service_key)
        
        response = requests.delete(url, headers=headers)
        
        if response.status_code in (200, 204):
            logger.info(f"File deleted from Supabase Storage: {storage_path}")
            return True
        else:
            logger.warning(f"Delete returned {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        return False


def file_exists(storage_path: str, bucket: Optional[str] = None) -> bool:
    """
    Check if a file exists in Supabase Storage.
    
    Args:
        storage_path: Path to file in storage bucket
    
    Returns:
        True if file exists
    """
    try:
        supabase_url, service_key = _get_supabase_config()
        bucket = _get_storage_bucket(bucket)
        
        # Try to get file metadata
        url = f"{supabase_url}/storage/v1/object/info/public/{bucket}/{storage_path}"
        headers = _get_headers(service_key)
        
        response = requests.get(url, headers=headers)
        return response.status_code == 200
    except Exception:
        return False


def is_supabase_url(url: str) -> bool:
    """
    Check if a URL is a Supabase Storage URL.
    
    Args:
        url: URL string to check
    
    Returns:
        True if URL is from Supabase Storage
    """
    if not url:
        return False
    return 'supabase' in url.lower() and '/storage/' in url.lower()


def is_legacy_path(path: str) -> bool:
    """
    Check if a path is a legacy filesystem path (not Supabase).
    
    Args:
        path: Path string to check
    
    Returns:
        True if path is a legacy filesystem path
    """
    if not path:
        return False
    
    # Check for common legacy patterns
    legacy_patterns = [
        '/uploads/',
        'uploads/',
        '\\uploads\\',
        '/region3/',
        'region3/',
    ]
    
    # If it's already a Supabase URL, it's not legacy
    if is_supabase_url(path):
        return False
    
    # If it starts with http(s) but not Supabase, it might be another external URL
    if path.startswith(('http://', 'https://')):
        return False
    
    # Check for legacy patterns
    for pattern in legacy_patterns:
        if pattern in path.lower():
            return True
    
    # If it looks like a relative path without http, it's likely legacy
    if not path.startswith(('http://', 'https://')):
        return True
    
    return False


def get_supabase_base_url(bucket: Optional[str] = None) -> str:
    """Get the base URL for Supabase storage."""
    supabase_url = current_app.config.get('SUPABASE_URL') or os.getenv('SUPABASE_URL', '')
    bucket = _get_storage_bucket(bucket)
    return f"{supabase_url}/storage/v1/object/public/{bucket}"


# Convenience functions for specific file types

def upload_profile_picture(
    file: BinaryIO,
    user_id: int,
    municipality_slug: str,
    original_filename: str,
    user_type: str = 'residents'
) -> Tuple[str, str]:
    """Upload a user profile picture."""
    return upload_file(
        file=file,
        category='profiles',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"user_{user_id}",
        user_type=user_type,
        content_type='image/jpeg',  # Most profile pics are JPEG
        max_size_mb=5
    )


def upload_verification_document(
    file: BinaryIO,
    user_id: int,
    municipality_slug: str,
    original_filename: str,
    doc_type: str,
    user_type: str = 'residents'
) -> Tuple[str, str]:
    """Upload a verification document (ID, selfie, etc.)."""
    allowed_doc_types = {'valid_id_front', 'valid_id_back', 'selfie_with_id'}
    if doc_type not in allowed_doc_types:
        raise SupabaseStorageError('Unsupported verification document type')
    
    return upload_file(
        file=file,
        category='verification',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"user_{user_id}/{doc_type}",
        user_type=user_type,
        max_size_mb=5
    )


def upload_marketplace_image(
    file: BinaryIO,
    item_id: int,
    municipality_slug: str,
    original_filename: str
) -> Tuple[str, str]:
    """Upload a marketplace item image."""
    return upload_file(
        file=file,
        category='marketplace',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"item_{item_id}",
        user_type='residents',
        max_size_mb=5
    )


def upload_issue_attachment(
    file: BinaryIO,
    issue_id: int,
    municipality_slug: str,
    original_filename: str
) -> Tuple[str, str]:
    """Upload an issue report attachment."""
    return upload_file(
        file=file,
        category='issues',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"issue_{issue_id}",
        user_type='residents',
        max_size_mb=10
    )


def upload_announcement_image(
    file: BinaryIO,
    announcement_id: int,
    municipality_slug: str,
    original_filename: str
) -> Tuple[str, str]:
    """Upload an announcement image."""
    return upload_file(
        file=file,
        category='announcements',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"announcement_{announcement_id}",
        user_type='admins',
        max_size_mb=5
    )


def upload_benefit_document(
    file: BinaryIO,
    application_id: int,
    municipality_slug: str,
    original_filename: str
) -> Tuple[str, str]:
    """Upload a benefit application document."""
    return upload_file(
        file=file,
        category='benefits',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"application_{application_id}",
        user_type='residents',
        max_size_mb=10
    )


def upload_benefit_program_image(
    file: BinaryIO,
    program_id: int,
    municipality_slug: str,
    original_filename: str
) -> Tuple[str, str]:
    """Upload a benefit program image."""
    return upload_file(
        file=file,
        category='benefit_programs',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"program_{program_id}",
        user_type='admins',
        max_size_mb=5
    )


def upload_qr_code(
    qr_image_bytes: bytes,
    request_id: int,
    municipality_slug: str
) -> Tuple[str, str]:
    """Upload a generated QR code image."""
    filename = f"qr_{request_id}.png"
    return upload_bytes(
        data=qr_image_bytes,
        category='qr_codes',
        municipality_slug=municipality_slug,
        filename=filename,
        subcategory=None,
        user_type='system',
        content_type='image/png'
    )


def upload_generated_document(
    pdf_bytes: bytes,
    request_id: int,
    municipality_slug: str
) -> Tuple[str, str]:
    """Upload a generated document PDF."""
    filename = f"doc_{request_id}.pdf"
    return upload_bytes(
        data=pdf_bytes,
        category='generated_docs',
        municipality_slug=municipality_slug,
        filename=filename,
        subcategory=None,
        user_type='system',
        content_type='application/pdf'
    )


def upload_document_request_file(
    file: BinaryIO,
    request_id: int,
    municipality_slug: str,
    original_filename: str
) -> Tuple[str, str]:
    """Upload a document request supporting file."""
    return upload_file(
        file=file,
        category='document_requests',
        municipality_slug=municipality_slug,
        original_filename=original_filename,
        subcategory=f"request_{request_id}",
        user_type='residents',
        max_size_mb=10
    )
