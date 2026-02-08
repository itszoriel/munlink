"""Admin audit logging utility for tracking super admin actions.

Separate from the entity-based audit.py which requires municipality_id.
This utility is specifically for:
- Super admin login attempts and successes
- Admin management actions
- Province-wide administrative actions
"""
from flask import request, current_app

from apps.api import db
from apps.api.models.admin_audit_log import AdminAuditLog, AuditAction
from apps.api.models.user import User


def log_admin_action(
    admin_id: int = None,
    admin_email: str = None,
    action: str = None,
    resource_type: str = None,
    resource_id: int = None,
    target_type: str = None,
    target_id: int = None,
    details: dict = None,
    req=None
) -> AdminAuditLog:
    """
    Log an admin action to the audit trail.

    Args:
        admin_id: The ID of the admin performing the action (optional for failed logins)
        admin_email: The email of the admin (required)
        action: The action being performed (use AuditAction constants)
        resource_type: The type of resource being acted upon (optional)
        resource_id: The ID of the resource (optional)
        target_type: Backward-compatible alias for resource_type (optional)
        target_id: Backward-compatible alias for resource_id (optional)
        details: Additional details as a dict (optional)
        req: The Flask request object (optional, uses global request if not provided)

    Returns:
        The created AdminAuditLog instance
    """
    if not action:
        raise ValueError("action is required")

    # Get email from admin_id if not provided
    if not admin_email and admin_id:
        admin = db.session.get(User, admin_id)
        if admin:
            admin_email = admin.email

    if not admin_email:
        admin_email = 'unknown'

    # Get request context
    r = req or request
    ip_address = None
    user_agent = None

    try:
        if r:
            # Try to get real IP from proxy headers first
            ip_address = r.headers.get('X-Forwarded-For', '').split(',')[0].strip()
            if not ip_address:
                ip_address = r.headers.get('X-Real-IP')
            if not ip_address:
                ip_address = r.remote_addr
            user_agent = r.headers.get('User-Agent')
    except RuntimeError:
        # Outside request context
        pass

    # Backward compatibility for older call sites still using target_* names.
    resolved_resource_type = resource_type if resource_type is not None else target_type
    resolved_resource_id = resource_id if resource_id is not None else target_id

    log_entry = AdminAuditLog(
        admin_id=admin_id,
        admin_email=admin_email,
        action=action,
        resource_type=resolved_resource_type,
        resource_id=resolved_resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details or {}
    )

    try:
        db.session.add(log_entry)
        db.session.commit()
        current_app.logger.info(f"Audit: {action} by {admin_email} on {resolved_resource_type}:{resolved_resource_id}")
    except Exception as e:
        current_app.logger.error(f"Failed to create audit log: {e}")
        db.session.rollback()
        raise

    return log_entry


def log_superadmin_login_attempt(email: str, success: bool = True, error_reason: str = None):
    """
    Log a super admin login attempt.

    Args:
        email: The email used in the login attempt
        success: Whether the login was successful
        error_reason: The reason for failure (if not successful)
    """
    action = AuditAction.SUPERADMIN_LOGIN_ATTEMPT if not success else AuditAction.SUPERADMIN_LOGIN_SUCCESS

    details = {}
    if not success and error_reason:
        details['error'] = error_reason

    # For successful logins, get the admin_id
    admin_id = None
    if success:
        admin = User.query.filter_by(email=email).first()
        if admin:
            admin_id = admin.id

    return log_admin_action(
        admin_id=admin_id,
        admin_email=email,
        action=action,
        details=details if details else None
    )


def log_superadmin_2fa_failed(email: str, reason: str = None):
    """Log a failed 2FA verification attempt."""
    return log_admin_action(
        admin_email=email,
        action=AuditAction.SUPERADMIN_2FA_FAILED,
        details={'reason': reason} if reason else None
    )


