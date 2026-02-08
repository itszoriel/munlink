"""Resident municipality transfer request model."""
from datetime import datetime
from apps.api.utils.time import utc_now
try:
    from apps.api import db
except ImportError:
    from apps.api import db

class TransferRequest(db.Model):
    __tablename__ = 'transfer_requests'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    from_municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=False)
    to_municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=False)
    to_barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, accepted
    notes = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    approved_at = db.Column(db.DateTime, nullable=True)
    accepted_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'from_municipality_id': self.from_municipality_id,
            'to_municipality_id': self.to_municipality_id,
            'to_barangay_id': self.to_barangay_id,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
        }


