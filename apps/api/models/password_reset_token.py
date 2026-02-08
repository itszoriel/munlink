"""Password reset token model (single-use, short-lived)."""
from datetime import datetime

from apps.api.utils.time import utc_now
try:
    from apps.api import db
except ImportError:
    from apps.api import db

from sqlalchemy import Index


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

    request_ip = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    user = db.relationship('User', backref=db.backref('password_reset_tokens', lazy='dynamic'))

    __table_args__ = (
        Index('idx_password_reset_user', 'user_id'),
        Index('idx_password_reset_token', 'token_hash'),
        Index('idx_password_reset_expires', 'expires_at'),
    )

    def is_expired(self) -> bool:
        return utc_now() > self.expires_at

    def is_used(self) -> bool:
        return self.used_at is not None

    def mark_used(self):
        self.used_at = utc_now()
