"""File upload and storage utilities."""
import os
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
from utils.validators import validate_file_size, validate_file_extension, ALLOWED_IMAGE_EXTENSIONS, ALLOWED_DOCUMENT_EXTENSIONS

# MIME type sets for validation
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

# Base upload directory - will be set by Flask app
UPLOAD_BASE_DIR = None


class FileUploadError(Exception):
    """Custom file upload error."""
    pass


def get_file_path(category, municipality_slug, subcategory=None, filename=None, user_type='residents'):
    """
    Generate hierarchical file path based on category, municipality, and user type.
    
    Structure: uploads/{category}/{user_type}/{municipality_slug}/{subcategory}/{filename}
    
    Categories:
    - profiles (user profile pictures)
    - verification (ID documents)
    - marketplace (item images)
    - documents (generated municipal documents)
    - issues (issue attachments)
    - benefits (benefit application documents)
    
    User Types:
    - residents (regular users)
    - admins (municipal administrators)
    """
    from flask import current_app
    upload_base_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    parts = [upload_base_dir, category, user_type, municipality_slug]
    
    if subcategory:
        parts.append(subcategory)
    
    if filename:
        parts.append(filename)
    
    return os.path.join(*parts)


def ensure_directory_exists(directory):
    """Create directory if it doesn't exist."""
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)


def generate_unique_filename(original_filename):
    """Generate a unique filename while preserving extension."""
    # Get file extension
    _, ext = os.path.splitext(original_filename)
    
    # Generate unique name with timestamp and UUID
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    
    return f"{timestamp}_{unique_id}{ext}"


def save_uploaded_file(file, category, municipality_slug, subcategory=None, allowed_extensions=None, max_size_mb=10, user_type='residents', validate_mime=True):
    """
    Save an uploaded file and return the file path.
    
    Args:
        file: FileStorage object from request.files
        category: Category of upload (profiles, marketplace, etc.)
        municipality_slug: Municipality slug for organization
        subcategory: Optional subcategory
        allowed_extensions: Set of allowed file extensions
        max_size_mb: Maximum file size in MB
        user_type: Type of user (residents, admins)
        validate_mime: Whether to validate MIME type (recommended: True)
    
    Returns:
        Relative file path from uploads directory
    
    Security:
        - Validates file extension against whitelist
        - Validates file size
        - Optionally validates MIME type against actual file content
    """
    from flask import current_app
    
    if not file:
        raise FileUploadError('No file provided')
    
    if not file.filename:
        raise FileUploadError('No filename provided')
    
    # Secure the filename
    original_filename = secure_filename(file.filename)
    
    # Validate file extension
    extension = validate_file_extension(original_filename, allowed_extensions)
    
    # Check file size (if we can get it)
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    validate_file_size(file_size, max_size_mb)
    
    # Validate MIME type if enabled (defense in depth)
    if validate_mime:
        try:
            from utils.security import validate_file_mime_type
            
            # Determine allowed MIME types based on allowed extensions
            if allowed_extensions == ALLOWED_IMAGE_EXTENSIONS:
                allowed_mimes = ALLOWED_IMAGE_MIMES
            elif allowed_extensions == ALLOWED_DOCUMENT_EXTENSIONS:
                allowed_mimes = ALLOWED_DOCUMENT_MIMES
            else:
                # For mixed or custom extensions, allow common types
                allowed_mimes = ALLOWED_IMAGE_MIMES | ALLOWED_DOCUMENT_MIMES
            
            validate_file_mime_type(file, allowed_mimes, extension)
        except ImportError:
            # Security module not available - log warning but continue
            current_app.logger.warning("MIME validation skipped - security module not available")
        except Exception as e:
            # MIME validation failed
            raise FileUploadError(f'File content validation failed: {e}')
    
    # Generate unique filename
    unique_filename = generate_unique_filename(original_filename)
    
    # Build directory path
    directory = get_file_path(category, municipality_slug, subcategory, user_type=user_type)
    ensure_directory_exists(directory)
    
    # Full file path
    file_path = os.path.join(directory, unique_filename)
    
    # Save the file
    file.save(file_path)
    
    # Return relative path (from upload directory)
    upload_base_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    relative_path = os.path.relpath(file_path, upload_base_dir)
    
    return relative_path


