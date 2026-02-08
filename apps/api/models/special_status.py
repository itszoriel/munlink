"""User special status model for Student, PWD, and Senior citizen status tracking."""
from datetime import datetime
from apps.api.utils.time import utc_now
try:
    from apps.api import db
except ImportError:
    from apps.api import db
from sqlalchemy import Index


class UserSpecialStatus(db.Model):
    """
    Track special statuses (Student, PWD, Senior) for users with approval workflow.

    - Students: Auto-expire at semester end (fallback to 6 months), require school enrollment docs
    - PWD: Permanent once approved, require PWD ID
    - Senior: Permanent once approved, require Senior Citizen ID

    Multiple statuses allowed per user (e.g., Student + PWD).
    """
    __tablename__ = 'user_special_statuses'

    # Primary Key
    id = db.Column(db.Integer, primary_key=True)

    # User who applied for status
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Type of special status: 'student', 'pwd', 'senior'
    status_type = db.Column(db.String(20), nullable=False)

    # Application status: 'pending', 'approved', 'rejected', 'expired', 'revoked'
    status = db.Column(db.String(20), default='pending', nullable=False)

    # Common Fields
    id_number = db.Column(db.String(50), nullable=True)  # Student ID, PWD ID, or Senior ID number

    # Student-specific fields
    school_name = db.Column(db.String(200), nullable=True)
    semester_start = db.Column(db.Date, nullable=True)
    semester_end = db.Column(db.Date, nullable=True)
    student_id_path = db.Column(db.String(255), nullable=True)  # Path to uploaded student ID image
    cor_path = db.Column(db.String(255), nullable=True)  # Path to Certificate of Registration

    # PWD-specific fields
    pwd_id_path = db.Column(db.String(255), nullable=True)  # Path to PWD ID image
    disability_type = db.Column(db.String(100), nullable=True)  # Type of disability

    # Senior-specific fields
    senior_id_path = db.Column(db.String(255), nullable=True)  # Path to Senior Citizen ID image

    # Approval tracking
    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)

    # Expiry - Only applicable for students (semester end or fallback)
    expires_at = db.Column(db.DateTime, nullable=True)

    # Rejection/Revocation details
    rejection_reason = db.Column(db.Text, nullable=True)
    revoked_reason = db.Column(db.Text, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)
    revoked_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='special_statuses')
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    revoked_by = db.relationship('User', foreign_keys=[revoked_by_id])

    # Indexes
    __table_args__ = (
        Index('idx_special_status_user', 'user_id'),
        Index('idx_special_status_type', 'status_type'),
        Index('idx_special_status_status', 'status'),
        Index('idx_special_status_expires', 'expires_at'),
    )

    def __repr__(self):
        return f'<UserSpecialStatus {self.id} user={self.user_id} type={self.status_type} status={self.status}>'

    def is_active(self) -> bool:
        """Check if this status is currently active (approved and not expired)."""
        if self.status != 'approved':
            return False

        # Students expire at semester end (or fallback expiry)
        if self.status_type == 'student':
            if self.expires_at:
                return utc_now() < self.expires_at
            if self.semester_end:
                return utc_now().date() <= self.semester_end
            # Legacy fallback: treat as active if no expiry data available
            return True

        # PWD and Senior are permanent once approved
        return True

    def to_dict(self, include_docs=False):
        """Convert special status to dictionary."""
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'status_type': self.status_type,
            'status': self.status,
            'id_number': self.id_number,
            'is_active': self.is_active(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'approved_by_id': self.approved_by_id,
        }

        # Include type-specific fields
        if self.status_type == 'student':
            data['school_name'] = self.school_name
            data['semester_start'] = self.semester_start.isoformat() if self.semester_start else None
            data['semester_end'] = self.semester_end.isoformat() if self.semester_end else None
            if include_docs:
                data['student_id_path'] = self.student_id_path
                data['cor_path'] = self.cor_path
        elif self.status_type == 'pwd':
            data['disability_type'] = self.disability_type
            if include_docs:
                data['pwd_id_path'] = self.pwd_id_path
        elif self.status_type == 'senior':
            if include_docs:
                data['senior_id_path'] = self.senior_id_path

        # Include rejection/revocation info if applicable
        if self.status == 'rejected':
            data['rejection_reason'] = self.rejection_reason
        elif self.status == 'revoked':
            data['revoked_reason'] = self.revoked_reason
            data['revoked_at'] = self.revoked_at.isoformat() if self.revoked_at else None

        return data
