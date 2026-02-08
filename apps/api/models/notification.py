"""Notification outbox model for email and SMS delivery."""
from datetime import datetime
from apps.api.utils.time import utc_now
try:
    from apps.api import db
except ImportError:
    from apps.api import db


class NotificationOutbox(db.Model):
    __tablename__ = 'notification_outbox'

    id = db.Column(db.Integer, primary_key=True)
    resident_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    channel = db.Column(db.String(10), nullable=False)  # email | sms
    event_type = db.Column(db.String(100), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True)
    payload = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, sent, failed, skipped
    attempts = db.Column(db.Integer, nullable=False, default=0)
    next_attempt_at = db.Column(db.DateTime, default=utc_now, nullable=True)
    last_error = db.Column(db.Text, nullable=True)
    dedupe_key = db.Column(db.String(255), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        db.Index('ix_notification_outbox_status_next', 'status', 'next_attempt_at'),
        db.Index('ix_notification_outbox_event', 'event_type'),
        db.Index('ix_notification_outbox_resident', 'resident_id'),
    )

    def to_dict(self):
        """Serialize outbox entry (for admin/diagnostics)."""
        return {
            'id': self.id,
            'resident_id': self.resident_id,
            'channel': self.channel,
            'event_type': self.event_type,
            'entity_id': self.entity_id,
            'payload': self.payload,
            'status': self.status,
            'attempts': self.attempts,
            'next_attempt_at': self.next_attempt_at.isoformat() if self.next_attempt_at else None,
            'last_error': self.last_error,
            'dedupe_key': self.dedupe_key,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