def log_admin_approved(admin_id: int, target_user_id: int, target_email: str, target_role: str, municipality_id: int = None):
    """Log when an admin approves another admin account."""
    admin = db.session.get(User, admin_id)
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin.email if admin else 'unknown',
        action=AuditAction.ADMIN_APPROVED,
        resource_type='user',
        resource_id=target_user_id,
        details={
            'target_email': target_email,
            'target_role': target_role,
            'municipality_id': municipality_id
        }
    )


def log_admin_rejected(admin_id: int, target_user_id: int, target_email: str, reason: str = None):
    """Log when an admin rejects another admin account."""
    admin = db.session.get(User, admin_id)
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin.email if admin else 'unknown',
        action=AuditAction.ADMIN_REJECTED,
        resource_type='user',
        resource_id=target_user_id,
        details={
            'target_email': target_email,
            'reason': reason
        }
    )


def log_resident_verified(admin_id: int, resident_id: int, resident_name: str, municipality_id: int = None, barangay_id: int = None):
    """Log when an admin verifies a resident."""
    admin = db.session.get(User, admin_id)
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin.email if admin else 'unknown',
        action=AuditAction.RESIDENT_VERIFIED,
        resource_type='user',
        resource_id=resident_id,
        details={
            'resident_name': resident_name,
            'municipality_id': municipality_id,
            'barangay_id': barangay_id
        }
    )


def log_resident_rejected(admin_id: int, resident_id: int, resident_name: str, reason: str = None):
    """Log when an admin rejects a resident."""
    admin = db.session.get(User, admin_id)
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin.email if admin else 'unknown',
        action=AuditAction.RESIDENT_REJECTED,
        resource_type='user',
        resource_id=resident_id,
        details={
            'resident_name': resident_name,
            'reason': reason
        }
    )


def log_resident_id_viewed(
    admin_id: int,
    admin_email: str,
    resident_id: int,
    resident_name: str,
    document_type: str,
    reason: str,
    municipality_id: int,
    municipality_name: str,
    req=None
):
    """Log viewing of resident ID/selfie image."""
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action=AuditAction.RESIDENT_ID_VIEWED,
        resource_type='resident',
        resource_id=resident_id,
        details={
            'document_type': document_type,
            'reason': reason,
            'municipality_id': municipality_id,
            'municipality_name': municipality_name,
            'resident_name': resident_name
        },
        req=req
    )


def log_announcement_created(admin_id: int, announcement_id: int, title: str, scope: str = None, municipalities: list = None):
    """Log when an admin creates an announcement."""
    admin = db.session.get(User, admin_id)
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin.email if admin else 'unknown',
        action=AuditAction.ANNOUNCEMENT_CREATED,
        resource_type='announcement',
        resource_id=announcement_id,
        details={
            'title': title,
            'scope': scope,
            'shared_municipalities': municipalities
        }
    )


def log_announcement_deleted(admin_id: int, announcement_id: int, title: str):
    """Log when an admin deletes an announcement."""
    admin = db.session.get(User, admin_id)
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin.email if admin else 'unknown',
        action=AuditAction.ANNOUNCEMENT_DELETED,
        resource_type='announcement',
        resource_id=announcement_id,
        details={'title': title}
    )


def log_marketplace_moderated(admin_id: int, item_id: int, action_taken: str, reason: str = None):
    """Log when an admin moderates a marketplace listing."""
    admin = db.session.get(User, admin_id)
    return log_admin_action(
        admin_id=admin_id,
        admin_email=admin.email if admin else 'unknown',
        action=AuditAction.MARKETPLACE_APPROVED if action_taken == 'approved' else AuditAction.MARKETPLACE_REJECTED,
        resource_type='item',
        resource_id=item_id,
        details={
            'action': action_taken,
            'reason': reason
        }
    )


# Export commonly used items
__all__ = [
    'log_admin_action',
    'log_superadmin_login_attempt',
    'log_superadmin_2fa_failed',
    'log_admin_approved',
    'log_admin_rejected',
    'log_resident_verified',
    'log_resident_rejected',
    'log_resident_id_viewed',
    'log_announcement_created',
    'log_announcement_deleted',
    'log_marketplace_moderated',
    'AuditAction',
]
