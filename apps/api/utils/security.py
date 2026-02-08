"""Security utilities for MunLink API.

This module provides:
- Standardized error responses (safe for production)
- MIME type validation for file uploads
- Security helpers
"""
import logging
from typing import Optional, Dict, Any, Set
from flask import jsonify, current_app


# =============================================================================
# Standardized Error Responses
# =============================================================================

class APIError(Exception):
    """Base exception for API errors with safe error messages."""
    
    def __init__(self, message: str, code: str = None, status_code: int = 500, details: str = None):
        super().__init__(message)
        self.message = message
        self.code = code or 'ERROR'
        self.status_code = status_code
        self.details = details  # Only shown in debug mode


def safe_error_response(
    message: str,
    exception: Optional[Exception] = None,
    status_code: int = 500,
    code: str = None,
    log_level: str = 'error'
) -> tuple:
    """
    Create a standardized, safe error response.
    
    In production:
    - Only shows the safe message
    - Logs the full error server-side
    - Never exposes stack traces or internal details
    
    In debug mode:
    - Includes exception details for easier debugging
    
    Args:
        message: Safe error message for clients
        exception: The caught exception (optional)
        status_code: HTTP status code
        code: Optional error code for client parsing
        log_level: Logging level ('error', 'warning', 'info')
    
    Returns:
        Tuple of (response, status_code)
    """
    response = {'error': message}
    
    if code:
        response['code'] = code
    
    # Log the error server-side
    logger = current_app.logger if current_app else logging.getLogger(__name__)
    log_message = f"{message}"
    if exception:
        log_message += f": {type(exception).__name__}: {exception}"
    
    log_func = getattr(logger, log_level, logger.error)
    log_func(log_message)
    
    # Only include details in debug mode
    if current_app and current_app.config.get('DEBUG') and exception:
        response['details'] = str(exception)
        response['exception_type'] = type(exception).__name__
    
    return jsonify(response), status_code


def error_400(message: str = "Bad request", exception: Exception = None, code: str = None):
    """Bad request error."""
    return safe_error_response(message, exception, 400, code, 'warning')


def error_401(message: str = "Unauthorized", exception: Exception = None, code: str = None):
    """Unauthorized error."""
    return safe_error_response(message, exception, 401, code, 'warning')


def error_403(message: str = "Forbidden", exception: Exception = None, code: str = None):
    """Forbidden error."""
    return safe_error_response(message, exception, 403, code, 'warning')


def error_404(message: str = "Not found", exception: Exception = None, code: str = None):
    """Not found error."""
    return safe_error_response(message, exception, 404, code, 'info')


def error_409(message: str = "Conflict", exception: Exception = None, code: str = None):
    """Conflict error (e.g., duplicate resource)."""
    return safe_error_response(message, exception, 409, code, 'warning')


def error_429(message: str = "Too many requests", exception: Exception = None, code: str = None):
    """Rate limit exceeded."""
    return safe_error_response(message, exception, 429, code or 'RATE_LIMITED', 'warning')


def error_500(message: str = "Internal server error", exception: Exception = None, code: str = None):
    """Internal server error."""
    return safe_error_response(message, exception, 500, code, 'error')


# =============================================================================
# MIME Type Validation
# =============================================================================

# Mapping of allowed extensions to their expected MIME types
MIME_TYPE_MAP: Dict[str, Set[str]] = {
    # Images
    'jpg': {'image/jpeg', 'image/pjpeg', 'image/jpg'},
    'jpeg': {'image/jpeg', 'image/pjpeg', 'image/jpg'},
    'png': {'image/png', 'image/x-png'},
    'gif': {'image/gif'},
    'webp': {'image/webp'},
    'heic': {'image/heic', 'image/heif', 'image/heif-sequence', 'image/heic-sequence'},
    'heif': {'image/heif', 'image/heic', 'image/heif-sequence', 'image/heic-sequence'},
    'hevc': {'image/heic', 'image/heif', 'image/heif-sequence', 'image/heic-sequence'},
    # Documents
    'pdf': {'application/pdf'},
    'doc': {'application/msword'},
    'docx': {'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
}

# All allowed image MIME types
ALLOWED_IMAGE_MIMES = {
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png', 
    'image/x-png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/heif-sequence',
    'image/heic-sequence',
}

# All allowed document MIME types
ALLOWED_DOCUMENT_MIMES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/x-png',
    'image/heic',
    'image/heif',
    'image/heif-sequence',
    'image/heic-sequence',
}


