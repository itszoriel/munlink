"""
MunLink Zambales - Admin Routes
Admin-specific operations with municipality scoping

SCOPE: Zambales province only, excluding Olongapo City.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, verify_jwt_in_request
from sqlalchemy import func, and_, or_, case
from datetime import datetime, timedelta
import os
import jwt
from __init__ import db
from models.user import User
from models.municipality import Municipality, Barangay
from models.issue import Issue, IssueCategory
from models.marketplace import Item as MarketplaceItem
from models.marketplace import Transaction as MarketplaceTransaction
from models.marketplace import TransactionAuditLog as MarketplaceTransactionAuditLog
from models.benefit import BenefitProgram
from models.benefit import BenefitApplication
from models.document import DocumentRequest, DocumentType
from models.announcement import Announcement
from models.transfer import TransferRequest
from utils.storage_handler import save_announcement_image, save_verification_document
from utils.validators import ValidationError
from utils.email_sender import send_user_status_email
from models.audit import AuditLog
from utils.audit import log_action as log_generic_action
from utils.admin_audit import (
    log_resident_verified,
    log_resident_rejected,
)
from utils.notifications import queue_document_status_change, queue_announcement_notifications, queue_benefit_program_notifications
from utils.qr_utils import (
    generate_pickup_code,
    hash_code,
    verify_code,
    sign_claim_token,
    build_qr_png,
    masked,
    encrypt_code,
    get_municipality_slug,
)
from utils.zambales_scope import (
    ZAMBALES_MUNICIPALITY_IDS,
    is_valid_zambales_municipality,
    validate_municipality_in_zambales,
    validate_shared_municipalities,
)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')
ADMIN_ROLES = ('superadmin', 'provincial_admin', 'municipal_admin', 'barangay_admin')
ANNOUNCEMENT_SCOPES = {'PROVINCE', 'MUNICIPALITY', 'BARANGAY'}
ANNOUNCEMENT_STATUSES = {'DRAFT', 'PUBLISHED', 'ARCHIVED'}

@admin_bp.before_request
def enforce_admin_role():
    """Middleware: require JWT and admin role for all /api/admin routes.
    Skips OPTIONS preflight requests to allow CORS to work properly.
    
    Security: This middleware MUST return an error response if authentication
    fails. Silently passing would allow unauthenticated access.
    """
    from flask_jwt_extended.exceptions import NoAuthorizationError, InvalidHeaderError
    from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
    
    # Skip JWT verification for OPTIONS requests (CORS preflight)
    if request.method == 'OPTIONS':
        return None
    
    try:
        verify_jwt_in_request()
        claims = get_jwt() or {}
        role = claims.get('role')
        if role not in ADMIN_ROLES:
            current_app.logger.warning(f"Admin access denied: role={role}")
            return jsonify({'error': 'Forbidden', 'code': 'ROLE_MISMATCH'}), 403
    except NoAuthorizationError:
        # No token provided
        return jsonify({'error': 'Authorization required', 'code': 'NO_AUTH'}), 401
    except InvalidHeaderError as e:
        # Invalid Authorization header format
        current_app.logger.warning(f"Invalid auth header: {e}")
        return jsonify({'error': 'Invalid authorization header', 'code': 'INVALID_HEADER'}), 401
    except ExpiredSignatureError:
        # Token has expired
        return jsonify({'error': 'Token has expired', 'code': 'TOKEN_EXPIRED'}), 401
    except InvalidTokenError as e:
        # Token is invalid (malformed, wrong signature, etc.)
        current_app.logger.warning(f"Invalid token: {e}")
        return jsonify({'error': 'Invalid token', 'code': 'INVALID_TOKEN'}), 401
    except Exception as e:
        # Catch-all for any other auth errors - DO NOT silently pass
        current_app.logger.error(f"Unexpected auth error in admin middleware: {type(e).__name__}: {e}")
        return jsonify({'error': 'Authentication failed', 'code': 'AUTH_ERROR'}), 401

def get_admin_municipality_id():
    """Get the municipality ID for the current admin user.
    
    ZAMBALES SCOPE: Returns None if admin's municipality is outside Zambales
    or is Olongapo (excluded).
    """
    # get_jwt_identity returns whatever was used as identity when creating
    # the token. We cast to int for DB lookup.
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        print(f"DEBUG: Invalid JWT identity: {identity}")
        return None
    print(f"DEBUG: JWT identity: {user_id}")  # Debug line
    user = User.query.get(user_id)
    print(f"DEBUG: User found: {user.username if user else 'None'}, Role: {user.role if user else 'None'}")  # Debug line

    if not user or user.role not in ADMIN_ROLES:
        print(f"DEBUG: User validation failed - user: {user}, role: {user.role if user else 'None'}")  # Debug line
        return None

    admin_muni_id = user.admin_municipality_id
    print(f"DEBUG: Admin municipality ID: {admin_muni_id}")  # Debug line

    # ZAMBALES SCOPE: Validate admin's municipality is in Zambales (excluding Olongapo)
    if admin_muni_id and not is_valid_zambales_municipality(admin_muni_id):
        print(f"DEBUG: Admin municipality {admin_muni_id} is outside Zambales scope")
        return None
    return admin_muni_id

def require_admin_municipality():
    """Decorator to ensure admin has municipality scope."""
    municipality_id = get_admin_municipality_id()
    if not municipality_id:
        return jsonify({'error': 'Admin access required'}), 403
    return municipality_id


def _get_staff_context():
    """Return the current admin user and scoped identifiers."""
    try:
        user_id = int(get_jwt_identity())
    except Exception:
        return None
    user = User.query.get(user_id)
    if not user:
        return None
    role_lower = (user.role or '').lower()
    ctx = {
        'user': user,
        'role': user.role,
        'role_lower': role_lower,
        'is_super': role_lower == 'superadmin',
        'is_provincial': role_lower == 'provincial_admin',
        'municipality_id': user.admin_municipality_id if user.admin_municipality_id and is_valid_zambales_municipality(user.admin_municipality_id) else None,
        'barangay_id': user.admin_barangay_id,
    }
    if ctx['barangay_id']:
        brgy = Barangay.query.get(ctx['barangay_id'])
        if not brgy or not is_valid_zambales_municipality(brgy.municipality_id):
            ctx['barangay_id'] = None
        elif ctx['municipality_id'] and brgy.municipality_id != ctx['municipality_id']:
            ctx['barangay_id'] = None
    return ctx


def _parse_datetime(value, field_name):
    if value in (None, '', False):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value)
    except Exception:
        raise ValidationError(f'Invalid {field_name} datetime format')


def _normalize_scope(scope_value: str) -> str:
    scope = (scope_value or 'MUNICIPALITY').upper()
    if scope not in ANNOUNCEMENT_SCOPES:
        raise ValidationError('Invalid scope for announcement')
    return scope


def _normalize_status(status_value: str = None, is_active_value: bool = None) -> str:
    if status_value:
        status = status_value.upper()
    elif is_active_value is not None:
        status = 'PUBLISHED' if is_active_value else 'DRAFT'
    else:
        status = 'PUBLISHED'
    if status not in ANNOUNCEMENT_STATUSES:
        raise ValidationError('Invalid status for announcement')
    return status


def _validate_target_location(scope: str, municipality_id: int = None, barangay_id: int = None):
    """Normalize and validate target location within Zambales."""
    if scope == 'PROVINCE':
        return None, None
    if scope == 'MUNICIPALITY':
        if not municipality_id:
            raise ValidationError('municipality_id is required for municipality-scoped announcements')
        validate_municipality_in_zambales(municipality_id)
        return municipality_id, None
    if scope == 'BARANGAY':
        if not barangay_id:
            raise ValidationError('barangay_id is required for barangay-scoped announcements')
        brgy = Barangay.query.get(barangay_id)
        if not brgy or not is_valid_zambales_municipality(brgy.municipality_id):
            raise ValidationError('Barangay must be within Zambales')
        if municipality_id and municipality_id != brgy.municipality_id:
            raise ValidationError('Barangay must belong to the specified municipality')
        return brgy.municipality_id, brgy.id
    raise ValidationError('Invalid scope for announcement')


def _enforce_scope_permission(ctx, scope: str, municipality_id: int, barangay_id: int):
    """Return (allowed: bool, response_if_denied)."""
    if not ctx:
        return False, (jsonify({'error': 'Admin access required'}), 403)

    # Superadmin can create any type of announcement
    if ctx['is_super']:
        return True, None

    # Provincial admin can create province-wide announcements only
    if ctx['is_provincial']:
        if scope != 'PROVINCE':
            return False, (jsonify({'error': 'Provincial admins can only create province-wide announcements'}), 403)
        return True, None

    # Non-provincial admins cannot create province-wide announcements
    if scope == 'PROVINCE':
        return False, (jsonify({'error': 'Only provincial admins can create province-wide announcements'}), 403)

    # Municipal admin can create municipality announcements only
    if ctx['role_lower'] == 'municipal_admin':
        if not ctx['municipality_id']:
            return False, (jsonify({'error': 'Admin municipality scope is required'}), 403)
        if municipality_id != ctx['municipality_id']:
            return False, (jsonify({'error': 'Announcement not in your municipality'}), 403)
        if scope != 'MUNICIPALITY':
            return False, (jsonify({'error': 'Municipal admins can only post municipality announcements'}), 403)
        return True, None

    # Barangay admin can create barangay announcements only
    if ctx['role_lower'] == 'barangay_admin':
        if not ctx['barangay_id']:
            return False, (jsonify({'error': 'Barangay assignment is required for this action'}), 403)
        if scope != 'BARANGAY' or barangay_id != ctx['barangay_id']:
            return False, (jsonify({'error': 'Barangay admins can only post to their assigned barangay'}), 403)
        return True, None

    return False, (jsonify({'error': 'Forbidden'}), 403)


def _announcement_query_for_staff(ctx):
    """Base query filtered to Zambales scope and staff permissions."""
    base_filters = [or_(Announcement.scope == 'PROVINCE', Announcement.municipality_id.in_(ZAMBALES_MUNICIPALITY_IDS))]
    q = Announcement.query.filter(and_(*base_filters))

    # Superadmin can see all announcements
    if not ctx or ctx.get('is_super'):
        return q

    # Provincial admin can see province-wide announcements only
    if ctx.get('is_provincial'):
        return q.filter(Announcement.scope == 'PROVINCE')

    # Municipal admin can see municipality and barangay announcements in their municipality
    if ctx['role_lower'] == 'municipal_admin':
        if not ctx['municipality_id']:
            return Announcement.query.filter(Announcement.id == -1)
        return q.filter(
            or_(
                and_(Announcement.scope == 'MUNICIPALITY', Announcement.municipality_id == ctx['municipality_id']),
                and_(Announcement.scope == 'BARANGAY', Announcement.municipality_id == ctx['municipality_id']),
            )
        )

    # Barangay admin can see barangay announcements in their barangay only
    if ctx['role_lower'] == 'barangay_admin':
        if not ctx['barangay_id']:
            return Announcement.query.filter(Announcement.id == -1)
        return q.filter(and_(Announcement.scope == 'BARANGAY', Announcement.barangay_id == ctx['barangay_id']))

    return Announcement.query.filter(Announcement.id == -1)

# User Verification Endpoints
@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_detail(user_id):
    """Get a single user's details for admin review, including verification files."""
    try:
        municipality_id = get_admin_municipality_id()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        # If admin has municipality scope, enforce it, but allow access
        # when there is an active transfer (pending/approved) that involves
        # the admin's municipality as source or destination.
        if municipality_id and user.municipality_id != municipality_id and user.role != 'municipal_admin':
            try:
                from models.transfer import TransferRequest
            except ImportError:
                from models.transfer import TransferRequest
            active_transfer = TransferRequest.query.filter(
                and_(
                    TransferRequest.user_id == user.id,
                    TransferRequest.status.in_(['pending', 'approved']),
                    or_(
                        TransferRequest.from_municipality_id == municipality_id,
                        TransferRequest.to_municipality_id == municipality_id,
                    ),
                )
            ).first()
            if not active_transfer:
                return jsonify({'error': 'User not in your municipality'}), 403
        return jsonify(user.to_dict(include_sensitive=True, include_municipality=True)), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get user detail', 'details': str(e)}), 500
@admin_bp.route('/users/pending', methods=['GET'])
@jwt_required()
def get_pending_users():
    """Get unverified users for admin's municipality.
    
    ZAMBALES SCOPE: Only returns users from Zambales municipalities (excluding Olongapo).
    """
    try:
        municipality_id = get_admin_municipality_id()
        # ZAMBALES SCOPE: Always filter to Zambales municipalities only
        filters = [
            User.role == 'resident',
            User.admin_verified == False,
            User.is_active == True,
            User.municipality_id.in_(ZAMBALES_MUNICIPALITY_IDS),  # Zambales scope
        ]
        if municipality_id:
            filters.append(User.municipality_id == municipality_id)

        pending_users = (
            User.query
            .filter(and_(*filters))
            .order_by(User.created_at.desc())
            .all()
        )

        users_data = [u.to_dict(include_sensitive=True, include_municipality=True) for u in pending_users]
        return jsonify({'users': users_data, 'count': len(users_data)}), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get pending users', 'details': str(e)}), 500

