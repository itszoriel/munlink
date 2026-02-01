"""MunLink Region 3 - Announcement Model
Database model for scoped announcements with municipality/barangay targeting.
"""
from datetime import datetime, timezone
from sqlalchemy import Index

try:
    from __init__ import db
except ImportError:
    from __init__ import db


def _to_naive_utc(dt):
    """Convert timezone-aware datetime to naive UTC for safe comparisons."""
    if not dt:
        return dt
    if dt.tzinfo:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class Announcement(db.Model):
    """Announcement model for province/municipality/barangay communications."""

    __tablename__ = 'announcements'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    scope = db.Column(db.String(20), nullable=False, default='MUNICIPALITY')  # PROVINCE, MUNICIPALITY, BARANGAY
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=True)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_by_staff_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    priority = db.Column(db.String(20), nullable=False, default='medium')  # high, medium, low
    images = db.Column(db.JSON, nullable=True)
    external_url = db.Column(db.String(500), nullable=True)
    pinned = db.Column(db.Boolean, default=False, nullable=False)
    pinned_until = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='DRAFT')  # DRAFT, PUBLISHED, ARCHIVED
    publish_at = db.Column(db.DateTime, nullable=True)
    expire_at = db.Column(db.DateTime, nullable=True)
    shared_with_municipalities = db.Column(db.JSON, nullable=True)  # Array of municipality IDs for cross-municipality sharing
    public_viewable = db.Column(db.Boolean, nullable=False, default=False)  # True = guests can view when scoped
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    municipality = db.relationship('Municipality', backref='announcements')
    barangay = db.relationship('Barangay', backref='announcements')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_announcements')
    creator_staff = db.relationship('User', foreign_keys=[created_by_staff_id], backref='staff_created_announcements')

    # Indexes
    __table_args__ = (
        Index('idx_announcement_municipality', 'municipality_id'),
        Index('idx_announcement_barangay', 'barangay_id'),
        Index('idx_announcement_scope', 'scope'),
        Index('idx_announcement_status', 'status'),
        Index('idx_announcement_active', 'is_active'),
        Index('idx_announcement_priority', 'priority'),
        Index('idx_announcement_pinned', 'pinned'),
        Index('idx_announcement_publish', 'publish_at'),
        Index('idx_announcement_created', 'created_at'),
    )

    def __repr__(self):
        return f'<Announcement {self.title}>'

    def to_dict(self):
        """Convert announcement to dictionary with scoped metadata and safe UTC datetimes."""
        now = datetime.utcnow()
        status_value = (self.status or 'DRAFT').upper()
        publish_at = _to_naive_utc(self.publish_at)
        expire_at = _to_naive_utc(self.expire_at)
        pinned_until = _to_naive_utc(self.pinned_until)
        created_at = _to_naive_utc(self.created_at)
        updated_at = _to_naive_utc(self.updated_at)

        within_window = (publish_at is None or publish_at <= now) and (expire_at is None or expire_at > now)
        is_published = status_value == 'PUBLISHED'
        is_active = bool(is_published and within_window)

        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'scope': self.scope,
            'municipality_id': self.municipality_id,
            'municipality_name': self.municipality.name if self.municipality else None,
            'barangay_id': self.barangay_id,
            'barangay_name': self.barangay.name if self.barangay else None,
            'created_by': self.created_by,
            'created_by_staff_id': self.created_by_staff_id or self.created_by,
            'creator_name': f"{self.creator.first_name} {self.creator.last_name}" if self.creator else None,
            'created_by_name': f"{self.creator.first_name} {self.creator.last_name}" if self.creator else None,
            'priority': self.priority,
            'images': self.images or [],
            'external_url': self.external_url,
            'pinned': bool(self.pinned),
            'pinned_until': pinned_until.isoformat() if pinned_until else None,
            'status': status_value,
            'publish_at': publish_at.isoformat() if publish_at else None,
            'expire_at': expire_at.isoformat() if expire_at else None,
            'shared_with_municipalities': self.shared_with_municipalities or [],
            'public_viewable': bool(self.public_viewable),
            'is_active': is_active,
            'created_at': created_at.isoformat() if created_at else None,
            'updated_at': updated_at.isoformat() if updated_at else None,
        }
