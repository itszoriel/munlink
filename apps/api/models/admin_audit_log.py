"""Admin audit log model for tracking super admin actions and logins.

Separate from the general AuditLog model which requires municipality_id.
This model is specifically for:
- Super admin login attempts and successes
- Admin management actions (create, approve, reject, disable admins)
- Province-wide administrative actions
"""
from datetime import datetime
from apps.api.utils.time import utc_now

try:
    from apps.api import db
except ImportError:
    from apps.api import db

from sqlalchemy import Index


class AdminAuditLog(db.Model):
    __tablename__ = 'admin_audit_logs'

    id = db.Column(db.Integer, primary_key=True)

    # Who performed the action (nullable for failed login attempts before auth)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    admin_email = db.Column(db.String(255), nullable=False)  # Denormalized for easy viewing

    # What action was performed
    action = db.Column(db.String(100), nullable=False)

    # What was affected (optional - for actions on specific resources)
    resource_type = db.Column(db.String(50), nullable=True)  # 'user', 'announcement', 'document', etc.
    resource_id = db.Column(db.Integer, nullable=True)

    # Request context
    ip_address = db.Column(db.String(45), nullable=True)  # Supports IPv6
    user_agent = db.Column(db.Text, nullable=True)

    # Additional details (JSON for flexibility)
    details = db.Column(db.JSON, nullable=True)

    # Timestamp
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    # Relationships
    admin = db.relationship('User', backref=db.backref('admin_audit_logs', lazy='dynamic'))

    __table_args__ = (
        Index('idx_admin_audit_admin', 'admin_id'),
        Index('idx_admin_audit_action', 'action'),
        Index('idx_admin_audit_created', 'created_at'),
        Index('idx_admin_audit_resource', 'resource_type', 'resource_id'),
    )

    def __repr__(self):
        return f'<AdminAuditLog {self.id}: {self.action} by {self.admin_email}>'

    def to_dict(self):
        """Serialize for API responses."""
        return {
            'id': self.id,
            'admin_id': self.admin_id,
            'admin_email': self.admin_email,
            'admin_role': getattr(self.admin, 'role', None),
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'details': self.details,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# Action constants for consistency
class AuditAction:
    """Constants for audit log actions."""

    # Login actions
    SUPERADMIN_LOGIN_ATTEMPT = 'superadmin_login_attempt'
    SUPERADMIN_LOGIN_SUCCESS = 'superadmin_login_success'
    SUPERADMIN_LOGIN_FAILED = 'superadmin_login_failed'
    SUPERADMIN_2FA_FAILED = 'superadmin_2fa_failed'
    SUPERADMIN_LOGOUT = 'superadmin_logout'

    # Admin management actions
    ADMIN_CREATED = 'admin_created'
    ADMIN_APPROVED = 'admin_approved'
    ADMIN_REJECTED = 'admin_rejected'
    ADMIN_DISABLED = 'admin_disabled'
    ADMIN_ENABLED = 'admin_enabled'

    # Resident management actions
    RESIDENT_VERIFIED = 'resident_verified'
    RESIDENT_REJECTED = 'resident_rejected'

    # Sensitive data access
    RESIDENT_ID_VIEWED = 'resident_id_viewed'

    # Content management actions
    ANNOUNCEMENT_CREATED = 'announcement_created'
    ANNOUNCEMENT_EDITED = 'announcement_edited'
    ANNOUNCEMENT_DELETED = 'announcement_deleted'

    MARKETPLACE_APPROVED = 'marketplace_approved'
    MARKETPLACE_REJECTED = 'marketplace_rejected'

    DOCUMENT_PROCESSED = 'document_processed'

    BENEFIT_PROGRAM_CREATED = 'benefit_program_created'
    BENEFIT_PROGRAM_EDITED = 'benefit_program_edited'
    BENEFIT_PROGRAM_DELETED = 'benefit_program_deleted'

    ISSUE_STATUS_CHANGED = 'issue_status_changed'