def save_profile_picture(file, user_id, municipality_slug, user_type='residents'):
    """Save user profile picture."""
    subcategory = f"user_{user_id}"
    return save_uploaded_file(
        file,
        category='profiles',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type=user_type
    )


def save_verification_document(file, user_id, municipality_slug, doc_type, user_type='residents'):
    """
    Save user verification document.
    
    Allowed doc_type values: 'valid_id_front', 'valid_id_back'.
    Other values are not accepted.
    """
    allowed_doc_types = {'valid_id_front', 'valid_id_back', 'selfie_with_id'}
    if doc_type not in allowed_doc_types:
        raise FileUploadError('Unsupported verification document type')
    subcategory = f"user_{user_id}"
    return save_uploaded_file(
        file,
        category='verification',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type=user_type
    )


def save_marketplace_image(file, item_id, municipality_slug):
    """Save marketplace item image."""
    subcategory = f"item_{item_id}"
    return save_uploaded_file(
        file,
        category='marketplace',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5
    )


def save_issue_attachment(file, issue_id, municipality_slug):
    """Save issue report attachment."""
    subcategory = f"issue_{issue_id}"
    return save_uploaded_file(
        file,
        category='issues',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS,
        max_size_mb=10
    )


def save_announcement_image(file, announcement_id, municipality_slug):
    """Save announcement image file."""
    subcategory = f"announcement_{announcement_id}"
    return save_uploaded_file(
        file,
        category='announcements',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5
    )


def save_benefit_document(file, application_id, municipality_slug):
    """Save benefit application document."""
    subcategory = f"application_{application_id}"
    return save_uploaded_file(
        file,
        category='benefits',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_DOCUMENT_EXTENSIONS,
        max_size_mb=10
    )


def save_benefit_program_image(file, program_id, municipality_slug, user_type='admins'):
    """Save benefit program image (used by admin create/edit)."""
    subcategory = f"program_{program_id}"
    return save_uploaded_file(
        file,
        category='benefit_programs',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_IMAGE_EXTENSIONS,
        max_size_mb=5,
        user_type=user_type
    )


def save_document_request_file(file, request_id, municipality_slug):
    """Save document request supporting file."""
    subcategory = f"request_{request_id}"
    return save_uploaded_file(
        file,
        category='document_requests',
        municipality_slug=municipality_slug,
        subcategory=subcategory,
        allowed_extensions=ALLOWED_DOCUMENT_EXTENSIONS,
        max_size_mb=10
    )


def delete_file(file_path):
    """Delete a file if it exists."""
    full_path = os.path.join(UPLOAD_BASE_DIR, file_path)
    
    if os.path.exists(full_path):
        try:
            os.remove(full_path)
            return True
        except OSError:
            return False
    
    return False


def get_file_url(file_path, base_url=None):
    """Generate public URL for a file."""
    if not file_path:
        return None
    
    if base_url is None:
        base_url = os.getenv('BASE_URL', 'http://localhost:5000')
    
    return f"{base_url}/uploads/{file_path}"


def cleanup_user_files(user_id, municipality_slug):
    """Delete all files for a user (when deleting account)."""
    import shutil
    
    categories = ['profiles', 'verification']
    subcategory = f"user_{user_id}"
    
    for category in categories:
        directory = get_file_path(category, municipality_slug, subcategory)
        if os.path.exists(directory):
            try:
                shutil.rmtree(directory)
            except OSError:
                pass


def cleanup_item_files(item_id, municipality_slug):
    """Delete all files for a marketplace item."""
    import shutil
    
    subcategory = f"item_{item_id}"
    directory = get_file_path('marketplace', municipality_slug, subcategory)
    
    if os.path.exists(directory):
        try:
            shutil.rmtree(directory)
        except OSError:
            pass

