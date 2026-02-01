"""Refresh token tracking for token rotation and theft detection.

This module implements secure refresh token handling with:
- Token rotation: Each refresh generates a new refresh token
- Family tracking: Tokens are grouped by login session
- Theft detection: Reuse of old tokens invalidates entire family

Security model:
1. On login: Create new token family, issue refresh token
2. On refresh: Issue new refresh token, invalidate old one, keep family
3. On reuse detection: Invalidate entire family (potential theft)
4. On logout: Invalidate token and optionally entire family
"""
from datetime import datetime
try:
    from __init__ import db
except ImportError:
    from __init__ import db
from sqlalchemy import Index
import uuid


class RefreshTokenFamily(db.Model):
    """Tracks a family of refresh tokens for a user session.
    
    A family is created on login and persists until logout or theft detection.
    All refresh tokens in a family share the same family_id.
    """
    __tablename__ = 'refresh_token_families'
    
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    invalidated_reason = db.Column(db.String(50), nullable=True)  # 'logout', 'theft_detected', 'expired', 'manual'
    
    # Device/session info (optional, for debugging)
    user_agent = db.Column(db.String(500), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used_at = db.Column(db.DateTime, default=datetime.utcnow)
    invalidated_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='token_families')
    tokens = db.relationship('RefreshToken', back_populates='family', cascade='all, delete-orphan')
    
    __table_args__ = (
        Index('idx_rtf_user', 'user_id'),
        Index('idx_rtf_family', 'family_id'),
        Index('idx_rtf_active', 'is_active'),
    )
    
    def invalidate(self, reason: str = 'manual'):
        """Invalidate this token family and all its tokens."""
        self.is_active = False
        self.invalidated_reason = reason
        self.invalidated_at = datetime.utcnow()
        
        # Invalidate all tokens in this family
        for token in self.tokens:
            if not token.is_revoked:
                token.is_revoked = True
                token.revoked_at = datetime.utcnow()
                token.revoked_reason = f'family_{reason}'
    
    @classmethod
    def create_family(cls, user_id: int, user_agent: str = None, ip_address: str = None):
        """Create a new token family for a user session."""
        family = cls(
            user_id=user_id,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.session.add(family)
        return family
    
    @classmethod
    def invalidate_all_for_user(cls, user_id: int, reason: str = 'logout_all'):
        """Invalidate all token families for a user (logout from all devices)."""
        families = cls.query.filter_by(user_id=user_id, is_active=True).all()
        for family in families:
            family.invalidate(reason)


class RefreshToken(db.Model):
    """Individual refresh token within a family.
    
    Each token can only be used once. Using an already-used token
    triggers theft detection and invalidates the entire family.
    """
    __tablename__ = 'refresh_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), unique=True, nullable=False)  # JWT ID from the token
    family_id = db.Column(db.Integer, db.ForeignKey('refresh_token_families.id'), nullable=False)
    
    # Token lifecycle
    is_revoked = db.Column(db.Boolean, default=False)
    is_used = db.Column(db.Boolean, default=False)  # True after token is used to refresh
    revoked_reason = db.Column(db.String(50), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    family = db.relationship('RefreshTokenFamily', back_populates='tokens')
    
    __table_args__ = (
        Index('idx_rt_jti', 'jti'),
        Index('idx_rt_family', 'family_id'),
        Index('idx_rt_expires', 'expires_at'),
    )
    
    def mark_used(self):
        """Mark token as used (after successful refresh)."""
        self.is_used = True
        self.used_at = datetime.utcnow()
        # Update family last_used_at
        if self.family:
            self.family.last_used_at = datetime.utcnow()
    
    def revoke(self, reason: str = 'manual'):
        """Revoke this specific token."""
        self.is_revoked = True
        self.revoked_at = datetime.utcnow()
        self.revoked_reason = reason
    
    @classmethod
    def create_token(cls, jti: str, family: RefreshTokenFamily, expires_at: datetime):
        """Create a new refresh token in a family."""
        token = cls(
            jti=jti,
            family_id=family.id,
            expires_at=expires_at,
        )
        db.session.add(token)
        return token
    
    @classmethod
    def find_by_jti(cls, jti: str):
        """Find a refresh token by its JTI."""
        return cls.query.filter_by(jti=jti).first()
    
    @classmethod
    def is_token_valid(cls, jti: str) -> tuple:
        """
        Check if a token is valid for use.
        
        Returns:
            (is_valid, error_reason, token_obj)
        """
        token = cls.find_by_jti(jti)
        
        if not token:
            return False, 'not_found', None
        
        if token.is_revoked:
            return False, 'revoked', token
        
        if token.expires_at < datetime.utcnow():
            return False, 'expired', token
        
        if not token.family or not token.family.is_active:
            return False, 'family_invalid', token
        
        # CRITICAL: Check if token was already used (theft detection)
        if token.is_used:
            # Token reuse detected! This could be token theft.
            # Invalidate the entire family to protect the user.
            if token.family:
                token.family.invalidate('theft_detected')
            db.session.commit()
            return False, 'reuse_detected', token
        
        return True, None, token
    
    @classmethod
    def cleanup_expired(cls):
        """Remove expired tokens older than 30 days."""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=30)
        cls.query.filter(cls.expires_at < cutoff).delete()
        db.session.commit()

