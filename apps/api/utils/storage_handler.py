"""
Unified storage handler for MunLink Region 3.

This module provides a single interface for file storage operations that:
- Uses Supabase Storage in production (persistent, cloud-based)
- Falls back to local filesystem in development (when Supabase not configured)
- Handles legacy path detection and URL resolution
- Maintains backward compatibility with existing code

This replaces direct usage of file_handler.py for production deployments.

Usage:
    from utils.storage_handler import (
        save_file,
        save_profile_picture,
        save_marketplace_image,
        get_file_url,
        is_file_missing,
    )
"""
from __future__ import annotations

import os
import logging
from typing import Optional, Tuple, BinaryIO, Union
from io import BytesIO
from pathlib import Path

from flask import current_app
from werkzeug.datastructures import FileStorage

logger = logging.getLogger(__name__)

# Import validators
from utils.validators import (
    validate_file_size, 
    validate_file_extension, 
    ALLOWED_IMAGE_EXTENSIONS, 
    ALLOWED_DOCUMENT_EXTENSIONS
)


class StorageError(Exception):
    """Custom storage error."""
    pass


def _is_supabase_configured() -> bool:
    """Check if Supabase Storage is configured."""
    supabase_url = current_app.config.get('SUPABASE_URL') or os.getenv('SUPABASE_URL')
    supabase_key = (
        current_app.config.get('SUPABASE_SERVICE_KEY') or 
        os.getenv('SUPABASE_SERVICE_KEY') or
        current_app.config.get('SUPABASE_KEY') or 
        os.getenv('SUPABASE_KEY')
    )
    return bool(supabase_url and supabase_key)


def _is_production() -> bool:
    """Check if running in production."""
    flask_env = current_app.config.get('FLASK_ENV') or os.getenv('FLASK_ENV', 'development')
    return flask_env == 'production'


def _use_supabase_storage() -> bool:
    """
    Determine whether to use Supabase Storage.
    
    Returns True if:
    - Running in production mode, OR
    - Supabase is configured AND FORCE_SUPABASE_STORAGE env is set
    """
    if _is_production():
        return True
    
    # In development, use Supabase if explicitly configured and forced
    if os.getenv('FORCE_SUPABASE_STORAGE', '').lower() == 'true':
        return _is_supabase_configured()
    
    return False


def save_file(
    file: Union[FileStorage, BinaryIO],
    category: str,
    municipality_slug: str,
    subcategory: Optional[str] = None,
    allowed_extensions: Optional[set] = None,
    max_size_mb: int = 10,
    user_type: str = 'residents',
    validate_mime: bool = True
) -> str:
    """
    Save an uploaded file to storage.
    
    In production: Uploads to Supabase Storage.
    In development: Falls back to local filesystem if Supabase not configured.
    
    Args:
        file: FileStorage or file-like object
        category: Category of upload (profiles, marketplace, etc.)
        municipality_slug: Municipality slug for organization
        subcategory: Optional subcategory
        allowed_extensions: Set of allowed file extensions
        max_size_mb: Maximum file size in MB
        user_type: Type of user (residents, admins)
        validate_mime: Whether to validate MIME type
    
    Returns:
        File URL (Supabase public URL or local path)
    
    Raises:
        StorageError: If upload fails
    """
    from werkzeug.utils import secure_filename
    
    if not file:
        raise StorageError('No file provided')
    
    # Get filename
    original_filename = getattr(file, 'filename', None) or 'upload'
    if not original_filename or original_filename == '':
        raise StorageError('No filename provided')
    
    # Secure the filename
    safe_filename = secure_filename(original_filename)
    
    # Validate file extension if extensions specified
    if allowed_extensions:
        validate_file_extension(safe_filename, allowed_extensions)
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    validate_file_size(file_size, max_size_mb)
    
    # Validate MIME type if enabled
    if validate_mime:
        try:
            from utils.security import validate_file_mime_type
            from utils.file_handler import ALLOWED_IMAGE_MIMES, ALLOWED_DOCUMENT_MIMES
            
            if allowed_extensions == ALLOWED_IMAGE_EXTENSIONS:
                allowed_mimes = ALLOWED_IMAGE_MIMES
            elif allowed_extensions == ALLOWED_DOCUMENT_EXTENSIONS:
                allowed_mimes = ALLOWED_DOCUMENT_MIMES
            else:
                allowed_mimes = ALLOWED_IMAGE_MIMES | ALLOWED_DOCUMENT_MIMES
            
            _, ext = os.path.splitext(safe_filename)
            validate_file_mime_type(file, allowed_mimes, ext)
        except ImportError:
            logger.warning("MIME validation skipped - security module not available")
        except Exception as e:
            raise StorageError(f'File content validation failed: {e}')
    
    # Decide storage backend
    if _use_supabase_storage():
        return _save_to_supabase(
            file=file,
            category=category,
            municipality_slug=municipality_slug,
            original_filename=safe_filename,
            subcategory=subcategory,
            user_type=user_type,
            max_size_mb=max_size_mb
        )
    else:
        return _save_to_filesystem(
            file=file,
            category=category,
            municipality_slug=municipality_slug,
            original_filename=safe_filename,
            subcategory=subcategory,
            user_type=user_type
        )