@admin_bp.route('/users/<int:user_id>/verify', methods=['POST'])
@jwt_required()
def verify_user(user_id):
    """Approve user verification."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        # Only municipal admins may verify residents
        if ctx.get('role_lower') != 'municipal_admin':
            return jsonify({'error': 'Only municipal admins can verify residents', 'code': 'ROLE_MISMATCH'}), 403

        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id

        current_admin = User.query.get(get_jwt_identity())
        if not current_admin or not current_admin.has_permission('residents:approve'):
            return jsonify({'error': 'Permission denied: residents:approve required', 'code': 'PERMISSION_DENIED'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if user.municipality_id != municipality_id:
            return jsonify({'error': 'User not in your municipality'}), 403
        
        if user.role != 'resident':
            return jsonify({'error': 'User is not a resident'}), 400
        
        # Approve the user
        user.admin_verified = True
        user.admin_verified_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
        
        db.session.commit()

        # Send approval email (best-effort)
        try:
            if user.email:
                send_user_status_email(user.email, approved=True)
        except Exception:
            pass

        # Audit log (best-effort)
        try:
            log_resident_verified(
                admin_id=current_admin.id if current_admin else None,
                resident_id=user.id,
                resident_name=f"{user.first_name} {user.last_name}",
                municipality_id=user.municipality_id,
                barangay_id=user.barangay_id,
            )
        except Exception:
            pass
        
        return jsonify({
            'message': 'User verified successfully',
            'user': user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to verify user', 'details': str(e)}), 500

@admin_bp.route('/users/<int:user_id>/reject', methods=['POST'])
@jwt_required()
def reject_user(user_id):
    """Reject user verification."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        if ctx.get('role_lower') != 'municipal_admin':
            return jsonify({'error': 'Only municipal admins can reject residents', 'code': 'ROLE_MISMATCH'}), 403

        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id

        current_admin = User.query.get(get_jwt_identity())
        if not current_admin or not current_admin.has_permission('residents:approve'):
            return jsonify({'error': 'Permission denied: residents:approve required', 'code': 'PERMISSION_DENIED'}), 403
        
        data = request.get_json(silent=True) or {}
        reason = (data.get('reason') or '').strip()
        if not reason:
            return jsonify({'error': 'Reason is required to reject a user'}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if user.municipality_id != municipality_id:
            return jsonify({'error': 'User not in your municipality'}), 403
        
        if user.role != 'resident':
            return jsonify({'error': 'User is not a resident'}), 400
        
        # Reject the user (deactivate)
        user.is_active = False
        user.updated_at = datetime.utcnow()
        
        db.session.commit()

        # Send rejection email (best-effort)
        try:
            if user.email:
                send_user_status_email(user.email, approved=False, reason=reason)
        except Exception:
            pass

        # Audit log (best-effort)
        try:
            log_resident_rejected(
                admin_id=current_admin.id if current_admin else None,
                resident_id=user.id,
                resident_name=f"{user.first_name} {user.last_name}",
                reason=reason
            )
        except Exception:
            pass
        
        return jsonify({
            'message': 'User rejected successfully',
            'reason': reason
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to reject user', 'details': str(e)}), 500

@admin_bp.route('/users/<int:user_id>/suspend', methods=['POST'])
@jwt_required()
def suspend_user(user_id: int):
    """Toggle suspend/unsuspend a resident in the admin's municipality."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if user.role != 'resident':
            return jsonify({'error': 'User is not a resident'}), 400
        if user.municipality_id != municipality_id:
            return jsonify({'error': 'User not in your municipality'}), 403

        user.is_active = not bool(user.is_active)
        user.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': 'User status updated', 'user': user.to_dict(include_sensitive=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user status', 'details': str(e)}), 500

@admin_bp.route('/users/<int:user_id>/verification-docs', methods=['POST'])
@jwt_required()
def admin_upload_user_verification_docs(user_id: int):
    """Allow admin to re-upload verification documents for a user."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.municipality_id != municipality_id:
            return jsonify({'error': 'User not in your municipality'}), 403

        if not (request.content_type and 'multipart/form-data' in request.content_type):
            return jsonify({'error': 'Files must be uploaded as multipart/form-data'}), 400

        municipality = Municipality.query.get(municipality_id)
        municipality_slug = municipality.slug if municipality else 'general'

        saved_any = False

        id_front = request.files.get('valid_id_front')
        if id_front and getattr(id_front, 'filename', ''):
            user.valid_id_front = save_verification_document(id_front, user.id, municipality_slug, 'valid_id_front', user_type='residents')
            saved_any = True

        id_back = request.files.get('valid_id_back')
        if id_back and getattr(id_back, 'filename', ''):
            user.valid_id_back = save_verification_document(id_back, user.id, municipality_slug, 'valid_id_back', user_type='residents')
            saved_any = True

        selfie = request.files.get('selfie_with_id')
        if selfie and getattr(selfie, 'filename', ''):
            user.selfie_with_id = save_verification_document(selfie, user.id, municipality_slug, 'selfie_with_id', user_type='residents')
            saved_any = True

        if not saved_any:
            return jsonify({'error': 'Please upload at least one verification file'}), 400

        user.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Verification documents updated successfully',
            'user': user.to_dict(include_sensitive=True, include_municipality=True)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload verification documents', 'details': str(e)}), 500


@admin_bp.route('/residents/<int:user_id>/documents/<string:doc_type>', methods=['GET'])
@jwt_required()
def get_resident_document(user_id, doc_type):
    """
    Securely serve resident verification documents.

    Requires:
    - Admin authentication
    - residents:id_view permission
    - Municipality scope match
    - Audit logging

    Query params:
    - reason (required): Why the admin is viewing this document
    """
    from flask import send_file
    from utils.auth import permission_required
    from utils.admin_audit import log_resident_id_viewed
    from models.municipality import Municipality
    import os
    import traceback

    try:
        # Check permission first
        user_id_jwt = get_jwt_identity()
        current_user = User.query.get(user_id_jwt)

        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        if not current_user.has_permission('residents:id_view'):
            return jsonify({
                'error': 'Permission denied: residents:id_view required',
                'code': 'PERMISSION_DENIED'
            }), 403

        # Validate doc_type
        valid_types = ['id_front', 'id_back', 'selfie']
        if doc_type not in valid_types:
            return jsonify({'error': f'Invalid document type. Must be one of: {valid_types}'}), 400

        # Require reason
        reason = request.args.get('reason', '').strip()
        if not reason:
            return jsonify({'error': 'Reason parameter required'}), 400

        # Get admin context (allow None for superadmins)
        admin_municipality_id = get_admin_municipality_id()

        # Get resident
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.role != 'resident':
            return jsonify({'error': 'User is not a resident'}), 400

        # Validate municipality scope (unless superadmin)
        if current_user.role != 'superadmin':
            if not admin_municipality_id:
                return jsonify({'error': 'Admin access required'}), 403
            if user.municipality_id != admin_municipality_id:
                return jsonify({'error': 'Access denied: user not in your municipality'}), 403

        # Get file path
        doc_field_map = {
            'id_front': 'valid_id_front',
            'id_back': 'valid_id_back',
            'selfie': 'selfie_with_id'
        }
        file_path = getattr(user, doc_field_map[doc_type], None)

        if not file_path:
            return jsonify({'error': f'No {doc_type} document found for this user'}), 404

        # Log access to audit trail
        municipality = Municipality.query.get(user.municipality_id)
        log_resident_id_viewed(
            admin_id=current_user.id,
            admin_email=current_user.email,
            resident_id=user.id,
            resident_name=f"{user.first_name} {user.last_name}",
            document_type=doc_type,
            reason=reason,
            municipality_id=user.municipality_id,
            municipality_name=municipality.name if municipality else 'Unknown',
            req=request
        )

        # Serve file
        # If Supabase URL, fetch it server-side and return bytes (no redirect to avoid CORS)
        if file_path.startswith(('http://', 'https://')):
            from urllib.parse import urlparse
            import requests
            from io import BytesIO

            # Validate URL domain against allowed storage providers
            parsed = urlparse(file_path)
            allowed_domains = current_app.config.get('ALLOWED_FILE_DOMAINS', [])

            if allowed_domains and parsed.netloc not in allowed_domains:
                current_app.logger.warning(f"Blocked access to untrusted domain: {parsed.netloc}")
                return jsonify({'error': 'Invalid file URL'}), 403

            # Fetch image from Supabase server-side
            try:
                response = requests.get(file_path, timeout=10)
                response.raise_for_status()

                # Determine MIME type from response or file extension
                content_type = response.headers.get('Content-Type', 'application/octet-stream')
                if content_type == 'application/octet-stream':
                    # Fallback to extension-based MIME type
                    ext = file_path.split('.')[-1].lower().split('?')[0]  # Remove query params
                    mime_types = {
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'gif': 'image/gif',
                        'webp': 'image/webp'
                    }
                    content_type = mime_types.get(ext, 'application/octet-stream')

                # Return image bytes directly
                return send_file(
                    BytesIO(response.content),
                    mimetype=content_type,
                    as_attachment=False,
                    download_name=f"{doc_type}.{ext}" if 'ext' in locals() else f"{doc_type}.jpg"
                )

            except requests.RequestException as e:
                current_app.logger.error(f"Failed to fetch image from Supabase: {str(e)}")
                return jsonify({'error': 'Failed to fetch image from storage'}), 502

        # If local file, serve it
        upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        upload_dir_abs = os.path.abspath(upload_dir)
        full_path = os.path.abspath(os.path.join(upload_dir, file_path))

        # Validate path is within upload directory (prevent path traversal)
        if not full_path.startswith(upload_dir_abs + os.sep):
            current_app.logger.warning(f"Path traversal attempt detected: {file_path}")
            return jsonify({'error': 'Invalid file path'}), 403

        if not os.path.exists(full_path):
            return jsonify({'error': 'File not found on server'}), 404

        # Determine MIME type
        mime_types = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }
        ext = file_path.split('.')[-1].lower()
        mime_type = mime_types.get(ext, 'application/octet-stream')

        return send_file(full_path, mimetype=mime_type)

    except Exception as e:
        # Log the full error for debugging
        current_app.logger.error(f"Error serving document for user {user_id}: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Internal server error while fetching document',
            'details': str(e) if current_app.config.get('DEBUG') else 'An error occurred'
        }), 500


@admin_bp.route('/users/verified', methods=['GET'])
@jwt_required()
def get_verified_users():
    """Get verified users list."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        verified_users = User.query.filter(
            and_(
                User.municipality_id == municipality_id,
                User.role == 'resident',
                User.admin_verified == True,
                User.is_active == True
            )
        ).order_by(User.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        users_data = []
        for user in verified_users.items:
            # Include municipality info so the admin UI can client-side scope by municipality
            user_data = user.to_dict(include_sensitive=True, include_municipality=True)
            users_data.append(user_data)
        
        return jsonify({
            'users': users_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': verified_users.total,
                'pages': verified_users.pages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get verified users', 'details': str(e)}), 500

@admin_bp.route('/users/stats', methods=['GET'])
@jwt_required()
def get_user_stats():
    """Get user statistics for dashboard."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        # Count users by status
        total_users = User.query.filter(
            and_(
                User.municipality_id == municipality_id,
                User.role == 'resident'
            )
        ).count()
        
        pending_users = User.query.filter(
            and_(
                User.municipality_id == municipality_id,
                User.role == 'resident',
                User.admin_verified == False,
                User.is_active == True
            )
        ).count()
        
        verified_users = User.query.filter(
            and_(
                User.municipality_id == municipality_id,
                User.role == 'resident',
                User.admin_verified == True,
                User.is_active == True
            )
        ).count()
        
        # Recent registrations (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_registrations = User.query.filter(
            and_(
                User.municipality_id == municipality_id,
                User.role == 'resident',
                User.created_at >= week_ago
            )
        ).count()
        
        return jsonify({
            'total_users': total_users,
            'pending_verifications': pending_users,
            'verified_users': verified_users,
            'recent_registrations': recent_registrations
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get user statistics', 'details': str(e)}), 500

@admin_bp.route('/users/growth', methods=['GET'])
@jwt_required()
def get_user_growth():
    """Return user registrations per day for a given range (last_7_days, last_30_days, last_90_days, this_year)."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        range_param = request.args.get('range', 'last_30_days')
        start, end = _parse_range(range_param)

        # Detect database type and use appropriate date formatting function
        db_url = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
        is_postgresql = db_url.startswith('postgresql://') or db_url.startswith('postgres://')
        
        if is_postgresql:
            # PostgreSQL: use TO_CHAR for date formatting
            day_expr = func.to_char(User.created_at, 'YYYY-MM-DD').label('day')
        else:
            # SQLite: use strftime
            day_expr = func.strftime('%Y-%m-%d', User.created_at).label('day')

        rows = (
            db.session.query(
                day_expr,
                func.count(User.id)
            )
            .filter(and_(
                User.municipality_id == municipality_id,
                User.role == 'resident',
                User.created_at >= start,
                User.created_at <= end,
            ))
            .group_by('day')
            .order_by('day')
            .all()
        )
        counts = {d: int(c) for d, c in rows}
        # Build full series inclusive of dates in range
        days = []
        cur = start
        while cur.date() <= end.date():
            day = cur.strftime('%Y-%m-%d')
            days.append({'day': day, 'count': counts.get(day, 0)})
            cur += timedelta(days=1)

        return jsonify({'series': days, 'range': range_param}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get user growth', 'details': str(e)}), 500

# Issue Management Endpoints
@admin_bp.route('/issues', methods=['GET'])
@jwt_required()
def get_issues():
    """Get all issues for municipality with filters."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        try:
            # Get filter parameters
            status = request.args.get('status')
            category = request.args.get('category')
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 20, type=int)
            
            # Build query
            query = Issue.query.filter(Issue.municipality_id == municipality_id)
            
            if status:
                # Map UI aliases to model statuses
                normalized = status
                if status == 'pending':
                    normalized = 'submitted'
                query = query.filter(Issue.status == normalized)
            
            if category:
                # Accept id or slug/name
                try:
                    cat_id = int(category)
                    query = query.filter(Issue.category_id == cat_id)
                except (TypeError, ValueError):
                    cat = IssueCategory.query.filter(
                        or_(IssueCategory.slug == category, IssueCategory.name == category)
                    ).first()
                    if cat:
                        query = query.filter(Issue.category_id == cat.id)
            
            issues = query.order_by(Issue.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            issues_data = []
            for issue in issues.items:
                issue_data = issue.to_dict(include_user=True)
                try:
                    issue_data['municipality_name'] = issue.municipality.name if issue.municipality else None
                except Exception:
                    issue_data['municipality_name'] = None
                issues_data.append(issue_data)
            
            return jsonify({
                'issues': issues_data,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': issues.total,
                    'pages': issues.pages
                }
            }), 200
        except Exception as model_error:
            # If no issues or model error, return empty list
            return jsonify({
                'issues': [],
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': 0,
                    'pages': 0
                },
                'message': 'No issues found'
            }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get issues', 'details': str(e)}), 500

@admin_bp.route('/issues/<int:issue_id>', methods=['GET'])
@jwt_required()
def get_issue(issue_id):
    """Get issue details."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({'error': 'Issue not found'}), 404
        
        if issue.municipality_id != municipality_id:
            return jsonify({'error': 'Issue not in your municipality'}), 403
        
        data = issue.to_dict(include_user=True)
        try:
            data['municipality_name'] = issue.municipality.name if issue.municipality else None
        except Exception:
            data['municipality_name'] = None
        return jsonify(data), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get issue', 'details': str(e)}), 500

@admin_bp.route('/issues/<int:issue_id>/status', methods=['PUT'])
@jwt_required()
def update_issue_status(issue_id):
    """Update issue status."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        data = request.get_json()
        new_status = (data.get('status') or '').lower()
        # Map UI alias
        if new_status == 'pending':
            new_status = 'submitted'
        
        if new_status not in ['submitted', 'under_review', 'in_progress', 'resolved', 'closed', 'rejected']:
            return jsonify({'error': 'Invalid status'}), 400
        
        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({'error': 'Issue not found'}), 404
        
        if issue.municipality_id != municipality_id:
            return jsonify({'error': 'Issue not in your municipality'}), 403
        # Guard transitions
        current = (issue.status or 'submitted').lower()
        allowed = {
            'submitted': {'under_review', 'in_progress', 'rejected'},
            'under_review': {'in_progress', 'resolved', 'rejected'},
            'in_progress': {'resolved', 'rejected'},
            'resolved': {'closed'},
            'closed': set(),
            'rejected': set(),
        }
        if new_status not in allowed.get(current, set()):
            return jsonify({'error': f'Invalid transition from {current} to {new_status}'}), 400

        issue.status = new_status
        issue.status_updated_by = get_jwt_identity()
        now = datetime.utcnow()
        issue.status_updated_at = now
        issue.updated_at = now
        if new_status == 'under_review' and not issue.reviewed_at:
            issue.reviewed_at = now
        if new_status == 'resolved' and not issue.resolved_at:
            issue.resolved_at = now
        
        db.session.commit()
        
        return jsonify({
            'message': 'Issue status updated successfully',
            'issue': issue.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update issue status', 'details': str(e)}), 500

@admin_bp.route('/issues/<int:issue_id>/response', methods=['POST'])
@jwt_required()
def add_issue_response(issue_id):
    """Add admin response to issue."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        data = request.get_json()
        response_text = data.get('response')
        
        if not response_text:
            return jsonify({'error': 'Response text is required'}), 400
        
        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({'error': 'Issue not found'}), 404
        
        if issue.municipality_id != municipality_id:
            return jsonify({'error': 'Issue not in your municipality'}), 403
        
        # Add admin response
        issue.admin_response = response_text
        issue.admin_response_by = get_jwt_identity()
        issue.admin_response_at = datetime.utcnow()
        issue.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Response added successfully',
            'issue': issue.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add response', 'details': str(e)}), 500

@admin_bp.route('/issues/stats', methods=['GET'])
@jwt_required()
def get_issue_stats():
    """Get issue statistics."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        # Count issues by status
        total_issues = Issue.query.filter(Issue.municipality_id == municipality_id).count()
        
        pending_issues = Issue.query.filter(
            and_(
                Issue.municipality_id == municipality_id,
                Issue.status == 'pending'
            )
        ).count()
        
        active_issues = Issue.query.filter(
            and_(
                Issue.municipality_id == municipality_id,
                Issue.status == 'in_progress'
            )
        ).count()
        
        resolved_issues = Issue.query.filter(
            and_(
                Issue.municipality_id == municipality_id,
                Issue.status == 'resolved'
            )
        ).count()
        
        return jsonify({
            'total_issues': total_issues,
            'pending_issues': pending_issues,
            'active_issues': active_issues,
            'resolved_issues': resolved_issues
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get issue statistics', 'details': str(e)}), 500

# Marketplace Moderation Endpoints
@admin_bp.route('/marketplace/pending', methods=['GET'])
@jwt_required()
def get_pending_marketplace_items():
    """Get pending marketplace items for moderation."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        try:
            # Get pending marketplace items for this municipality
            pending_items = MarketplaceItem.query.filter(
                and_(
                    MarketplaceItem.municipality_id == municipality_id,
                    MarketplaceItem.status == 'pending',
                    MarketplaceItem.is_active == True
                )
            ).order_by(MarketplaceItem.created_at.desc()).all()
            
            items_data = []
            for item in pending_items:
                item_data = item.to_dict(include_user=True)
                items_data.append(item_data)
            
            return jsonify({
                'items': items_data,
                'count': len(items_data)
            }), 200
        except Exception as model_error:
            # If no items or model error, return empty list
            return jsonify({
                'items': [],
                'count': 0,
                'message': 'No pending marketplace items found'
            }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get pending marketplace items', 'details': str(e)}), 500

@admin_bp.route('/marketplace/<int:item_id>/approve', methods=['POST'])
@jwt_required()
def approve_marketplace_item(item_id):
    """Approve marketplace item."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return jsonify({'error': 'Marketplace item not found'}), 404
        
        if item.municipality_id != municipality_id:
            return jsonify({'error': 'Item not in your municipality'}), 403
        
        # Approve the item (make it available to residents)
        item.status = 'available'
        item.approved_by = get_jwt_identity()
        item.approved_at = datetime.utcnow()
        item.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Marketplace item approved successfully',
            'item': item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to approve marketplace item', 'details': str(e)}), 500

@admin_bp.route('/marketplace/<int:item_id>/reject', methods=['POST'])
@jwt_required()
def reject_marketplace_item(item_id):
    """Reject marketplace item."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        data = request.get_json() or {}
        reason = (data.get('reason') or '').strip()
        if not reason:
            return jsonify({'error': 'Reason is required to reject a marketplace item'}), 400
        
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return jsonify({'error': 'Marketplace item not found'}), 404
        
        if item.municipality_id != municipality_id:
            return jsonify({'error': 'Item not in your municipality'}), 403
        
        # Reject the item
        item.status = 'rejected'
        item.rejection_reason = reason
        item.rejected_by = get_jwt_identity()
        item.rejected_at = datetime.utcnow()
        item.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Marketplace item rejected successfully',
            'reason': reason
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to reject marketplace item', 'details': str(e)}), 500

@admin_bp.route('/marketplace/stats', methods=['GET'])
@jwt_required()
def get_marketplace_stats():
    """Get marketplace statistics."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        
        # Count marketplace items by status
        total_items = MarketplaceItem.query.filter(
            and_(
                MarketplaceItem.municipality_id == municipality_id,
                MarketplaceItem.is_active == True
            )
        ).count()
        
        pending_items = MarketplaceItem.query.filter(
            and_(
                MarketplaceItem.municipality_id == municipality_id,
                MarketplaceItem.status == 'pending',
                MarketplaceItem.is_active == True
            )
        ).count()
        
        approved_items = MarketplaceItem.query.filter(
            and_(
                MarketplaceItem.municipality_id == municipality_id,
                MarketplaceItem.status == 'available',
                MarketplaceItem.is_active == True
            )
        ).count()
        
        rejected_items = MarketplaceItem.query.filter(
            and_(
                MarketplaceItem.municipality_id == municipality_id,
                MarketplaceItem.status == 'rejected',
                MarketplaceItem.is_active == True
            )
        ).count()
        
        return jsonify({
            'total_items': total_items,
            'pending_items': pending_items,
            'approved_items': approved_items,
            'rejected_items': rejected_items
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get marketplace statistics', 'details': str(e)}), 500

# Announcements Management Endpoints
@admin_bp.route('/announcements', methods=['GET'])
@jwt_required()
def get_announcements():
    """Get all announcements for municipality."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403

        now = datetime.utcnow()
        status_param = request.args.get('status')
        scope_param = request.args.get('scope')

        query = _announcement_query_for_staff(ctx)
        if scope_param:
            scope = _normalize_scope(scope_param)
            query = query.filter(Announcement.scope == scope)
        if status_param:
            status = _normalize_status(status_param)
            query = query.filter(Announcement.status == status)

        pinned_active = and_(
            Announcement.pinned == True,
            or_(Announcement.pinned_until == None, Announcement.pinned_until > now)
        )
        publish_order = func.coalesce(Announcement.publish_at, Announcement.created_at)

        announcements = query.order_by(
            case((pinned_active, 0), else_=1),
            publish_order.desc(),
            Announcement.created_at.desc(),
        ).all()

        announcements_data = [a.to_dict() for a in announcements]

        return jsonify({
            'announcements': announcements_data,
            'count': len(announcements_data)
        }), 200

    except Exception as e:
        return jsonify({'error': 'Failed to get announcements', 'details': str(e)}), 500

@admin_bp.route('/announcements', methods=['POST'])
@jwt_required()
def create_announcement():
    """Create new announcement."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403

        # Handle both JSON and FormData (for image uploads)
        is_multipart = request.content_type and 'multipart/form-data' in request.content_type
        if is_multipart:
            data = request.form.to_dict()
            # Convert string booleans to actual booleans for FormData
            if 'pinned' in data:
                data['pinned'] = data['pinned'].lower() in ('true', '1', 'yes')
        else:
            data = request.get_json() or {}

        title = (data.get('title') or '').strip()
        content = (data.get('content') or '').strip()
        priority = data.get('priority', 'medium')
        external_url = data.get('external_url')
        scope = _normalize_scope(data.get('scope'))
        municipality_id = data.get('municipality_id')
        barangay_id = data.get('barangay_id')
        status = _normalize_status(data.get('status'), data.get('is_active'))
        publish_at = _parse_datetime(data.get('publish_at'), 'publish_at')
        expire_at = _parse_datetime(data.get('expire_at'), 'expire_at')
        pinned = bool(data.get('pinned', False))
        pinned_until = _parse_datetime(data.get('pinned_until'), 'pinned_until')
        shared_with_municipalities = data.get('shared_with_municipalities', [])

        if not title or not content:
            return jsonify({'error': 'Title and content are required'}), 400

        if priority not in ['high', 'medium', 'low']:
            return jsonify({'error': 'Invalid priority level'}), 400

        # Validate shared municipalities (Zambales-only enforcement)
        if shared_with_municipalities:
            try:
                validate_shared_municipalities(shared_with_municipalities, raise_error=True)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400

        if scope == 'MUNICIPALITY' and not municipality_id:
            municipality_id = ctx.get('municipality_id')
        if scope == 'BARANGAY':
            if not barangay_id:
                barangay_id = ctx.get('barangay_id')
            if not municipality_id:
                municipality_id = ctx.get('municipality_id')

        municipality_id, barangay_id = _validate_target_location(scope, municipality_id, barangay_id)
        allowed, denial = _enforce_scope_permission(ctx, scope, municipality_id, barangay_id)
        if not allowed:
            return denial

        now = datetime.utcnow()
        # Default publish_at for published announcements
        if status == 'PUBLISHED' and not publish_at:
            publish_at = now

        is_active_flag = status == 'PUBLISHED'
        if publish_at and publish_at > now:
            is_active_flag = False
        if expire_at and expire_at <= now:
            is_active_flag = False

        announcement = Announcement(
            title=title,
            content=content,
            scope=scope,
            municipality_id=municipality_id,
            barangay_id=barangay_id,
            created_by=ctx['user'].id,
            created_by_staff_id=ctx['user'].id,
            priority=priority,
            images=[],
            external_url=external_url,
            pinned=pinned,
            pinned_until=pinned_until,
            status=status,
            publish_at=publish_at,
            expire_at=expire_at,
            shared_with_municipalities=shared_with_municipalities if shared_with_municipalities else None,
            is_active=is_active_flag,
        )

        db.session.add(announcement)
        db.session.flush()  # Flush to get announcement ID before handling images

        # Handle image uploads if present (FormData only)
        if is_multipart and 'images' in request.files:
            image_files = request.files.getlist('images')
            saved_images = []
            for img_file in image_files:
                if img_file and img_file.filename:
                    try:
                        img_path = save_announcement_image(img_file)
                        saved_images.append(img_path)
                    except Exception as img_err:
                        current_app.logger.warning(f"Failed to save announcement image: {img_err}")
            if saved_images:
                announcement.images = saved_images

        db.session.commit()

        try:
            if status == 'PUBLISHED':
                queue_announcement_notifications(announcement)
                db.session.commit()
        except Exception as notify_exc:
            db.session.rollback()
            current_app.logger.warning("Failed to queue announcement notifications: %s", notify_exc)

        return jsonify({
            'message': 'Announcement created successfully',
            'announcement': announcement.to_dict()
        }), 201

    except ValidationError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create announcement', 'details': str(e)}), 500

@admin_bp.route('/announcements/<int:announcement_id>', methods=['PUT'])
@jwt_required()
def update_announcement(announcement_id):
    """Update announcement."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403

        # Handle both JSON and FormData (for image uploads)
        is_multipart = request.content_type and 'multipart/form-data' in request.content_type
        if is_multipart:
            data = request.form.to_dict()
            # Convert string booleans to actual booleans for FormData
            if 'pinned' in data:
                data['pinned'] = data['pinned'].lower() in ('true', '1', 'yes')
        else:
            data = request.get_json(silent=True) or {}

        announcement = Announcement.query.get(announcement_id)
        if not announcement:
            return jsonify({'error': 'Announcement not found'}), 404

        prev_status = (announcement.status or '').upper()
        prev_publish_at = announcement.publish_at

        scope = _normalize_scope(data.get('scope', announcement.scope))
        municipality_id = data.get('municipality_id', announcement.municipality_id)
        barangay_id = data.get('barangay_id', announcement.barangay_id)
        municipality_id, barangay_id = _validate_target_location(scope, municipality_id, barangay_id)
        allowed, denial = _enforce_scope_permission(ctx, scope, municipality_id, barangay_id)
        if not allowed:
            return denial

        now = datetime.utcnow()

        if 'title' in data:
            announcement.title = data['title']
        if 'content' in data:
            announcement.content = data['content']
        if 'priority' in data:
            if data['priority'] in ['high', 'medium', 'low']:
                announcement.priority = data['priority']
            else:
                return jsonify({'error': 'Invalid priority level'}), 400
        if 'external_url' in data:
            announcement.external_url = data['external_url']
        if 'images' in data and isinstance(data['images'], list):
            announcement.images = data['images']
        if 'pinned' in data:
            announcement.pinned = bool(data['pinned'])
        if 'pinned_until' in data:
            announcement.pinned_until = _parse_datetime(data.get('pinned_until'), 'pinned_until')
        if 'shared_with_municipalities' in data:
            shared_with_municipalities = data.get('shared_with_municipalities', [])
            # Validate shared municipalities (Zambales-only enforcement)
            try:
                validate_shared_municipalities(shared_with_municipalities, raise_error=True)
                announcement.shared_with_municipalities = shared_with_municipalities if shared_with_municipalities else None
            except ValueError as e:
                return jsonify({'error': str(e)}), 400

        publish_at = announcement.publish_at
        expire_at = announcement.expire_at
        if 'publish_at' in data:
            publish_at = _parse_datetime(data.get('publish_at'), 'publish_at')
        if 'expire_at' in data:
            expire_at = _parse_datetime(data.get('expire_at'), 'expire_at')

        status = _normalize_status(data.get('status', announcement.status), data.get('is_active') if 'is_active' in data else None)
        if status == 'PUBLISHED' and not publish_at:
            publish_at = now
        is_active_flag = status == 'PUBLISHED'
        if publish_at and publish_at > now:
            is_active_flag = False
        if expire_at and expire_at <= now:
            is_active_flag = False

        announcement.scope = scope
        announcement.municipality_id = municipality_id
        announcement.barangay_id = barangay_id
        announcement.status = status
        announcement.publish_at = publish_at
        announcement.expire_at = expire_at
        announcement.is_active = is_active_flag
        announcement.created_by_staff_id = announcement.created_by_staff_id or ctx['user'].id
        announcement.updated_at = datetime.utcnow()

        # Handle image uploads if present (FormData only)
        if is_multipart and 'images' in request.files:
            image_files = request.files.getlist('images')
            saved_images = list(announcement.images) if announcement.images else []
            for img_file in image_files:
                if img_file and img_file.filename:
                    try:
                        img_path = save_announcement_image(img_file)
                        saved_images.append(img_path)
                    except Exception as img_err:
                        current_app.logger.warning(f"Failed to save announcement image: {img_err}")
            if saved_images:
                announcement.images = saved_images

        db.session.commit()

        try:
            if announcement.status == 'PUBLISHED':
                now_ts = datetime.utcnow()
                publish_target = announcement.publish_at or now_ts
                became_live = prev_status != 'PUBLISHED' or (prev_publish_at and prev_publish_at > now and publish_target <= now_ts)
                if became_live:
                    queue_announcement_notifications(announcement)
                    db.session.commit()
        except Exception as notify_exc:
            db.session.rollback()
            current_app.logger.warning("Failed to queue announcement notifications on update: %s", notify_exc)

        return jsonify({
            'message': 'Announcement updated successfully',
            'announcement': announcement.to_dict()
        }), 200

    except ValidationError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update announcement', 'details': str(e)}), 500

@admin_bp.route('/announcements/<int:announcement_id>/upload', methods=['POST'])
@jwt_required()
def upload_announcement_image(announcement_id):
    """Upload images for an announcement (max 5)."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403

        announcement = Announcement.query.get(announcement_id)
        if not announcement:
            return jsonify({'error': 'Announcement not found'}), 404
        allowed, denial = _enforce_scope_permission(
            ctx,
            _normalize_scope(announcement.scope),
            announcement.municipality_id,
            announcement.barangay_id,
        )
        if not allowed:
            return denial

        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        file = request.files['file']

        # Enforce max 5 images
        images = announcement.images or []
        if len(images) >= 5:
            return jsonify({'error': 'Maximum images reached (5)'}), 400

        # Municipality slug
        municipality_slug = 'zambales'
        if announcement.municipality_id:
            municipality = Municipality.query.get(announcement.municipality_id)
            municipality_slug = municipality.slug if municipality else 'zambales'

        rel_path = save_announcement_image(file, announcement_id, municipality_slug)
        images.append(rel_path)
        announcement.images = images
        db.session.commit()

        return jsonify({'message': 'Image uploaded', 'path': rel_path, 'announcement': announcement.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload image', 'details': str(e)}), 500


@admin_bp.route('/announcements/<int:announcement_id>/uploads', methods=['POST'])
@jwt_required()
def upload_announcement_images(announcement_id):
    """Upload multiple images for an announcement (max 5 total). Accepts multiple 'file' parts."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403

        announcement = Announcement.query.get(announcement_id)
        if not announcement:
            return jsonify({'error': 'Announcement not found'}), 404
        allowed, denial = _enforce_scope_permission(
            ctx,
            _normalize_scope(announcement.scope),
            announcement.municipality_id,
            announcement.barangay_id,
        )
        if not allowed:
            return denial

        if not request.files:
            return jsonify({'error': 'No files uploaded'}), 400

        # Municipality slug
        municipality_slug = 'zambales'
        if announcement.municipality_id:
            municipality = Municipality.query.get(announcement.municipality_id)
            municipality_slug = municipality.slug if municipality else 'zambales'

        images = announcement.images or []
        saved_paths = []

        # Accept multiple 'file' fields; each key may be single or list
        for key in request.files:
            files = request.files.getlist(key)
            for f in files:
                if len(images) >= 5:
                    break
                rel_path = save_announcement_image(f, announcement_id, municipality_slug)
                images.append(rel_path)
                saved_paths.append(rel_path)
            if len(images) >= 5:
                break

        announcement.images = images
        db.session.commit()

        return jsonify({'message': 'Images uploaded', 'paths': saved_paths, 'announcement': announcement.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload images', 'details': str(e)}), 500

@admin_bp.route('/announcements/<int:announcement_id>', methods=['DELETE'])
@jwt_required()
def delete_announcement(announcement_id):
    """Delete announcement."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403

        announcement = Announcement.query.get(announcement_id)
        if not announcement:
            return jsonify({'error': 'Announcement not found'}), 404

        allowed, denial = _enforce_scope_permission(
            ctx,
            _normalize_scope(announcement.scope),
            announcement.municipality_id,
            announcement.barangay_id,
        )
        if not allowed:
            return denial

        db.session.delete(announcement)
        db.session.commit()
        
        return jsonify({
            'message': 'Announcement deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete announcement', 'details': str(e)}), 500

@admin_bp.route('/announcements/stats', methods=['GET'])
@jwt_required()
def get_announcement_stats():
    """Get announcement statistics."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403

        now = datetime.utcnow()
        q = _announcement_query_for_staff(ctx)
        total_announcements = q.count()
        published = q.filter(Announcement.status == 'PUBLISHED').count()
        draft = q.filter(Announcement.status == 'DRAFT').count()
        archived = q.filter(Announcement.status == 'ARCHIVED').count()
        active_announcements = q.filter(
            Announcement.status == 'PUBLISHED',
            or_(Announcement.publish_at == None, Announcement.publish_at <= now),
            or_(Announcement.expire_at == None, Announcement.expire_at > now),
        ).count()
        pinned_active = q.filter(
            Announcement.pinned == True,
            or_(Announcement.pinned_until == None, Announcement.pinned_until > now)
        ).count()

        return jsonify({
            'total_announcements': total_announcements,
            'published_announcements': published,
            'active_announcements': active_announcements,
            'draft_announcements': draft,
            'archived_announcements': archived,
            'pinned_active': pinned_active,
        }), 200

    except Exception as e:
        return jsonify({'error': 'Failed to get announcement statistics', 'details': str(e)}), 500

# Dashboard Statistics Endpoint
@admin_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """Get aggregated statistics for dashboard."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id
        now = datetime.utcnow()
        
        # Initialize stats with default values
        stats = {
            'pending_verifications': 0,
            'active_issues': 0,
            'marketplace_items': 0,
            'announcements': 0
        }
        
        try:
            # User statistics
            pending_verifications = User.query.filter(
                and_(
                    User.municipality_id == municipality_id,
                    User.role == 'resident',
                    User.admin_verified == False,
                    User.is_active == True
                )
            ).count()
            stats['pending_verifications'] = pending_verifications
        except Exception:
            pass  # Keep default 0
        
        try:
            # Issue statistics
            active_issues = Issue.query.filter(
                and_(
                    Issue.municipality_id == municipality_id,
                    Issue.status.in_(['pending', 'in_progress'])
                )
            ).count()
            stats['active_issues'] = active_issues
        except Exception:
            pass  # Keep default 0
        
        try:
            # Marketplace statistics
            marketplace_items = MarketplaceItem.query.filter(
                and_(
                    MarketplaceItem.municipality_id == municipality_id,
                    MarketplaceItem.status == 'pending',
                    MarketplaceItem.is_active == True
                )
            ).count()
            stats['marketplace_items'] = marketplace_items
        except Exception:
            pass  # Keep default 0
        
        try:
            # Announcements statistics
            announcements = Announcement.query.filter(
                or_(
                    and_(Announcement.scope == 'MUNICIPALITY', Announcement.municipality_id == municipality_id),
                    and_(Announcement.scope == 'BARANGAY', Announcement.municipality_id == municipality_id),
                ),
                Announcement.status == 'PUBLISHED',
                or_(Announcement.publish_at == None, Announcement.publish_at <= now),
                or_(Announcement.expire_at == None, Announcement.expire_at > now),
            ).count()
            stats['announcements'] = announcements
        except Exception:
            pass  # Keep default 0
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get dashboard statistics', 'details': str(e)}), 500

# ---------------------------------------------
# Benefits Management (Admin)
# ---------------------------------------------

@admin_bp.route('/benefits/programs', methods=['GET'])
@jwt_required()
def admin_list_benefit_programs():
    """List benefit programs for the admin's municipality (include province-wide/None)."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        q = BenefitProgram.query
        # Show province-wide (NULL) and this municipality
        programs = (
            q.filter(
                (BenefitProgram.municipality_id == municipality_id) |
                (BenefitProgram.municipality_id.is_(None))
            )
            .order_by(BenefitProgram.created_at.desc())
            .all()
        )
        # Auto-complete expired programs
        now = datetime.utcnow()
        changed = False
        for p in programs:
            try:
                if p.is_active and p.duration_days and p.created_at:
                    from datetime import timedelta as _td
                    if p.created_at + _td(days=int(p.duration_days)) <= now:
                        p.is_active = False
                        p.is_accepting_applications = False
                        p.completed_at = now
                        changed = True
            except Exception:
                pass
        if changed:
            db.session.commit()

        # Compute beneficiaries as count of approved applications per program
        try:
            program_ids = [p.id for p in programs] or []
            if program_ids:
                rows = (
                    db.session.query(
                        BenefitApplication.program_id,
                        func.count(BenefitApplication.id)
                    )
                    .filter(
                        BenefitApplication.program_id.in_(program_ids),
                        BenefitApplication.status == 'approved'
                    )
                    .group_by(BenefitApplication.program_id)
                    .all()
                )
                counts = {pid: int(cnt) for pid, cnt in rows}
                for p in programs:
                    # override in-memory for response consistency
                    try:
                        p.current_beneficiaries = counts.get(p.id, 0)
                    except Exception:
                        pass
        except Exception:
            # Best-effort; fall back to stored value
            pass

        return jsonify({
            'programs': [p.to_dict() for p in programs],
            'count': len(programs)
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get programs', 'details': str(e)}), 500

@admin_bp.route('/benefits/applications', methods=['GET'])
@jwt_required()
def admin_list_benefit_applications():
    """List benefit applications scoped to admin municipality (include province-wide programs)."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        active_only = request.args.get('active_only', 'true').lower() != 'false'

        q = BenefitApplication.query.join(BenefitProgram, BenefitApplication.program_id == BenefitProgram.id)
        q = q.filter((BenefitProgram.municipality_id == municipality_id) | (BenefitProgram.municipality_id.is_(None)))
        if status:
            q = q.filter(BenefitApplication.status == status)
        if active_only:
            q = q.filter(BenefitProgram.is_active.is_(True))

        apps = q.order_by(BenefitApplication.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
        data = []
        for app in apps.items:
            data.append(app.to_dict(include_user=True))

        return jsonify({
            'applications': data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': apps.total,
                'pages': apps.pages,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get applications', 'details': str(e)}), 500


@admin_bp.route('/benefits/programs/<int:program_id>/applications', methods=['GET'])
@jwt_required()
def admin_list_program_applicants(program_id: int):
    """List applicants for a specific program scoped to admin municipality."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        program = BenefitProgram.query.get(program_id)
        if not program:
            return jsonify({'error': 'Program not found'}), 404
        if program.municipality_id and program.municipality_id != municipality_id:
            return jsonify({'error': 'Program not in your municipality'}), 403

        apps = BenefitApplication.query.filter(BenefitApplication.program_id == program_id).order_by(BenefitApplication.created_at.desc()).all()
        data = [a.to_dict(include_user=True) for a in apps]
        return jsonify({'applications': data, 'count': len(data)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get program applicants', 'details': str(e)}), 500

# ---------------------------------------------
# Resident Transfer Requests
# ---------------------------------------------

@admin_bp.route('/transfers', methods=['GET'])
@jwt_required()
def admin_list_transfers():
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        status = (request.args.get('status') or '').strip().lower() or None
        q = (request.args.get('q') or '').strip() or None
        page = request.args.get('page', type=int) or 1
        per_page = min(request.args.get('per_page', type=int) or 20, 100)
        sort = (request.args.get('sort') or 'created_at').strip()
        order = (request.args.get('order') or 'desc').strip()

        base = TransferRequest.query.filter(
            or_(TransferRequest.from_municipality_id == municipality_id, TransferRequest.to_municipality_id == municipality_id)
        )
        if status:
            base = base.filter(TransferRequest.status == status)

        if q:
            try:
                base = base.join(User, User.id == TransferRequest.user_id).filter(
                    or_(
                        func.lower(func.trim((User.first_name + ' ' + User.last_name))).like(f"%{q.lower()}%"),
                        func.lower(User.email).like(f"%{q.lower()}%"),
                        func.cast(TransferRequest.id, db.String).like(f"%{q}%")
                    )
                )
            except Exception:
                pass

        # Sorting
        sort_col = TransferRequest.status if sort == 'status' else TransferRequest.created_at
        base = base.order_by(sort_col.asc() if order == 'asc' else sort_col.desc())

        p = base.paginate(page=page, per_page=per_page, error_out=False)
        items = []
        for t in p.items:
            d = t.to_dict()
            try:
                u = User.query.get(t.user_id)
                if u:
                    d['resident_name'] = (f"{getattr(u,'first_name','') or ''} {getattr(u,'last_name','') or ''}").strip() or getattr(u,'username', None) or getattr(u,'email', None)
                    d['email'] = getattr(u, 'email', None)
                    d['phone'] = getattr(u, 'phone_number', None)
            except Exception:
                pass
            items.append(d)

        return jsonify({'transfers': items, 'page': p.page, 'pages': p.pages, 'per_page': p.per_page, 'total': p.total}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get transfer requests', 'details': str(e)}), 500

@admin_bp.route('/transfers/<int:transfer_id>/status', methods=['PUT'])
@jwt_required()
def admin_update_transfer(transfer_id: int):
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id
        data = request.get_json() or {}
        new_status = (data.get('status') or '').lower()  # approved, rejected, accepted

        t = TransferRequest.query.get(transfer_id)
        if not t:
            return jsonify({'error': 'Transfer request not found'}), 404

        now = datetime.utcnow()
        prev_status = (t.status or 'pending').lower()
        if new_status == 'approved':
            if t.from_municipality_id != municipality_id:
                return jsonify({'error': 'Only current municipality can approve'}), 403
            t.status = 'approved'
            t.approved_at = now
        elif new_status == 'rejected':
            if t.from_municipality_id != municipality_id:
                return jsonify({'error': 'Only current municipality can reject'}), 403
            t.status = 'rejected'
        elif new_status == 'accepted':
            if t.to_municipality_id != municipality_id:
                return jsonify({'error': 'Only new municipality can accept'}), 403
            if t.status != 'approved':
                return jsonify({'error': 'Only approved transfers can be accepted'}), 400
            # Move user to new municipality and barangay, reset admin verification (pending acceptance)
            user = User.query.get(t.user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            user.municipality_id = t.to_municipality_id
            user.barangay_id = t.to_barangay_id  # Set to requested barangay if provided
            user.admin_verified = False
            user.updated_at = now
            t.status = 'accepted'
            t.accepted_at = now
        else:
            return jsonify({'error': 'Invalid status'}), 400
        t.updated_at = now
        db.session.commit()
        # Audit (best-effort)
        try:
            action_map = {
                'approved': 'approve_transfer',
                'rejected': 'deny_transfer',
                'accepted': 'accept_transfer',
            }
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=municipality_id,
                entity_type='transfer_request',
                entity_id=t.id,
                action=action_map.get(new_status, f'status_{new_status}'),
                actor_role='admin',
                old_values={'status': prev_status},
                new_values={'status': new_status},
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
        return jsonify({'message': 'Transfer updated', 'transfer': t.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update transfer', 'details': str(e)}), 500

@admin_bp.route('/benefits/applications/<int:application_id>/status', methods=['PUT'])
@jwt_required()
def admin_update_benefit_application_status(application_id: int):
    """Update benefit application status and send notifications."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        data = request.get_json() or {}
        new_status = (data.get('status') or '').lower()
        notes = data.get('admin_notes')
        rejection_reason = data.get('rejection_reason')

        if new_status not in ['pending', 'under_review', 'approved', 'rejected', 'cancelled']:
            return jsonify({'error': 'Invalid status'}), 400

        app = BenefitApplication.query.get(application_id)
        if not app:
            return jsonify({'error': 'Application not found'}), 404

        program = BenefitProgram.query.get(app.program_id)
        if not program:
            return jsonify({'error': 'Program not found'}), 404

        if program.municipality_id and program.municipality_id != municipality_id:
            return jsonify({'error': 'Application not in your municipality'}), 403

        # Prevent status changes after approval or rejection (status is final)
        prev = (app.status or 'pending').lower()
        if prev == 'approved' and new_status != 'approved':
            return jsonify({'error': 'Cannot change status from approved. Approval is final.'}), 400
        if prev == 'rejected' and new_status != 'rejected':
            return jsonify({'error': 'Cannot change status from rejected. Rejection is final.'}), 400
        
        # Check for required documents before approval
        if new_status == 'approved':
            required_docs = program.required_documents or []
            if isinstance(required_docs, list) and len(required_docs) > 0:
                app_docs = app.supporting_documents or []
                if not app_docs or len(app_docs) == 0:
                    return jsonify({'error': 'Cannot approve application without required documents. Please ensure applicant has uploaded all required documents.'}), 400

        app.status = new_status
        if notes is not None:
            app.admin_notes = notes
        if new_status == 'rejected' and rejection_reason:
            app.rejection_reason = rejection_reason
        now = datetime.utcnow()
        app.updated_at = now
        if new_status == 'under_review':
            app.reviewed_at = now
        if new_status == 'approved':
            app.approved_at = now
        # Adjust program beneficiaries count based on status transition
        try:
            if prev != 'approved' and new_status == 'approved':
                program.current_beneficiaries = (program.current_beneficiaries or 0) + 1
            if prev == 'approved' and new_status != 'approved':
                current = (program.current_beneficiaries or 0)
                program.current_beneficiaries = max(0, current - 1)
        except Exception:
            pass
        db.session.commit()

        # Generic audit log (best-effort)
        try:
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=getattr(program, 'municipality_id', None) or get_admin_municipality_id() or 0,
                entity_type='benefit_application',
                entity_id=getattr(app, 'id', None),
                action=f'status_{new_status}',
                actor_role='admin',
                old_values={'status': prev},
                new_values={'status': new_status},
                notes=notes,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Email notifications (best-effort)
        try:
            user = User.query.get(app.user_id)
            if user and user.email:
                if new_status == 'approved':
                    send_generic = send_user_status_email  # reuse helper for simple message
                    send_generic(user.email, approved=True)
                if new_status == 'rejected':
                    send_generic = send_user_status_email
                    send_generic(user.email, approved=False, reason=(app.rejection_reason or notes or ''))
        except Exception:
            pass

        return jsonify({'message': 'Status updated', 'application': app.to_dict(include_user=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update application status', 'details': str(e)}), 500

@admin_bp.route('/benefits/programs', methods=['POST'])
@jwt_required()
def admin_create_benefit_program():
    """Create a new benefit program scoped to the admin municipality by default."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        import json as _json
        from models.municipality import Municipality
        from utils.file_handler import save_benefit_program_image

        def _maybe_json(v):
            if v is None:
                return None
            if isinstance(v, (dict, list)):
                return v
            s = str(v).strip()
            if not s:
                return None
            try:
                return _json.loads(s)
            except Exception:
                return v

        # Support multipart/form-data (required for image upload) and JSON (legacy)
        if request.files:
            data = dict(request.form or {})
            file = request.files.get('file')
        else:
            data = request.get_json() or {}
            file = None

        name = data.get('name') or data.get('title')
        code = data.get('code')
        description = data.get('description') or ''
        program_type = data.get('program_type') or 'general'
        
        # SECURITY: Always use the admin's municipality - cannot be overridden
        # This ensures admins can only create programs for their own jurisdiction
        program_municipality_id = municipality_id
        
        # Reject any attempt to specify a different municipality
        if data.get('municipality_id') and int(data.get('municipality_id')) != municipality_id:
            return jsonify({'error': 'Cannot create programs for other municipalities'}), 403

        if not name or not code:
            return jsonify({'error': 'name and code are required'}), 400

        # Image is required for a professional, consistent Programs page
        if not file:
            return jsonify({'error': 'Program image is required'}), 400

        program = BenefitProgram(
            name=name,
            code=code,
            description=description,
            program_type=program_type,
            municipality_id=program_municipality_id,
            eligibility_criteria=_maybe_json(data.get('eligibility_criteria')),
            required_documents=_maybe_json(data.get('required_documents')),
            application_start=data.get('application_start'),
            application_end=data.get('application_end'),
            benefit_amount=data.get('benefit_amount'),
            benefit_description=data.get('benefit_description'),
            max_beneficiaries=data.get('max_beneficiaries'),
            is_active=bool(data.get('is_active', True)),
            is_accepting_applications=bool(data.get('is_accepting_applications', True)),
            duration_days=data.get('duration_days'),
        )

        db.session.add(program)
        db.session.commit()

        # Save program image (uploads/benefit_programs/admins/{municipality_slug}/program_{id}/...)
        municipality = Municipality.query.get(program_municipality_id)
        municipality_slug = (municipality.slug if municipality else 'unknown')
        rel_path = save_benefit_program_image(file, program.id, municipality_slug, user_type='admins')
        program.image_path = rel_path
        db.session.commit()

        try:
            if program.is_active and program.is_accepting_applications:
                queue_benefit_program_notifications(program)
                db.session.commit()
        except Exception as notify_exc:
            db.session.rollback()
            current_app.logger.warning("Failed to queue benefit program notifications: %s", notify_exc)

        return jsonify({'message': 'Program created', 'program': program.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create program', 'details': str(e)}), 500


@admin_bp.route('/benefits/programs/<int:program_id>', methods=['PUT'])
@jwt_required()
def admin_update_benefit_program(program_id: int):
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        program = BenefitProgram.query.get(program_id)
        if not program:
            return jsonify({'error': 'Program not found'}), 404

        if program.municipality_id and program.municipality_id != municipality_id:
            return jsonify({'error': 'Program not in your municipality'}), 403

        import json as _json
        from models.municipality import Municipality
        from utils.file_handler import save_benefit_program_image

        def _maybe_json(v):
            if v is None:
                return None
            if isinstance(v, (dict, list)):
                return v
            s = str(v).strip()
            if not s:
                return None
            try:
                return _json.loads(s)
            except Exception:
                return v

        def _parse_bool(v):
            if isinstance(v, bool):
                return v
            return str(v).strip().lower() in ('1', 'true', 'yes', 'y', 'on')

        # Support multipart/form-data (optional image) and JSON (legacy)
        if request.files:
            data = dict(request.form or {})
            file = request.files.get('file')
        else:
            data = request.get_json() or {}
            file = None

        for field in [
            'name', 'code', 'description', 'program_type',
            'application_start', 'application_end', 'benefit_amount', 'benefit_description',
            'max_beneficiaries', 'duration_days'
        ]:
            if field in data:
                setattr(program, field, data[field])

        if 'eligibility_criteria' in data:
            program.eligibility_criteria = _maybe_json(data.get('eligibility_criteria'))
        if 'required_documents' in data:
            program.required_documents = _maybe_json(data.get('required_documents'))
        if 'is_active' in data:
            program.is_active = _parse_bool(data.get('is_active'))
        if 'is_accepting_applications' in data:
            program.is_accepting_applications = _parse_bool(data.get('is_accepting_applications'))

        # Optional image replacement
        if file:
            municipality = Municipality.query.get(program.municipality_id or municipality_id)
            municipality_slug = (municipality.slug if municipality else 'unknown')
            rel_path = save_benefit_program_image(file, program.id, municipality_slug, user_type='admins')
            program.image_path = rel_path

        db.session.commit()
        return jsonify({'message': 'Program updated', 'program': program.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update program', 'details': str(e)}), 500


@admin_bp.route('/benefits/programs/<int:program_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_benefit_program(program_id: int):
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        program = BenefitProgram.query.get(program_id)
        if not program:
            return jsonify({'error': 'Program not found'}), 404

        if program.municipality_id and program.municipality_id != municipality_id:
            return jsonify({'error': 'Program not in your municipality'}), 403

        db.session.delete(program)
        db.session.commit()
        return jsonify({'message': 'Program deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete program', 'details': str(e)}), 500


@admin_bp.route('/benefits/programs/<int:program_id>/complete', methods=['PUT'])
@jwt_required()
def admin_complete_benefit_program(program_id: int):
    """Mark a benefit program as completed (manual Done action)."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        program = BenefitProgram.query.get(program_id)
        if not program:
            return jsonify({'error': 'Program not found'}), 404
        if program.municipality_id and program.municipality_id != municipality_id:
            return jsonify({'error': 'Program not in your municipality'}), 403

        now = datetime.utcnow()
        program.is_active = False
        program.is_accepting_applications = False
        program.completed_at = now
        db.session.commit()
        return jsonify({'message': 'Program marked as completed', 'program': program.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to complete program', 'details': str(e)}), 500


# ---------------------------------------------
# Reports: Documents and Municipality Performance
# ---------------------------------------------

def _parse_range(range_param: str):
    now = datetime.utcnow()
    if range_param == 'last_7_days':
        return now - timedelta(days=7), now
    if range_param == 'last_90_days':
        return now - timedelta(days=90), now
    if range_param == 'this_year':
        start = datetime(now.year, 1, 1)
        return start, now
    # default last_30_days
    return now - timedelta(days=30), now


@admin_bp.route('/documents/stats', methods=['GET'])
@jwt_required()
def admin_documents_stats():
    """Get document request statistics including status counts - single optimized endpoint."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        range_param = request.args.get('range', 'last_30_days')
        start, end = _parse_range(range_param)

        base_filter = and_(
            DocumentRequest.municipality_id == municipality_id,
            DocumentRequest.created_at >= start,
            DocumentRequest.created_at <= end,
        )
        # Barangay admins only see their barangay
        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id'):
                return jsonify({'error': 'Barangay assignment required'}), 403
            base_filter = and_(base_filter, DocumentRequest.barangay_id == ctx['barangay_id'])

        # Single query to get all status counts efficiently
        status_counts = db.session.query(
            DocumentRequest.status,
            func.count(DocumentRequest.id)
        ).filter(base_filter).group_by(DocumentRequest.status).all()
        
        # Build status map
        status_map = {str(s[0]).lower(): int(s[1]) for s in status_counts}
        total = sum(status_map.values())
        
        # Normalize status names including barangay stage
        pending = status_map.get('pending', 0)
        barangay_processing = status_map.get('barangay_processing', 0)
        barangay_approved = status_map.get('barangay_approved', 0)
        barangay_rejected = status_map.get('barangay_rejected', 0)
        processing = status_map.get('processing', 0) + status_map.get('in_progress', 0)
        ready = status_map.get('ready', 0) + status_map.get('ready_for_pickup', 0)
        completed = status_map.get('completed', 0) + status_map.get('picked_up', 0) + status_map.get('closed', 0)
        rejected = status_map.get('rejected', 0) + barangay_rejected

        # Top requested document names if relationship exists; fallback to counts by id
        try:
            from models.document import DocumentType
            rows = db.session.query(DocumentType.name, func.count(DocumentRequest.id))\
                .join(DocumentRequest, DocumentRequest.document_type_id == DocumentType.id)\
                .filter(base_filter)\
                .group_by(DocumentType.name)\
                .order_by(func.count(DocumentRequest.id).desc())\
                .limit(5).all()
            top = [{'name': r[0], 'count': int(r[1])} for r in rows]
        except Exception:
            rows = db.session.query(DocumentRequest.document_type_id, func.count(DocumentRequest.id))\
                .filter(base_filter)\
                .group_by(DocumentRequest.document_type_id)\
                .order_by(func.count(DocumentRequest.id).desc())\
                .limit(5).all()
            top = [{'name': str(r[0]), 'count': int(r[1])} for r in rows]

        return jsonify({
            'total_requests': total,
            'pending_requests': pending,
            'barangay_processing_requests': barangay_processing,
            'barangay_approved_requests': barangay_approved,
            'barangay_rejected_requests': barangay_rejected,
            'processing_requests': processing + barangay_processing,
            'ready_requests': ready,
            'completed_requests': completed,
            'rejected_requests': rejected,
            'top_requested': top,
            'status_breakdown': status_map
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get document stats', 'details': str(e)}), 500


@admin_bp.route('/documents/requests', methods=['GET'])
@jwt_required()
def get_document_requests():
    """Get all document requests for admin's municipality with pagination and filtering."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):  # Error response
            return municipality_id

        # Get filter parameters
        status = request.args.get('status')
        delivery = request.args.get('delivery')  # 'digital' | 'pickup'
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Build query with joins
        query = db.session.query(DocumentRequest, User, DocumentType)\
            .join(User, DocumentRequest.user_id == User.id)\
            .join(DocumentType, DocumentRequest.document_type_id == DocumentType.id)\
            .filter(DocumentRequest.municipality_id == municipality_id)

        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id'):
                return jsonify({'error': 'Barangay assignment required'}), 403
            query = query.filter(DocumentRequest.barangay_id == ctx['barangay_id'])

        # Apply status filter if provided
        if status:
            query = query.filter(DocumentRequest.status == status)
        
        # Apply delivery method filter if provided
        if delivery:
            norm = delivery.lower()
            if norm == 'pickup':
                query = query.filter(DocumentRequest.delivery_method == 'physical')
            elif norm == 'digital':
                query = query.filter(DocumentRequest.delivery_method == 'digital')
        
        # Order by creation date (newest first)
        query = query.order_by(DocumentRequest.created_at.desc())
        
        # Apply pagination
        requests_paginated = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # Format response data
        requests_data = []
        for req, user, doc_type in requests_paginated.items:
            request_data = req.to_dict(include_user=True, include_audit=True)
            request_data['user'] = user.to_dict()
            request_data['document_type'] = doc_type.to_dict()
            requests_data.append(request_data)
        
        return jsonify({
            'requests': requests_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': requests_paginated.total,
                'pages': requests_paginated.pages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get document requests', 'details': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/generate-pdf', methods=['POST'])
@jwt_required()
def generate_document_request_pdf(request_id: int):
    """Generate PDF for a digital document request using dynamic ReportLab generator."""
    try:
        from utils.pdf_generator import generate_document_pdf

        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403
        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id') or req.barangay_id != ctx['barangay_id']:
                return jsonify({'error': 'Request not in your barangay'}), 403
        # Only for digital requests
        if (req.delivery_method or '').lower() not in ('digital',):
            return jsonify({'error': 'PDF generation is only available for digital requests'}), 400

        user = User.query.get(req.user_id)
        doc_type = DocumentType.query.get(req.document_type_id)
        if not doc_type:
            return jsonify({'error': 'Document type not found'}), 404

        # Current admin for BY line
        try:
            admin_user = User.query.get(get_jwt_identity())
        except Exception:
            admin_user = None

        abs_path, rel_path = generate_document_pdf(req, doc_type, user, admin_user=admin_user)

        req.document_file = rel_path
        # Retain existing behavior for digital requests: set ready after generation,
        # but defer final completion to an explicit action.
        req.status = 'ready'
        req.ready_at = datetime.utcnow()
        req.updated_at = datetime.utcnow()
        # Audit (best-effort)
        try:
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=req.municipality_id,
                entity_type='document_request',
                entity_id=req.id,
                action='generate_pdf',
                actor_role='admin',
                old_values=None,
                new_values={'document_file': rel_path},
                notes=None,
            )
        except Exception:
            pass
        db.session.commit()

        try:
            queue_document_status_change(
                user,
                req,
                doc_type.name if hasattr(doc_type, 'name') else 'Document',
                'ready',
                None
            )
            db.session.commit()
        except Exception as notify_exc:
            db.session.rollback()
            current_app.logger.warning("Failed to queue document ready notification: %s", notify_exc)

        return jsonify({'message': 'Document generated', 'url': f"/uploads/{rel_path}", 'request': req.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to generate PDF', 'details': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/download', methods=['GET'])
@jwt_required()
def download_document_request_pdf(request_id: int):
    """Return the generated PDF for a request if available."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403
        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id') or req.barangay_id != ctx['barangay_id']:
                return jsonify({'error': 'Request not in your barangay'}), 403
        if not req.document_file:
            return jsonify({'error': 'No generated document available'}), 404

        # Return URL - could be Supabase URL or local path
        url = req.document_file
        if not url.startswith(('http://', 'https://')):
            url = f"/uploads/{req.document_file}"
        return jsonify({'url': url}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to download PDF', 'details': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/regenerate-qr', methods=['POST'])
@jwt_required()
def regenerate_document_qr_code(request_id: int):
    """
    Regenerate QR code for a document request.
    
    This endpoint allows admins to regenerate QR codes for documents
    that have missing or broken QR codes (e.g., after migration).
    
    Returns:
        JSON with new QR code URL
    """
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403
        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id') or req.barangay_id != ctx['barangay_id']:
                return jsonify({'error': 'Request not in your barangay'}), 403
        
        # Get municipality slug
        municipality = Municipality.query.get(municipality_id)
        municipality_slug = municipality.slug if municipality else 'unknown'
        
        # Regenerate QR code
        from utils.qr_generator import regenerate_qr_code
        
        new_qr_url = regenerate_qr_code(req, municipality_slug)
        
        # Update database
        req.qr_code = new_qr_url
        req.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Audit log
        try:
            log_generic_action(
                action='regenerate_qr',
                target_type='document_request',
                target_id=request_id,
                municipality_id=municipality_id,
                details={'new_qr_url': new_qr_url[:100] if new_qr_url else None}
            )
        except Exception:
            pass
        
        return jsonify({
            'message': 'QR code regenerated successfully',
            'qr_code': new_qr_url,
            'request': req.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Failed to regenerate QR code: {e}")
        return jsonify({'error': 'Failed to regenerate QR code', 'details': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/regenerate-pdf', methods=['POST'])
@jwt_required()
def regenerate_document_pdf(request_id: int):
    """
    Regenerate PDF for a document request.
    
    This endpoint allows admins to regenerate PDFs for documents
    that have missing or broken files (e.g., after migration).
    
    Returns:
        JSON with new PDF URL
    """
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403
        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id') or req.barangay_id != ctx['barangay_id']:
                return jsonify({'error': 'Request not in your barangay'}), 403
        
        # Check status - only regenerate for approved/ready/completed requests
        if req.status not in ('approved', 'processing', 'ready', 'completed', 'picked_up'):
            return jsonify({'error': 'Cannot regenerate PDF for this request status'}), 400
        
        # Get document type and user
        doc_type = req.document_type
        if not doc_type:
            return jsonify({'error': 'Document type not found'}), 404
        
        user = User.query.get(req.user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get admin user for signatory
        admin_id = get_jwt_identity()
        admin_user = User.query.get(admin_id)
        
        # Regenerate PDF
        from utils.pdf_generator import generate_document_pdf
        
        _, new_pdf_url = generate_document_pdf(req, doc_type, user, admin_user)
        
        # Update database
        req.document_file = new_pdf_url
        req.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Audit log
        try:
            log_generic_action(
                action='regenerate_pdf',
                target_type='document_request',
                target_id=request_id,
                municipality_id=municipality_id,
                details={'new_pdf_url': new_pdf_url[:100] if new_pdf_url else None}
            )
        except Exception:
            pass
        
        return jsonify({
            'message': 'PDF regenerated successfully',
            'document_file': new_pdf_url,
            'request': req.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Failed to regenerate PDF: {e}")
        return jsonify({'error': 'Failed to regenerate PDF', 'details': str(e)}), 500


@admin_bp.route('/storage/check-legacy', methods=['GET'])
@jwt_required()
def check_legacy_files():
    """
    Check for legacy file paths in the admin's municipality.
    
    Returns a report of records with missing or legacy file paths
    that need attention (re-upload or regeneration).
    """
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id
        
        from utils.storage_handler import is_legacy_path, is_file_missing
        
        results = {
            'document_requests': {'total': 0, 'legacy': 0, 'missing': 0},
            'issues': [],
            'items': [],
            'announcements': []
        }
        
        # Check document requests
        doc_requests = DocumentRequest.query.filter_by(municipality_id=municipality_id).all()
        for req in doc_requests:
            results['document_requests']['total'] += 1
            
            # Check QR code
            if req.qr_code:
                if is_legacy_path(req.qr_code):
                    results['document_requests']['legacy'] += 1
                if is_file_missing(req.qr_code):
                    results['document_requests']['missing'] += 1
            
            # Check document file
            if req.document_file:
                if is_legacy_path(req.document_file):
                    results['document_requests']['legacy'] += 1
                if is_file_missing(req.document_file):
                    results['document_requests']['missing'] += 1
        
        return jsonify({
            'message': 'Legacy file check complete',
            'municipality_id': municipality_id,
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to check legacy files', 'details': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/status', methods=['PUT'])
@jwt_required()
def update_document_request_status(request_id: int):
    """Update request status and timestamps with basic transition checks."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        data = request.get_json() or {}
        new_status = (data.get('status') or '').lower()
        notes = data.get('admin_notes')
        rejection_reason = data.get('rejection_reason')

        valid_statuses = {
            'pending',
            'approved',
            'processing',
            'ready',
            'completed',
            'picked_up',
            'rejected',
            'cancelled',
            'barangay_processing',
            'barangay_approved',
            'barangay_rejected',
        }
        if new_status not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403
        role = ctx.get('role_lower')
        doc_type = DocumentType.query.get(req.document_type_id) if req.document_type_id else None
        if role == 'barangay_admin':
            if not ctx.get('barangay_id') or req.barangay_id != ctx['barangay_id']:
                return jsonify({'error': 'Request not in your barangay'}), 403
            # Barangay admins have a restricted set for municipal-level documents
            barangay_allowed = {'barangay_processing', 'barangay_approved', 'barangay_rejected', 'cancelled'}
            # Barangay-issued documents can be fulfilled end-to-end by barangay admins
            if doc_type and (doc_type.authority_level or '').lower() == 'barangay':
                barangay_allowed = barangay_allowed | {'approved', 'processing', 'ready', 'completed', 'picked_up', 'rejected'}
            if new_status not in barangay_allowed:
                return jsonify({'error': 'Barangay admins cannot set this status for this request'}), 403

        # Simple transition guardrails (with approved step)
        current = (req.status or 'pending').lower()
        # Idempotent: if status is the same, no-op success
        if new_status == current:
            return jsonify({'message': 'Status unchanged', 'request': req.to_dict()}), 200
        # Allow picked_up for physical pickup handover; completed for digital delivery
        allowed = {
            'pending': {'approved', 'rejected', 'cancelled', 'barangay_processing', 'barangay_approved', 'barangay_rejected'},
            'barangay_processing': {'barangay_approved', 'barangay_rejected', 'cancelled'},
            'barangay_approved': {'approved', 'processing', 'ready', 'completed', 'picked_up', 'rejected', 'cancelled'},
            'barangay_rejected': set(),
            'approved': {'processing', 'rejected', 'cancelled'},
            'processing': {'ready', 'completed', 'rejected', 'cancelled'},
            'ready': {'completed', 'picked_up', 'rejected', 'cancelled'},
            'completed': set(),
            'picked_up': set(),
            'rejected': set(),
            'cancelled': set(),
        }
        if new_status not in allowed.get(current, set()):
            return jsonify({'error': f'Invalid transition from {current} to {new_status}'}), 400

        prev_status = (req.status or 'pending').lower()
        req.status = new_status
        if notes is not None:
            req.admin_notes = notes
        if new_status in {'rejected', 'barangay_rejected'} and rejection_reason:
            req.rejection_reason = rejection_reason
        now = datetime.utcnow()
        if new_status in {'approved', 'barangay_approved'}:
            req.approved_at = now
        if new_status == 'ready':
            req.ready_at = now
        if new_status == 'completed':
            req.completed_at = now
        req.updated_at = now
        db.session.commit()

        # Audit for status transitions (best-effort)
        try:
            action_map = {
                'approved': 'approve',
                'processing': 'start_processing',
                'ready': 'mark_ready',
                'completed': 'mark_completed',
                'picked_up': 'mark_picked_up',
                'rejected': 'reject',
                'cancelled': 'cancel',
            }
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=req.municipality_id,
                entity_type='document_request',
                entity_id=req.id,
                action=action_map.get(new_status, f'status_{new_status}'),
                actor_role='admin',
                old_values={'status': prev_status},
                new_values={'status': new_status},
                notes=notes or rejection_reason,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Queue notifications (best-effort)
        try:
            user = User.query.get(req.user_id)
            doc_type = DocumentType.query.get(req.document_type_id)
            if user and doc_type:
                queue_document_status_change(
                    user,
                    req,
                    doc_type.name if hasattr(doc_type, 'name') else 'Document',
                    new_status,
                    req.rejection_reason or notes or ''
                )
                db.session.commit()
        except Exception as notify_exc:
            db.session.rollback()
            current_app.logger.warning("Failed to queue document status notification: %s", notify_exc)

        return jsonify({'message': 'Status updated', 'request': req.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update request status', 'details': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/ready-for-pickup', methods=['POST'])
@jwt_required()
def admin_ready_for_pickup(request_id: int):
    """Mark a physical request as ready for pickup.

    Claim token/QR generation is handled separately via /claim-token.
    """
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403
        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id') or req.barangay_id != ctx['barangay_id']:
                return jsonify({'error': 'Request not in your barangay'}), 403

        # Only for pickup/physical requests
        if (req.delivery_method or '').lower() not in ('physical', 'pickup'):
            return jsonify({'error': 'Only pickup requests can be marked ready-for-pickup'}), 400

        # Only update status to ready
        req.status = 'ready'
        req.ready_at = datetime.utcnow()
        req.updated_at = datetime.utcnow()
        db.session.commit()

        # Audit and best-effort notify resident via email
        try:
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=req.municipality_id,
                entity_type='document_request',
                entity_id=req.id,
                action='mark_ready',
                actor_role='admin',
                old_values=None,
                new_values={'status': 'ready'},
                notes=None,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
        try:
            user = User.query.get(req.user_id)
            doc_type = DocumentType.query.get(req.document_type_id)
            if user and doc_type:
                queue_document_status_change(
                    user,
                    req,
                    doc_type.name if hasattr(doc_type, 'name') else 'Document',
                    'ready',
                    None
                )
                db.session.commit()
        except Exception as notify_exc:
            db.session.rollback()
            current_app.logger.warning("Failed to queue ready-for-pickup notification: %s", notify_exc)

        return jsonify({
            'message': 'Marked ready for pickup',
            'claim': {
                'qr_path': f"/uploads/{str(req.qr_code).replace('\\','/')}" if req.qr_code else None,
                'code_masked': (req.qr_data or {}).get('code_masked'),
                'window_start': (req.qr_data or {}).get('window_start'),
                'window_end': (req.qr_data or {}).get('window_end'),
                'token': (req.qr_data or {}).get('token'),
            },
            'request': req.to_dict(include_user=True)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to set ready for pickup', 'details': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/claim-token', methods=['POST'])
@jwt_required()
def admin_generate_claim_token(request_id: int):
    """Generate a claim token/QR for a pickup request without changing status."""
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        payload = request.get_json(silent=True) or {}
        window_start = payload.get('window_start')
        window_end = payload.get('window_end')

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403
        if ctx.get('role_lower') == 'barangay_admin':
            if not ctx.get('barangay_id') or req.barangay_id != ctx['barangay_id']:
                return jsonify({'error': 'Request not in your barangay'}), 403
        if (req.delivery_method or '').lower() not in ('physical', 'pickup'):
            return jsonify({'error': 'Only pickup requests support claim tokens'}), 400

        # Generate code and token
        code = generate_pickup_code()
        code_h = hash_code(code)
        token_info = sign_claim_token(req)

        # Build QR deep link to admin portal verify page with token param
        base = (
            current_app.config.get('ADMIN_WEB_BASE_URL')
            or os.getenv('ADMIN_WEB_BASE_URL')
            or 'http://localhost:3001'
        )
        deep_link = f"{base}/verify-ticket?token={token_info['token']}"

        # Build QR image file
        muni_name = getattr(getattr(req, 'municipality', None), 'name', str(req.municipality_id))
        slug = get_municipality_slug(muni_name)
        _, rel_png = build_qr_png(deep_link, req.id, slug)

        # Persist on request using existing columns
        req.qr_code = rel_png
        req.qr_data = {
            'token': token_info['token'],
            'jti': token_info['jti'],
            'exp': token_info.get('exp'),
            'code_hash': code_h.decode('utf-8', errors='ignore') if isinstance(code_h, (bytes, bytearray)) else str(code_h),
            'code_enc': encrypt_code(code),
            'code_masked': masked(code),
            'window_start': window_start,
            'window_end': window_end,
        }
        req.updated_at = datetime.utcnow()
        db.session.commit()

        # Audit
        try:
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=req.municipality_id,
                entity_type='document_request',
                entity_id=req.id,
                action='generate_claim_token',
                actor_role='admin',
                old_values=None,
                new_values={'qr_code': req.qr_code, 'code_masked': (req.qr_data or {}).get('code_masked')},
                notes=None,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({
            'message': 'Claim token generated',
            'claim': {
                'qr_path': f"/uploads/{rel_png}",
                'code_masked': req.qr_data.get('code_masked'),
                'window_start': window_start,
                'window_end': window_end,
                'token': token_info['token'],
            },
            'request': req.to_dict(include_user=True)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to generate claim token', 'details': str(e)}), 500

@admin_bp.route('/claim/verify', methods=['POST'])
@jwt_required()
def admin_verify_claim():
    """Verify a claim by token or fallback code.

    Returns safe request details for counter display.
    """
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        payload = request.get_json(silent=True) or {}
        token = payload.get('token')
        code = payload.get('code')

        req = None
        # Prefer token verification
        if token:
            secret = (
                current_app.config.get('CLAIM_JWT_SECRET')
                or current_app.config.get('JWT_SECRET_KEY')
                or 'change-me'
            )
            try:
                data = jwt.decode(token, secret, algorithms=['HS256'])
                sub = data.get('sub') or ''
                if sub.startswith('request:'):
                    rid = int(sub.split(':', 1)[1])
                    req = DocumentRequest.query.get(rid)
            except Exception as dec_err:
                return jsonify({'ok': False, 'error': f'Invalid token: {dec_err}'}), 400

        if req is None and code:
            # Fallback: search by request id in payload and compare code with stored hash
            # We avoid scanning all rows; require request_id in payload when using code
            rid = payload.get('request_id')
            if not rid:
                return jsonify({'ok': False, 'error': 'request_id is required with code verification'}), 400
            req = DocumentRequest.query.get(int(rid))
            if not req:
                return jsonify({'ok': False, 'error': 'Request not found'}), 404
            try:
                qd = req.qr_data or {}
                stored = qd.get('code_hash')
                if not stored:
                    return jsonify({'ok': False, 'error': 'No claim code on record'}), 400
                stored_bytes = stored.encode('utf-8') if isinstance(stored, str) else stored
                if not verify_code(code, stored_bytes):
                    return jsonify({'ok': False, 'error': 'Invalid code'}), 400
            except Exception:
                return jsonify({'ok': False, 'error': 'Verification error'}), 400

        if not req:
            return jsonify({'ok': False, 'error': 'Verification failed'}), 400

        if req.municipality_id != municipality_id:
            return jsonify({'ok': False, 'error': 'Request not in your municipality'}), 403

        # Must be ready and not yet picked up
        status = (req.status or '').lower()
        if status != 'ready':
            return jsonify({'ok': False, 'error': f'Request not ready (status={status})'}), 400

        user = User.query.get(req.user_id)
        doc_type = DocumentType.query.get(req.document_type_id)
        muni = Municipality.query.get(req.municipality_id)
        return jsonify({
            'ok': True,
            'request': {
                'id': req.id,
                'request_number': req.request_number,
                'status': req.status,
                'document': doc_type.name if doc_type else None,
                'resident': (f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}").strip() or getattr(user, 'username', 'Resident') if user else 'Resident',
            },
            'municipality': getattr(muni, 'name', None),
            'window_start': (req.qr_data or {}).get('window_start'),
            'window_end': (req.qr_data or {}).get('window_end'),
        }), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@admin_bp.route('/documents/requests/<int:request_id>/content', methods=['PUT'])
@jwt_required()
def update_document_request_content(request_id: int):
    """Update admin-edited content for a document request (purpose, remarks, civil_status)."""
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id

        req = DocumentRequest.query.get(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        if req.municipality_id != municipality_id:
            return jsonify({'error': 'Request not in your municipality'}), 403

        payload = request.get_json(silent=True) or {}
        allowed_keys = {'purpose', 'remarks', 'civil_status', 'age'}
        updates = {k: v for k, v in payload.items() if k in allowed_keys}

        # Merge with existing admin_edited_content
        base = req.admin_edited_content or {}
        if not isinstance(base, dict):
            base = {}
        for k, v in updates.items():
            base[k] = v
        req.admin_edited_content = base

        # Do not alter original columns; admin edits are applied during generation
        req.updated_at = datetime.utcnow()
        db.session.commit()

        # Audit (best-effort)
        try:
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=req.municipality_id,
                entity_type='document_request',
                entity_id=req.id,
                action='edit_content',
                actor_role='admin',
                old_values=None,
                new_values={k: updates.get(k) for k in ['purpose','remarks','civil_status','age'] if k in updates},
                notes=None,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({'message': 'Content updated', 'request': req.to_dict(include_user=True, include_audit=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update request content', 'details': str(e)}), 500


@admin_bp.route('/municipalities/performance', methods=['GET'])
@jwt_required()
def admin_municipality_performance():
    """If admin is province-level (role 'admin'), return multiple municipalities; otherwise return current only."""
    try:
        verify_jwt_in_request()
        claims = get_jwt() or {}
        role = claims.get('role')
        current_id = get_admin_municipality_id()
        if not current_id:
            return jsonify({'error': 'Admin access required'}), 403

        range_param = request.args.get('range', 'last_30_days')
        start, end = _parse_range(range_param)

        def build_perf(m_id: int):
            users = User.query.filter(and_(User.municipality_id == m_id, User.role == 'resident', User.admin_verified == True, User.is_active == True)).count()
            listings = MarketplaceItem.query.filter(and_(MarketplaceItem.municipality_id == m_id, MarketplaceItem.created_at >= start, MarketplaceItem.created_at <= end)).count()
            docs = DocumentRequest.query.filter(and_(DocumentRequest.municipality_id == m_id, DocumentRequest.created_at >= start, DocumentRequest.created_at <= end)).count()
            benefits_active = 0
            disputes_opened = 0
            try:
                benefits_active = BenefitProgram.query.filter(and_(BenefitProgram.municipality_id == m_id, BenefitProgram.is_active == True)).count()
            except Exception:
                pass
            try:
                disputes_opened = MarketplaceTransaction.query.filter(and_(MarketplaceTransaction.status == 'disputed', MarketplaceTransaction.created_at >= start, MarketplaceTransaction.created_at <= end)).count()
            except Exception:
                pass
            name = (Municipality.query.get(m_id).name if Municipality.query.get(m_id) else f"Municipality {m_id}")
            return {'id': m_id, 'name': name, 'users': users, 'listings': listings, 'documents': docs, 'benefits_active': benefits_active, 'disputes': disputes_opened}

        if role == 'superadmin':
            # Province-level: return top N municipalities by activity
            ids = [m.id for m in Municipality.query.all()]
            data = [build_perf(mid) for mid in ids]
        else:
            data = [build_perf(current_id)]

        return jsonify({'municipalities': data}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get municipality performance', 'details': str(e)}), 500


# Marketplace Transactions (Admin)
@admin_bp.route('/transactions', methods=['GET'])
@jwt_required()
def admin_list_transactions():
    """List marketplace transactions with basic filters (status, date)."""
    try:
        # Province-level admins can view all; municipal_admins scoped to municipality
        municipality_id = get_admin_municipality_id()
        status = (request.args.get('status') or '').strip() or None
        page = request.args.get('page', type=int) or 1
        per_page = min(request.args.get('per_page', type=int) or 20, 100)

        q = MarketplaceTransaction.query
        if municipality_id:
            # Scope by items in municipality
            q = q.join(MarketplaceItem, MarketplaceItem.id == MarketplaceTransaction.item_id).filter(MarketplaceItem.municipality_id == municipality_id)
        if status:
            q = q.filter(MarketplaceTransaction.status == status)
        q = q.order_by(MarketplaceTransaction.created_at.desc())
        p = q.paginate(page=page, per_page=per_page, error_out=False)

        rows = []
        for t in p.items:
            d = t.to_dict()
            try:
                item = MarketplaceItem.query.get(t.item_id)
                d['item_title'] = getattr(item, 'title', None)
            except Exception:
                d['item_title'] = None
            # Attach buyer/seller display names and photos (best-effort)
            try:
                buyer = User.query.get(t.buyer_id)
                seller = User.query.get(t.seller_id)
                d['buyer_name'] = (f"{getattr(buyer,'first_name','')} {getattr(buyer,'last_name','')}").strip() or getattr(buyer,'username', None) or str(t.buyer_id)
                d['seller_name'] = (f"{getattr(seller,'first_name','')} {getattr(seller,'last_name','')}").strip() or getattr(seller,'username', None) or str(t.seller_id)
                d['buyer_profile_picture'] = getattr(buyer, 'profile_picture', None)
                d['seller_profile_picture'] = getattr(seller, 'profile_picture', None)
            except Exception:
                d['buyer_name'] = str(t.buyer_id)
                d['seller_name'] = str(t.seller_id)
            rows.append(d)

        return jsonify({'transactions': rows, 'total': p.total, 'page': p.page, 'pages': p.pages, 'per_page': p.per_page}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to list transactions', 'details': str(e)}), 500


# Admin Audit Log Listing
@admin_bp.route('/audit', methods=['GET'])
@jwt_required()
def admin_list_audit():
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id
        q = AuditLog.query.filter(AuditLog.municipality_id == municipality_id)
        entity_type = request.args.get('entity_type')
        entity_id = request.args.get('entity_id')
        actor_role = request.args.get('actor_role')
        action = request.args.get('action')
        from_date = request.args.get('from')
        to_date = request.args.get('to')
        if entity_type:
            q = q.filter(AuditLog.entity_type == entity_type)
        if entity_id:
            try:
                q = q.filter(AuditLog.entity_id == int(entity_id))
            except Exception:
                pass
        if actor_role:
            q = q.filter(AuditLog.actor_role == actor_role)
        if action:
            q = q.filter(AuditLog.action == action)
        if from_date:
            try:
                q = q.filter(AuditLog.created_at >= datetime.fromisoformat(from_date))
            except Exception:
                pass
        if to_date:
            try:
                q = q.filter(AuditLog.created_at <= datetime.fromisoformat(to_date))
            except Exception:
                pass
        page = int(request.args.get('page', 1))
        per_page = min(100, int(request.args.get('per_page', 20)))
        p = q.order_by(AuditLog.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({'logs': [l.to_dict() for l in p.items], 'page': p.page, 'pages': p.pages, 'per_page': p.per_page, 'total': p.total}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to list audit logs', 'details': str(e)}), 500


# Admin Audit Meta (distinct filters)
@admin_bp.route('/audit/meta', methods=['GET'])
@jwt_required()
def admin_audit_meta():
    try:
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id
        # Distinct entity types and actions scoped to municipality
        et_rows = db.session.query(AuditLog.entity_type).filter(AuditLog.municipality_id == municipality_id).distinct().all()
        ac_rows = db.session.query(AuditLog.action).filter(AuditLog.municipality_id == municipality_id).distinct().all()
        entity_types = [r[0] for r in et_rows if r and r[0]]
        actions = [r[0] for r in ac_rows if r and r[0]]
        roles = ['superadmin', 'municipal_admin', 'resident', 'system']
        return jsonify({'entity_types': entity_types, 'actions': actions, 'actor_roles': roles}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to load audit meta', 'details': str(e)}), 500


# Admin Export endpoints (generic handler)
@admin_bp.route('/exports/<string:entity>.<string:fmt>', methods=['POST'])
@jwt_required()
def admin_export_entity(entity: str, fmt: str):
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = require_admin_municipality()
        if isinstance(municipality_id, tuple):
            return municipality_id
        # Resolve municipality name/slug
        muni = Municipality.query.get(municipality_id)
        municipality_name = getattr(muni, 'name', 'Municipality')
        muni_slug = getattr(muni, 'slug', str(municipality_id))

        filters = request.get_json(silent=True) or {}
        range_param = filters.get('range')
        start, end = _parse_range(range_param or 'last_30_days')

        headers = []
        rows = []

        # Build dataset by entity
        et = entity.lower()
        now = datetime.utcnow()
        if et == 'users':
            users = User.query.filter(and_(User.municipality_id == municipality_id, User.role == 'resident')).all()
            headers = ['ID','Name','Email','Phone','Verified','Joined']
            for u in users:
                name = f"{getattr(u,'first_name','') or ''} {getattr(u,'last_name','') or ''}".strip() or getattr(u,'username','')
                rows.append([u.id, name, getattr(u,'email',''), getattr(u,'phone_number',''), 'Yes' if getattr(u,'admin_verified',False) else 'No', (u.created_at.isoformat()[:10] if getattr(u,'created_at',None) else '')])
        elif et == 'benefits':
            items = BenefitProgram.query.filter(BenefitProgram.municipality_id == municipality_id).all()
            headers = ['ID','Name','Active','Created']
            rows = [[b.id, getattr(b,'name',''), 'Yes' if getattr(b,'is_active',False) else 'No', (b.created_at.isoformat()[:10] if getattr(b,'created_at',None) else '')] for b in items]
        elif et == 'requests':
            items = DocumentRequest.query.filter(and_(DocumentRequest.municipality_id == municipality_id, DocumentRequest.created_at >= start, DocumentRequest.created_at <= end)).all()
            headers = ['ID','Req No','User','Type','Status','Created']
            for r in items:
                user = User.query.get(r.user_id)
                name = f"{getattr(user,'first_name','') or ''} {getattr(user,'last_name','') or ''}".strip() or getattr(user,'username','')
                rows.append([r.id, r.request_number, name, getattr(r.document_type,'name',None) if hasattr(r,'document_type') else '', r.status, (r.created_at.isoformat()[:19].replace('T',' ') if r.created_at else '')])
        elif et == 'issues':
            items = Issue.query.filter(Issue.municipality_id == municipality_id).all()
            headers = ['ID','Title','Status','Created']
            rows = [[i.id, i.title, i.status, (i.created_at.isoformat()[:19].replace('T',' ') if i.created_at else '')] for i in items]
        elif et == 'items':
            items = MarketplaceItem.query.filter(MarketplaceItem.municipality_id == municipality_id).all()
            headers = ['ID','Title','Status','Created']
            rows = [[i.id, i.title, i.status, (i.created_at.isoformat()[:19].replace('T',' ') if i.created_at else '')] for i in items]
        elif et == 'announcements':
            items = _announcement_query_for_staff(ctx).all()
            headers = ['ID','Title','Scope','Status','Active Now','Created','Publish At','Expire At']
            for a in items:
                is_active_now = (a.status or '').upper() == 'PUBLISHED' and (not a.publish_at or a.publish_at <= now) and (not a.expire_at or a.expire_at > now)
                rows.append([
                    a.id,
                    a.title,
                    a.scope,
                    (a.status or '').upper(),
                    'Yes' if is_active_now else 'No',
                    (a.created_at.isoformat()[:10] if getattr(a,'created_at',None) else ''),
                    (a.publish_at.isoformat()[:10] if getattr(a,'publish_at',None) else ''),
                    (a.expire_at.isoformat()[:10] if getattr(a,'expire_at',None) else ''),
                ])
        elif et == 'audit':
            items = AuditLog.query.filter(AuditLog.municipality_id == municipality_id).order_by(AuditLog.created_at.desc()).limit(1000).all()
            headers = ['Time','Actor','Role','Entity','Entity ID','Action']
            rows = [[(l.created_at.isoformat()[:19].replace('T',' ') if l.created_at else ''), l.user_id, l.actor_role, l.entity_type, l.entity_id, l.action] for l in items]
        else:
            return jsonify({'error': 'Unknown export entity'}), 400

        from pathlib import Path
        base = Path(current_app.config.get('UPLOAD_FOLDER', 'uploads'))
        out_dir = base / 'exports' / str(muni_slug)
        out_dir.mkdir(parents=True, exist_ok=True)
        filename_base = f"{et}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"

        if fmt.lower() == 'pdf':
            from utils.pdf_table_report import generate_table_pdf
            out_path = out_dir / f"{filename_base}.pdf"
            generate_table_pdf(out_path=out_path, title=f"{municipality_name} – {et.title()} Report", municipality_name=municipality_name, headers=headers, rows=rows)
            rel = str(out_path.relative_to(base)).replace('\\','/')
            return jsonify({'url': rel, 'summary': {'rows': len(rows)}}), 200
        if fmt.lower() in ('xlsx','excel'):
            from utils.excel_generator import generate_workbook, save_workbook
            out_path = out_dir / f"{filename_base}.xlsx"
            gov_lines = [
                'Republic of the Philippines',
                'Province of Zambales',
                f'Municipality of {municipality_name}',
                'Office of the Municipal Mayor',
            ]
            wb = generate_workbook({
                et.title(): {
                    'headers': headers,
                    'rows': rows,
                    'municipality_name': municipality_name,
                    'title': f'{municipality_name} – {et.title()} Report',
                    'gov_lines': gov_lines,
                }
            })
            save_workbook(wb, out_path)
            rel = str(out_path.relative_to(base)).replace('\\','/')
            return jsonify({'url': rel, 'summary': {'rows': len(rows)}}), 200

        return jsonify({'error': 'Unsupported format'}), 400
    except Exception as e:
        return jsonify({'error': 'Failed to export', 'details': str(e)}), 500


@admin_bp.route('/cleanup', methods=['POST'])
@jwt_required()
def admin_cleanup():
    try:
        ctx = _get_staff_context()
        if not ctx:
            return jsonify({'error': 'Admin access required'}), 403
        municipality_id = ctx.get('municipality_id')
        payload = request.get_json(silent=True) or {}
        entity = (payload.get('entity') or '').lower()
        confirm = payload.get('confirm')
        archive = bool(payload.get('archive'))
        before = payload.get('before')
        if confirm != 'DELETE':
            return jsonify({'error': 'Confirmation required'}), 400

        cutoff = None
        try:
            if before:
                cutoff = datetime.fromisoformat(before)
        except Exception:
            cutoff = None

        deleted = 0
        archived_url = None

        from pathlib import Path
        base = Path(current_app.config.get('UPLOAD_FOLDER', 'uploads'))
        out_dir = base / 'archives'
        out_dir.mkdir(parents=True, exist_ok=True)

        def _write_json(path, items):
            import json
            path.write_text(json.dumps(items, default=str, ensure_ascii=False, indent=2), encoding='utf-8')

        if entity == 'announcements':
            q = _announcement_query_for_staff(ctx)
            if cutoff:
                q = q.filter(Announcement.created_at <= cutoff)
            items = q.all()
            if archive and items:
                muni_fragment = str(ctx.get('municipality_id') or 'province')
                zpath = out_dir / f"announcements-{muni_fragment}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
                _write_json(zpath, [getattr(i,'to_dict',lambda: {})() if hasattr(i,'to_dict') else {'id': i.id, 'title': i.title} for i in items])
                archived_url = str(zpath.relative_to(base)).replace('\\','/')
            for i in items:
                db.session.delete(i)
            deleted = len(items)
        elif entity == 'requests':
            if not municipality_id:
                return jsonify({'error': 'Municipality scope required for this cleanup'}), 403
            q = DocumentRequest.query.filter(DocumentRequest.municipality_id == municipality_id)
            if cutoff:
                q = q.filter(DocumentRequest.created_at <= cutoff)
            items = q.all()
            if archive and items:
                zpath = out_dir / f"requests-{municipality_id}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
                _write_json(zpath, [r.to_dict() for r in items])
                archived_url = str(zpath.relative_to(base)).replace('\\','/')
            for i in items:
                db.session.delete(i)
            deleted = len(items)
        else:
            return jsonify({'error': 'Unsupported entity for cleanup'}), 400

        db.session.commit()

        try:
            log_generic_action(
                user_id=get_jwt_identity(),
                municipality_id=municipality_id,
                entity_type=entity,
                entity_id=None,
                action='cleanup_delete',
                actor_role='admin',
                old_values=None,
                new_values={'deleted': deleted, 'before': before},
                notes='Archive saved' if archived_url else None,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({'deleted_count': deleted, 'archived_url': archived_url}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to cleanup', 'details': str(e)}), 500


@admin_bp.route('/transactions/<int:tx_id>', methods=['GET'])
@jwt_required()
def admin_get_transaction(tx_id: int):
    try:
        municipality_id = get_admin_municipality_id()
        tx = MarketplaceTransaction.query.get(tx_id)
        if not tx:
            return jsonify({'error': 'Transaction not found'}), 404
        if municipality_id:
            item = MarketplaceItem.query.get(tx.item_id)
            if not item or int(item.municipality_id) != int(municipality_id):
                return jsonify({'error': 'Transaction not in your municipality'}), 403
        # Build enriched transaction payload with buyer/seller names
        txd = tx.to_dict()
        try:
            buyer = User.query.get(tx.buyer_id)
            seller = User.query.get(tx.seller_id)
            txd['buyer'] = {
                'id': tx.buyer_id,
                'first_name': getattr(buyer, 'first_name', None),
                'last_name': getattr(buyer, 'last_name', None),
                'username': getattr(buyer, 'username', None),
                'email': getattr(buyer, 'email', None),
                'profile_picture': getattr(buyer, 'profile_picture', None),
            }
            txd['seller'] = {
                'id': tx.seller_id,
                'first_name': getattr(seller, 'first_name', None),
                'last_name': getattr(seller, 'last_name', None),
                'username': getattr(seller, 'username', None),
                'email': getattr(seller, 'email', None),
                'profile_picture': getattr(seller, 'profile_picture', None),
            }
            txd['buyer_name'] = (f"{getattr(buyer,'first_name','')} {getattr(buyer,'last_name','')}").strip() or getattr(buyer, 'username', None)
            txd['seller_name'] = (f"{getattr(seller,'first_name','')} {getattr(seller,'last_name','')}").strip() or getattr(seller, 'username', None)
            txd['buyer_profile_picture'] = getattr(buyer, 'profile_picture', None)
            txd['seller_profile_picture'] = getattr(seller, 'profile_picture', None)
        except Exception:
            pass

        audit = []
        try:
            audit = [l.to_dict() for l in MarketplaceTransactionAuditLog.query.filter_by(transaction_id=tx.id).order_by(MarketplaceTransactionAuditLog.created_at.asc()).all()]
        except Exception:
            audit = []
        return jsonify({'transaction': txd, 'audit': audit}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get transaction', 'details': str(e)}), 500


@admin_bp.route('/transactions/<int:tx_id>/status', methods=['PUT'])
@jwt_required()
def admin_update_transaction_status(tx_id: int):
    """Mark a disputed transaction under_review/resolved/confirmed_scam. Stores as audit metadata."""
    try:
        municipality_id = get_admin_municipality_id()
        tx = MarketplaceTransaction.query.get(tx_id)
        if not tx:
            return jsonify({'error': 'Transaction not found'}), 404
        if municipality_id:
            item = MarketplaceItem.query.get(tx.item_id)
            if not item or int(item.municipality_id) != int(municipality_id):
                return jsonify({'error': 'Transaction not in your municipality'}), 403

        payload = request.get_json(silent=True) or {}
        new_status = (payload.get('status') or '').lower()
        notes = payload.get('notes')
        if new_status not in ('under_review', 'resolved', 'confirmed_scam'):
            return jsonify({'error': 'Invalid status'}), 400

        # Audit-only status marker; we do not change core tx.status except optionally when resolved
        meta = {'admin_status': new_status}
        if new_status == 'resolved' and tx.status == 'disputed':
            prev = tx.status
            tx.status = 'accepted'  # rollback to pre-dispute neutral state
            tx.updated_at = datetime.utcnow()
            db.session.add(tx)
            # Also add audit row for resolution of dispute
            al = MarketplaceTransactionAuditLog(
                transaction_id=tx.id,
                actor_id=int(get_jwt_identity()),
                actor_role='admin',
                action='admin_resolution',
                from_status=prev,
                to_status=tx.status,
                notes=notes,
                metadata_json=meta,
                created_at=datetime.utcnow(),
            )
            db.session.add(al)
        else:
            al = MarketplaceTransactionAuditLog(
                transaction_id=tx.id,
                actor_id=int(get_jwt_identity()),
                actor_role='admin',
                action='admin_status',
                from_status=tx.status,
                to_status=tx.status,
                notes=notes,
                metadata_json=meta,
                created_at=datetime.utcnow(),
            )
            db.session.add(al)

        db.session.commit()
        return jsonify({'message': 'Admin status recorded'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update transaction status', 'details': str(e)}), 500