def validate_file_mime_type(
    file,
    allowed_mimes: Set[str] = None,
    extension: str = None
) -> str:
    """
    Validate file content type using magic bytes.

    This provides defense-in-depth beyond extension checking by actually
    reading the file's magic bytes to determine its true type.

    Args:
        file: File-like object with read() and seek() methods
        allowed_mimes: Set of allowed MIME types (optional)
        extension: Expected extension to validate against (optional, with or without leading dot)

    Returns:
        Detected MIME type

    Raises:
        ValidationError: If MIME type is not allowed or doesn't match extension
    """
    from apps.api.utils.validators import ValidationError

    # Normalize extension (remove leading dot if present)
    normalized_ext = None
    if extension:
        normalized_ext = extension.lower().strip()
        if normalized_ext.startswith('.'):
            normalized_ext = normalized_ext[1:]

    # Try to use python-magic for accurate detection
    fallback_from_extension = False
    try:
        import magic

        # Read first 2048 bytes for MIME detection
        file.seek(0)
        header = file.read(2048)
        file.seek(0)

        # Detect MIME type
        detected_mime = magic.from_buffer(header, mime=True)

    except ImportError:
        # python-magic not available, fall back to extension-based validation
        current_app.logger.warning(
            "python-magic not installed - MIME validation disabled. "
            "Install with: pip install python-magic-bin (Windows) or python-magic (Linux)"
        )
        # Trust extension but warn
        fallback_from_extension = True
        if normalized_ext:
            detected_mime = list(MIME_TYPE_MAP.get(normalized_ext, {'application/octet-stream'}))[0]
        else:
            detected_mime = 'application/octet-stream'

    except Exception as e:
        current_app.logger.error(f"MIME detection error: {e}")
        fallback_from_extension = True
        detected_mime = 'application/octet-stream'

    # If magic could not identify the content, fall back to the expected MIME from extension
    if detected_mime in ('application/octet-stream', 'binary/octet-stream', 'application/x-empty', 'inode/x-empty', None):
        if normalized_ext:
            expected_mimes = MIME_TYPE_MAP.get(normalized_ext, set())
            if expected_mimes:
                detected_mime = list(expected_mimes)[0]
                fallback_from_extension = True
                if current_app:
                    current_app.logger.info(
                        f"MIME detection fallback for .{normalized_ext}: using {detected_mime}"
                    )

    # Validate against allowed MIME types
    if allowed_mimes and detected_mime not in allowed_mimes:
        # If we fell back to extension and the expected set is allowed, allow it
        expected_mimes = MIME_TYPE_MAP.get(normalized_ext, set()) if normalized_ext else set()
        if fallback_from_extension and expected_mimes and expected_mimes.intersection(allowed_mimes):
            pass  # accept the file based on trusted extension + size validation
        else:
            raise ValidationError(
                'file',
                f'File type not allowed. Detected: {detected_mime}. '
                f'Allowed: {", ".join(sorted(allowed_mimes))}'
            )

    # Validate MIME matches extension if provided
    if normalized_ext:
        expected_mimes = MIME_TYPE_MAP.get(normalized_ext, set())
        if expected_mimes and detected_mime not in expected_mimes:
            raise ValidationError(
                'file',
                f'File content does not match extension .{normalized_ext}. '
                f'Detected: {detected_mime}'
            )

    return detected_mime


def validate_image_file(file) -> str:
    """
    Validate that a file is an allowed image type.
    
    Args:
        file: File-like object
    
    Returns:
        Detected MIME type
    
    Raises:
        ValidationError: If not a valid image
    """
    return validate_file_mime_type(file, ALLOWED_IMAGE_MIMES)


def validate_document_file(file) -> str:
    """
    Validate that a file is an allowed document type.
    
    Args:
        file: File-like object
    
    Returns:
        Detected MIME type
    
    Raises:
        ValidationError: If not a valid document
    """
    return validate_file_mime_type(file, ALLOWED_DOCUMENT_MIMES)


# =============================================================================
# Security Helpers
# =============================================================================

def sanitize_log_message(message: str, sensitive_fields: Set[str] = None) -> str:
    """
    Sanitize a message before logging to prevent sensitive data leakage.
    
    Args:
        message: The message to sanitize
        sensitive_fields: Set of field names to redact
    
    Returns:
        Sanitized message
    """
    if sensitive_fields is None:
        sensitive_fields = {'password', 'token', 'secret', 'api_key', 'authorization'}
    
    sanitized = message
    for field in sensitive_fields:
        # Simple pattern matching - replace values after common patterns
        import re
        patterns = [
            rf"({field}['\"]?\s*[:=]\s*['\"]?)([^'\",\s]+)",
            rf"({field}['\"]?\s*[:=]\s*)([^\s,}}]+)",
        ]
        for pattern in patterns:
            sanitized = re.sub(pattern, r'\1[REDACTED]', sanitized, flags=re.IGNORECASE)
    
    return sanitized