def _save_to_supabase(
    file: BinaryIO,
    category: str,
    municipality_slug: str,
    original_filename: str,
    subcategory: Optional[str],
    user_type: str,
    max_size_mb: int
) -> str:
    """Save file to Supabase Storage, return public URL."""
    try:
        from utils.supabase_storage import upload_file as supabase_upload
        
        # Determine content type
        content_type = None
        if hasattr(file, 'content_type'):
            content_type = file.content_type
        
        storage_path, public_url = supabase_upload(
            file=file,
            category=category,
            municipality_slug=municipality_slug,
            original_filename=original_filename,
            subcategory=subcategory,
            user_type=user_type,
            content_type=content_type,
            max_size_mb=max_size_mb
        )
        
        logger.info(f"File saved to Supabase: {storage_path}")
        return public_url
        
    except Exception as e:
        logger.error(f"Supabase upload failed: {e}")
        raise StorageError(f"Failed to upload file: {e}")


def _save_to_filesystem(
    file: BinaryIO,
    category: str,
    municipality_slug: str,
    original_filename: str,
    subcategory: Optional[str],
    user_type: str
) -> str:
    """Save file to local filesystem, return relative path."""
    from utils.file_handler import (
        get_file_path, 
        ensure_directory_exists, 
        generate_unique_filename
    )
    
    # Generate unique filename
    unique_filename = generate_unique_filename(original_filename)
    
    # Build directory path
    directory = get_file_path(category, municipality_slug, subcategory, user_type=user_type)
    ensure_directory_exists(directory)
    
    # Full file path
    file_path = os.path.join(directory, unique_filename)
    
    # Save the file
    file.seek(0)
    if hasattr(file, 'save'):
        file.save(file_path)
    else:
        with open(file_path, 'wb') as f:
            f.write(file.read())
    
    # Return relative path from upload directory
    upload_base_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    relative_path = os.path.relpath(file_path, upload_base_dir)
    
    logger.info(f"File saved to filesystem: {relative_path}")
    return relative_path


