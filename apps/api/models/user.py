"""User model for authentication and profile management."""
from datetime import datetime
from apps.api.utils.time import utc_now, utc_today
try:
    from apps.api import db
except ImportError:
    from apps.api import db
from sqlalchemy import Index

class User(db.Model):
    __tablename__ = 'users'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Authentication
    username = db.Column(db.String(30), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Profile Information
    first_name = db.Column(db.String(50), nullable=False)
    middle_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=False)
    suffix = db.Column(db.String(10), nullable=True)
    
    # Location (required for residents)
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=True)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    
    # Contact
    phone_number = db.Column(db.String(15), nullable=True)
    mobile_number = db.Column(db.String(20), nullable=True)
    notify_email_enabled = db.Column(db.Boolean, default=True, nullable=False)
    notify_sms_enabled = db.Column(db.Boolean, default=False, nullable=False)
    
    # Birth Information
    date_of_birth = db.Column(db.Date, nullable=True)
    
    # Role and Verification Status
    role = db.Column(db.String(20), default='resident')  # public, resident, municipal_admin
    email_verified = db.Column(db.Boolean, default=False)
    admin_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    
    # Profile Picture
    profile_picture = db.Column(db.String(255), nullable=True)
    
    # Verification Documents (stored paths)
    valid_id_front = db.Column(db.String(255), nullable=True)
    valid_id_back = db.Column(db.String(255), nullable=True)
    proof_of_residency = db.Column(db.String(255), nullable=True)
    selfie_with_id = db.Column(db.String(255), nullable=True)
    
    # Admin-specific fields
    admin_municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=True)
    admin_barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)

    # Permissions (JSON array of permission strings)
    permissions = db.Column(db.JSON, nullable=True, default=list)

    # Account creation tracking
    created_via = db.Column(db.String(50), nullable=True)  # 'setup_script', 'admin_panel', 'self_registration'

    # Timestamps
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    email_verified_at = db.Column(db.DateTime, nullable=True)
    admin_verified_at = db.Column(db.DateTime, nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    municipality = db.relationship('Municipality', foreign_keys=[municipality_id], backref='residents')
    barangay = db.relationship('Barangay', foreign_keys=[barangay_id], backref='residents')
    admin_municipality = db.relationship('Municipality', foreign_keys=[admin_municipality_id], backref='admins')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_username', 'username'),
        Index('idx_user_municipality', 'municipality_id'),
        Index('idx_user_role', 'role'),
    )
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def to_dict(self, include_sensitive=False, include_municipality=False):
        """Convert user to dictionary."""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email if include_sensitive else None,
            'first_name': self.first_name,
            'middle_name': self.middle_name,
            'last_name': self.last_name,
            'suffix': self.suffix,
            'municipality_id': self.municipality_id,
            'barangay_id': self.barangay_id,
            'admin_municipality_id': self.admin_municipality_id,
            'admin_barangay_id': self.admin_barangay_id,
            'phone_number': self.phone_number if include_sensitive else None,
            'mobile_number': self.mobile_number if include_sensitive else None,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'role': self.role,
            'email_verified': self.email_verified,
            'admin_verified': self.admin_verified,
            'is_active': self.is_active,
            'profile_picture': self.profile_picture,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'notify_email_enabled': bool(self.notify_email_enabled if self.notify_email_enabled is not None else True),
            'notify_sms_enabled': bool(self.notify_sms_enabled if self.notify_sms_enabled is not None else False),
        }
        # Include verification files for privileged contexts
        if include_sensitive:
            if self.valid_id_front is not None:
                data['valid_id_front'] = self.valid_id_front
            if self.valid_id_back is not None:
                data['valid_id_back'] = self.valid_id_back
            if self.selfie_with_id is not None:
                data['selfie_with_id'] = self.selfie_with_id
            if self.proof_of_residency is not None:
                data['proof_of_residency'] = self.proof_of_residency
            # Include permissions for admin users
            data['permissions'] = self.permissions or []
        
        # Add municipality data if requested
        if include_municipality and self.municipality:
            data['municipality_name'] = self.municipality.name
            data['municipality_slug'] = self.municipality.slug
            # Include province name for easier frontend access
            if self.municipality.province:
                data['province_name'] = self.municipality.province.name
                data['province_slug'] = self.municipality.province.slug
        if include_municipality and self.barangay:
            data['barangay_name'] = self.barangay.name
            data['barangay_slug'] = self.barangay.slug
        
        # Add admin municipality data if user is admin
        if include_municipality and self.admin_municipality:
            data['admin_municipality_name'] = self.admin_municipality.name
            data['admin_municipality_slug'] = self.admin_municipality.slug
        
        return {k: v for k, v in data.items() if v is not None or include_sensitive}
    
    def is_under_18(self):
        """Check if user is under 18 years old."""
        if not self.date_of_birth:
            return True  # Default to restricted if DOB not provided
        
        today = utc_today()
        age = today.year - self.date_of_birth.year
        if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
            age -= 1
        return age < 18
    
    def get_access_level(self):
        """Get user's access level based on verification status."""
        if self.role == 'municipal_admin':
            return 'admin'
        elif self.role == 'public':
            return 'public'
        elif self.is_under_18():
            return 'resident_under_18'
        elif self.email_verified and not self.admin_verified:
            return 'resident_email_verified'
        elif self.admin_verified:
            return 'resident_fully_verified'
        else:
            return 'resident_unverified'

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission."""
        if not self.permissions:
            return False
        # Superadmin wildcard
        if '*' in self.permissions:
            return True
        return permission in self.permissions
