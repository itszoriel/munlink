"""Token blacklist for logout functionality."""
from datetime import datetime
try:
    from __init__ import db
except ImportError:
    from __init__ import db
from sqlalchemy import Index

class TokenBlacklist(db.Model):
    __tablename__ = 'token_blacklist'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Token Information
    jti = db.Column(db.String(120), unique=True, nullable=False)  # JWT ID
    token_type = db.Column(db.String(20), nullable=False)  # access or refresh
    
    # User Information
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Revocation Details
    revoked_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    # Relationships
    user = db.relationship('User', backref='revoked_tokens')
    
    # Indexes
    __table_args__ = (
        Index('idx_token_jti', 'jti'),
        Index('idx_token_user', 'user_id'),
        Index('idx_token_expires', 'expires_at'),
    )
    
    def __repr__(self):
        return f'<TokenBlacklist {self.jti}>'
    
    @classmethod
    def is_token_revoked(cls, jti):
        """Check if a token has been revoked."""
        token = cls.query.filter_by(jti=jti).first()
        return token is not None
    
    @classmethod
    def add_token_to_blacklist(cls, jti, token_type, user_id, expires_at):
        """Add a token to the blacklist."""
        blacklisted_token = cls(
            jti=jti,
            token_type=token_type,
            user_id=user_id,
            expires_at=expires_at
        )
        db.session.add(blacklisted_token)
        db.session.commit()
    
    @classmethod
    def cleanup_expired_tokens(cls):
        """Remove expired tokens from the blacklist."""
        cls.query.filter(cls.expires_at < datetime.utcnow()).delete()
        db.session.commit()