def save_bytes(
    data: bytes,
    category: str,
    municipality_slug: str,
    filename: str,
    subcategory: Optional[str] = None,
    user_type: str = 'residents',
    content_type: str = 'application/octet-stream'
) -> str:
    """
    Save raw bytes to storage.
    
    Args:
        data: Raw bytes to save
        category: Category of upload
        municipality_slug: Municipality slug
        filename: Filename with extension
        subcategory: Optional subcategory
        user_type: Type of user
        content_type: MIME type
    
    Returns:
        File URL or path
    """
    if _use_supabase_storage():
        try:
            from utils.supabase_storage import upload_bytes as supabase_upload_bytes
            
            storage_path, public_url = supabase_upload_bytes(
                data=data,
                category=category,
                municipality_slug=municipality_slug,
                filename=filename,
                subcategory=subcategory,
                user_type=user_type,
                content_type=content_type
            )
            
            logger.info(f"Bytes saved to Supabase: {storage_path}")
            return public_url
            
        except Exception as e:
            logger.error(f"Supabase bytes upload failed: {e}")
            raise StorageError(f"Failed to upload: {e}")
    else:
        # Save to filesystem
        from utils.file_handler import (
            get_file_path, 
            ensure_directory_exists, 
            generate_unique_filename
        )
        
        unique_filename = generate_unique_filename(filename)
        directory = get_file_path(category, municipality_slug, subcategory, user_type=user_type)
        ensure_directory_exists(directory)
        
        file_path = os.path.join(directory, unique_filename)
        
        with open(file_path, 'wb') as f:
            f.write(data)
        
        upload_base_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        relative_path = os.path.relpath(file_path, upload_base_dir)
        
        logger.info(f"Bytes saved to filesystem: {relative_path}")
        return relative_path


def get_file_url(file_path: str, base_url: Optional[str] = None) -> str:
    """
    Get the public URL for a file.
    
    Handles both:
    - Supabase Storage URLs (returned as-is)
    - Legacy filesystem paths (converted to API URL)
    
    Args:
        file_path: File path or URL
        base_url: Base URL for API (optional)
    
    Returns:
        Public URL string
    """
    if not file_path:
        return ''
    
    # If already a full URL, return as-is
    if file_path.startswith(('http://', 'https://')):
        return file_path
    
    # Legacy filesystem path - convert to API URL
    if base_url is None:
        base_url = os.getenv('BASE_URL', 'http://localhost:5000')
    
    # Normalize path separators
    normalized_path = file_path.replace('\\', '/')
    
    # Remove leading slashes
    if normalized_path.startswith('/'):
        normalized_path = normalized_path[1:]
    
    return f"{base_url}/uploads/{normalized_path}"


def is_supabase_url(url: str) -> bool:
    """Check if a URL is from Supabase Storage."""
    if not url:
        return False
    return 'supabase' in url.lower() and '/storage/' in url.lower()


def is_legacy_path(path: str) -> bool:
    """
    Check if a path is a legacy filesystem path.
    
    Returns True if the path appears to be a local filesystem path
    rather than a Supabase URL.
    """
    if not path:
        return False
    
    # Supabase URLs are not legacy
    if is_supabase_url(path):
        return False
    
    # External URLs that aren't Supabase are not legacy (could be CDN, etc.)
    if path.startswith(('http://', 'https://')):
        return False
    
    # Everything else is assumed to be a legacy filesystem path
    return True


def is_file_missing(path: str) -> bool:
    """
    Check if a file reference is broken/missing.
    
    For Supabase URLs: Assumes file exists (would need HTTP check)
    For legacy paths: Checks filesystem
    
    Args:
        path: File path or URL
    
    Returns:
        True if file is definitely missing
    """
    if not path:
        return True
    
    # Supabase URLs - assume valid (can't easily check without HTTP request)
    if is_supabase_url(path):
        return False
    
    # Full external URLs - assume valid
    if path.startswith(('http://', 'https://')):
        return False
    
    # Legacy filesystem path - check if file exists
    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    
    # Normalize path
    normalized_path = path.replace('\\', '/')
    if normalized_path.startswith('/'):
        normalized_path = normalized_path[1:]
    
    full_path = os.path.join(upload_folder, normalized_path)
    
    return not os.path.exists(full_path)


# Convenience wrappers for specific file types

