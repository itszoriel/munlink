"""QR code generation utilities for document validation.

This module provides QR code generation for document requests:
- Generates verification URLs for documents
- Creates QR code images in memory (no filesystem dependency)
- Uploads to Supabase Storage in production
- Returns base64 or public URLs

Production Ready:
- All QR codes are generated in memory
- Uploaded to Supabase Storage for persistence
- Never written to local filesystem in production
"""
import qrcode
import json
import os
import logging
from datetime import datetime
from flask import current_app
from io import BytesIO
import base64

logger = logging.getLogger(__name__)


def generate_qr_code_data(document_request):
    """
    Generate simple verification URL for QR code.
    
    Returns a simple URL string that can be scanned and opened directly.
    Format: https://your-domain.com/verify/REQ-2024-001
    
    Priority for base URL:
    1. VERIFICATION_BASE_URL env var (recommended for production)
    2. WEB_BASE_URL env var
    3. WEB_URL from Flask config
    4. QR_BASE_URL from Flask config  
    5. Default fallback (localhost for development)
    
    Production Setup (.env):
        VERIFICATION_BASE_URL=https://munlink.vercel.app
        # or
        WEB_URL=https://munlink.vercel.app
    """
    base_url = None
    
    # 1. Try environment variables first (highest priority for production)
    base_url = os.getenv('VERIFICATION_BASE_URL') or os.getenv('WEB_BASE_URL') or os.getenv('WEB_URL')
    
    # 2. Then try Flask config (if app context exists)
    if not base_url and current_app:
        base_url = (
            current_app.config.get('VERIFICATION_BASE_URL')
            or current_app.config.get('WEB_BASE_URL')
            or current_app.config.get('WEB_URL')
            or current_app.config.get('QR_BASE_URL')
        )
    
    # Remove /verify suffix if present (we'll add it below)
    if base_url and base_url.endswith('/verify'):
        base_url = base_url[:-7]
    
    # 3. Default fallback for local development only
    if not base_url:
        base_url = 'http://localhost:5173'
        if current_app:
            current_app.logger.warning(
                "QR code using default localhost URL. "
                "Set VERIFICATION_BASE_URL or WEB_URL in .env for production."
            )
    
    return f"{base_url}/verify/{document_request.request_number}"


def generate_qr_code_bytes(qr_data: str, size: int = 300) -> bytes:
    """
    Generate QR code image as raw bytes (in memory).
    
    Args:
        qr_data: String URL to encode
        size: Size of QR code in pixels
    
    Returns:
        PNG image bytes
    """
    qr_string = str(qr_data)
    
    # Create QR code instance
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    
    qr.add_data(qr_string)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Resize to specified size
    img = img.resize((size, size))
    
    # Convert to bytes
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    
    return buffered.getvalue()


def generate_qr_code_image(qr_data, size=300):
    """
    Generate QR code image from data.
    
    Args:
        qr_data: String URL to encode
        size: Size of QR code in pixels
    
    Returns:
        Base64 encoded PNG image (data URL format)
    """
    png_bytes = generate_qr_code_bytes(qr_data, size)
    img_str = base64.b64encode(png_bytes).decode()
    return f"data:image/png;base64,{img_str}"


def generate_and_upload_qr_code(
    document_request,
    municipality_slug: str,
    size: int = 300
) -> str:
    """
    Generate a QR code and upload to Supabase Storage.
    
    This is the production-ready function that:
    1. Generates QR code in memory
    2. Uploads to Supabase Storage
    3. Returns the public URL
    
    Args:
        document_request: DocumentRequest object
        municipality_slug: Municipality slug for storage path
        size: QR code size in pixels
    
    Returns:
        Public URL of the QR code image
    
    Raises:
        Exception if upload fails
    """
    # Generate verification URL
    qr_data = generate_qr_code_data(document_request)
    
    # Generate QR code bytes
    qr_bytes = generate_qr_code_bytes(qr_data, size)
    
    # Upload to storage
    try:
        from utils.storage_handler import save_qr_code
        
        public_url = save_qr_code(
            qr_image_bytes=qr_bytes,
            request_id=document_request.id,
            municipality_slug=municipality_slug
        )
        
        logger.info(f"QR code uploaded for request {document_request.id}: {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"Failed to upload QR code: {e}")
        raise


def save_qr_code_file(qr_data, file_path):
    """
    Save QR code as PNG file (legacy/development only).
    
    WARNING: This function writes to local filesystem.
    In production, use generate_and_upload_qr_code() instead.
    
    Args:
        qr_data: String URL to encode (simple verification URL)
        file_path: Path where to save the file
    
    Returns:
        The file_path that was written to
    """
    # Check if we're in production - warn about filesystem usage
    flask_env = os.getenv('FLASK_ENV', 'development')
    if flask_env == 'production':
        logger.warning(
            f"save_qr_code_file() called in production! "
            f"Files written to filesystem will be lost on restart. "
            f"Use generate_and_upload_qr_code() instead."
        )
    
    # Generate QR code bytes
    qr_bytes = generate_qr_code_bytes(qr_data)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Save image
    with open(file_path, 'wb') as f:
        f.write(qr_bytes)
    
    return file_path


def get_qr_code_bytesio(qr_data: str, size: int = 300) -> BytesIO:
    """
    Get QR code as a BytesIO object (for embedding in PDFs).
    
    Args:
        qr_data: String URL to encode
        size: Size of QR code in pixels
    
    Returns:
        BytesIO object containing PNG image
    """
    qr_bytes = generate_qr_code_bytes(qr_data, size)
    return BytesIO(qr_bytes)


def validate_qr_data(qr_string):
    """
    Validate and parse QR code data.
    
    Returns:
        Parsed QR data dictionary or None if invalid
    """
    try:
        qr_data = json.loads(qr_string)
        
        # Check required fields
        required_fields = ['request_number', 'document_type', 'issued_to', 'municipality']
        
        for field in required_fields:
            if field not in qr_data:
                return None
        
        return qr_data
    
    except (json.JSONDecodeError, TypeError):
        return None


def regenerate_qr_code(document_request, municipality_slug: str) -> str:
    """
    Regenerate a QR code for an existing document request.
    
    This can be used to:
    - Fix broken QR codes after migration
    - Refresh QR codes that were lost
    
    Args:
        document_request: DocumentRequest object
        municipality_slug: Municipality slug
    
    Returns:
        New public URL of the QR code
    """
    return generate_and_upload_qr_code(document_request, municipality_slug)

