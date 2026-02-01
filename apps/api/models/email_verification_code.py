"""Email verification code model for 2FA and email verification.

Used for:
- Super admin login 2FA
- Future: password reset codes
- Future: email change verification
"""
from datetime import datetime, timedelta
import secrets

try:
    from __init__ import db
except ImportError:
    from __init__ import db

from sqlalchemy import Index


class EmailVerificationCode(db.Model):
    __tablename__ = 'email_verification_codes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    code = db.Column(db.String(6), nullable=False)
    purpose = db.Column(db.String(50), nullable=False)  # '2fa_login', 'password_reset', 'email_change'

    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)

    # For 2FA, track the temporary session
    session_id = db.Column(db.String(64), nullable=True, unique=True)

    # Track attempts for rate limiting
    attempts = db.Column(db.Integer, default=0, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', backref=db.backref('verification_codes', lazy='dynamic'))

    __table_args__ = (
        Index('idx_verification_code_user', 'user_id'),
        Index('idx_verification_code_session', 'session_id'),
        Index('idx_verification_code_lookup', 'code', 'used'),
    )

    def __repr__(self):
        return f'<EmailVerificationCode {self.id} for user {self.user_id}>'

    def is_expired(self) -> bool:
        """Check if the code has expired."""
        return datetime.utcnow() > self.expires_at

    def is_valid(self) -> bool:
        """Check if the code is still valid (not used and not expired)."""
        return not self.used and not self.is_expired()

    def mark_used(self):
        """Mark the code as used."""
        self.used = True
        db.session.commit()

    def increment_attempts(self):
        """Increment the attempt counter."""
        self.attempts += 1
        db.session.commit()

    def to_dict(self):
        """Serialize for debugging/admin purposes."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'purpose': self.purpose,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'used': self.used,
            'attempts': self.attempts,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @staticmethod
    def generate_code() -> str:
        """Generate a cryptographically secure 6-digit code."""
        return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    @staticmethod
    def generate_session_id() -> str:
        """Generate a secure session ID for 2FA flow."""
        return secrets.token_hex(32)

    @classmethod
    def create_for_user(
        cls,
        user_id: int,
        purpose: str,
        expiry_minutes: int = 10
    ) -> 'EmailVerificationCode':
        """
        Create a new verification code for a user.

        Args:
            user_id: The user ID
            purpose: The purpose of the code ('2fa_login', 'password_reset', etc.)
            expiry_minutes: How many minutes until the code expires

        Returns:
            The created EmailVerificationCode instance
        """
        # Invalidate any existing unused codes for this user and purpose
        cls.query.filter_by(
            user_id=user_id,
            purpose=purpose,
            used=False
        ).update({'used': True})
        db.session.commit()

        code = cls(
            user_id=user_id,
            code=cls.generate_code(),
            purpose=purpose,
            session_id=cls.generate_session_id() if purpose == '2fa_login' else None,
            expires_at=datetime.utcnow() + timedelta(minutes=expiry_minutes)
        )
        db.session.add(code)
        db.session.commit()
        return code

    @classmethod
    def verify(
        cls,
        session_id: str,
        code: str,
        purpose: str = '2fa_login',
        max_attempts: int = 3
    ) -> tuple[bool, str, 'EmailVerificationCode | None']:
        """
        Verify a code for a given session.

        Args:
            session_id: The session ID from the login attempt
            code: The 6-digit code entered by the user
            purpose: The purpose of the code
            max_attempts: Maximum number of verification attempts

        Returns:
            Tuple of (success, error_message, verification_code_instance)
        """
        verification = cls.query.filter_by(
            session_id=session_id,
            purpose=purpose,
            used=False
        ).first()

        if not verification:
            return False, 'Invalid or expired session', None

        if verification.is_expired():
            return False, 'Code has expired', None

        if verification.attempts >= max_attempts:
            verification.mark_used()
            return False, 'Too many failed attempts', None

        if verification.code != code:
            verification.increment_attempts()
            remaining = max_attempts - verification.attempts
            if remaining > 0:
                return False, f'Invalid code. {remaining} attempts remaining', None
            else:
                verification.mark_used()
                return False, 'Too many failed attempts', None

        # Success - mark as used
        verification.mark_used()
        return True, '', verification