def save_profile_picture(
    file: Union[FileStorage, BinaryIO],
    user_id: int,
    municipality_slug: str,
    user_type: str = 'residents'
) -> str:
    """Save user profile picture."""
    return save_file(
        file=file,
        category='profiles',
        municipality_slug=municipality_slug,
        subcategory=f"user_{user_id}",
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type=user_type
    )


def save_verification_document(
    file: Union[FileStorage, BinaryIO],
    user_id: int,
    municipality_slug: str,
    doc_type: str,
    user_type: str = 'residents'
) -> str:
    """Save user verification document."""
    allowed_doc_types = {'valid_id_front', 'valid_id_back', 'selfie_with_id'}
    if doc_type not in allowed_doc_types:
        raise StorageError('Unsupported verification document type')
    
    return save_file(
        file=file,
        category='verification',
        municipality_slug=municipality_slug,
        subcategory=f"user_{user_id}/{doc_type}",
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type=user_type
    )


def save_marketplace_image(
    file: Union[FileStorage, BinaryIO],
    item_id: int,
    municipality_slug: str
) -> str:
    """Save marketplace item image."""
    return save_file(
        file=file,
        category='marketplace',
        municipality_slug=municipality_slug,
        subcategory=f"item_{item_id}",
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type='residents'
    )


def save_issue_attachment(
    file: Union[FileStorage, BinaryIO],
    issue_id: int,
    municipality_slug: str
) -> str:
    """Save issue report attachment."""
    return save_file(
        file=file,
        category='issues',
        municipality_slug=municipality_slug,
        subcategory=f"issue_{issue_id}",
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS,
        max_size_mb=10,
        user_type='residents'
    )


def save_announcement_image(
    file: Union[FileStorage, BinaryIO],
    announcement_id: int,
    municipality_slug: str
) -> str:
    """Save announcement image."""
    return save_file(
        file=file,
        category='announcements',
        municipality_slug=municipality_slug,
        subcategory=f"announcement_{announcement_id}",
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type='admins'
    )


def save_benefit_document(
    file: Union[FileStorage, BinaryIO],
    application_id: int,
    municipality_slug: str
) -> str:
    """Save benefit application document."""
    return save_file(
        file=file,
        category='benefits',
        municipality_slug=municipality_slug,
        subcategory=f"application_{application_id}",
        allowed_extensions=ALLOWED_DOCUMENT_EXTENSIONS,
        max_size_mb=10,
        user_type='residents'
    )


def save_benefit_program_image(
    file: Union[FileStorage, BinaryIO],
    program_id: int,
    municipality_slug: str,
    user_type: str = 'admins'
) -> str:
    """Save benefit program image."""
    return save_file(
        file=file,
        category='benefit_programs',
        municipality_slug=municipality_slug,
        subcategory=f"program_{program_id}",
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type=user_type
    )


def save_document_request_file(
    file: Union[FileStorage, BinaryIO],
    request_id: int,
    municipality_slug: str
) -> str:
    """Save document request supporting file."""
    return save_file(
        file=file,
        category='document_requests',
        municipality_slug=municipality_slug,
        subcategory=f"request_{request_id}",
        allowed_extensions=ALLOWED_DOCUMENT_EXTENSIONS,
        max_size_mb=10,
        user_type='residents'
    )


def save_qr_code(
    qr_image_bytes: bytes,
    request_id: int,
    municipality_slug: str
) -> str:
    """Save a generated QR code image."""
    return save_bytes(
        data=qr_image_bytes,
        category='qr_codes',
        municipality_slug=municipality_slug,
        filename=f"qr_{request_id}.png",
        subcategory=None,
        user_type='system',
        content_type='image/png'
    )


def save_generated_document(
    pdf_bytes: bytes,
    request_id: int,
    municipality_slug: str
) -> str:
    """Save a generated document PDF."""
    return save_bytes(
        data=pdf_bytes,
        category='generated_docs',
        municipality_slug=municipality_slug,
        filename=f"doc_{request_id}.pdf",
        subcategory=None,
        user_type='system',
        content_type='application/pdf'
    )

