"""Marketplace models for items, transactions, and messages."""
from datetime import datetime
try:
    from __init__ import db
except ImportError:
    from __init__ import db
from sqlalchemy import Index

class Item(db.Model):
    __tablename__ = 'items'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Owner Information
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Item Details
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # electronics, furniture, clothing, etc.
    condition = db.Column(db.String(20), nullable=False)  # new, like_new, good, fair, poor
    
    # Transaction Type
    transaction_type = db.Column(db.String(20), nullable=False)  # donate, lend, sell
    
    # Price (for sell items)
    price = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Lending Details (for lend items)
    lend_duration_days = db.Column(db.Integer, nullable=True)
    security_deposit = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Location
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=False)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    pickup_location = db.Column(db.String(200), nullable=True)
    
    # Images (stored as JSON array of paths)
    images = db.Column(db.JSON, nullable=True)
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, available, reserved, completed, cancelled
    is_active = db.Column(db.Boolean, default=True)
    
    # Admin moderation fields
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    rejected_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    rejected_at = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    
    # View Count
    view_count = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='items')
    municipality = db.relationship('Municipality', backref='items')
    barangay = db.relationship('Barangay', backref='items')
    transactions = db.relationship('Transaction', backref='item', lazy='dynamic')
    
    # Indexes
    __table_args__ = (
        Index('idx_item_municipality', 'municipality_id'),
        Index('idx_item_category', 'category'),
        Index('idx_item_transaction_type', 'transaction_type'),
        Index('idx_item_status', 'status'),
        Index('idx_item_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f'<Item {self.title}>'
    
    def to_dict(self, include_user=False):
        """Convert item to dictionary."""
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'condition': self.condition,
            'transaction_type': self.transaction_type,
            'price': float(self.price) if self.price else None,
            'lend_duration_days': self.lend_duration_days,
            'security_deposit': float(self.security_deposit) if self.security_deposit else None,
            'municipality_id': self.municipality_id,
            'barangay_id': self.barangay_id,
            'pickup_location': self.pickup_location,
            'images': self.images,
            'status': self.status,
            'is_active': self.is_active,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'rejected_by': self.rejected_by,
            'rejected_at': self.rejected_at.isoformat() if self.rejected_at else None,
            'rejection_reason': self.rejection_reason,
            'view_count': self.view_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_user and self.user:
            data['user'] = self.user.to_dict()
            data['seller'] = {
                'id': self.user.id,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
                'username': self.user.username,
                'email': self.user.email
            }
        
        return data


class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Related Item and Users
    item_id = db.Column(db.Integer, db.ForeignKey('items.id'), nullable=False)
    buyer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # or borrower/receiver
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # or lender/donor
    
    # Transaction Details
    transaction_type = db.Column(db.String(20), nullable=False)  # donate, lend, sell
    # Status lifecycle now supports dual-confirmation and disputes
    # pending -> awaiting_buyer -> accepted -> handed_over -> received ->
    #   [lend] returned -> completed
    #   [sell/donate] completed
    # along with: rejected, cancelled, disputed
    status = db.Column(db.String(20), default='pending')
    
    # Financial Details (for sell/lend)
    amount = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Lending Specific
    borrow_start_date = db.Column(db.DateTime, nullable=True)
    borrow_end_date = db.Column(db.DateTime, nullable=True)
    return_date = db.Column(db.DateTime, nullable=True)
    # Scheduled pickup (set by seller upon acceptance)
    pickup_at = db.Column(db.DateTime, nullable=True)
    
    # Notes
    buyer_notes = db.Column(db.Text, nullable=True)
    seller_notes = db.Column(db.Text, nullable=True)
    # Proposed pickup location (seller sets during proposal/acceptance)
    pickup_location = db.Column(db.String(200), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    buyer = db.relationship('User', foreign_keys=[buyer_id], backref='purchases')
    seller = db.relationship('User', foreign_keys=[seller_id], backref='sales')
    
    # Indexes
    __table_args__ = (
        Index('idx_transaction_buyer', 'buyer_id'),
        Index('idx_transaction_seller', 'seller_id'),
        Index('idx_transaction_status', 'status'),
    )
    
    def __repr__(self):
        return f'<Transaction {self.id} - {self.transaction_type}>'
    
    def to_dict(self):
        """Convert transaction to dictionary."""
        return {
            'id': self.id,
            'item_id': self.item_id,
            'buyer_id': self.buyer_id,
            'seller_id': self.seller_id,
            'transaction_type': self.transaction_type,
            'status': self.status,
            'amount': float(self.amount) if self.amount else None,
            'borrow_start_date': self.borrow_start_date.isoformat() if self.borrow_start_date else None,
            'borrow_end_date': self.borrow_end_date.isoformat() if self.borrow_end_date else None,
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'pickup_at': self.pickup_at.isoformat() if self.pickup_at else None,
            'pickup_location': self.pickup_location,
            'buyer_notes': self.buyer_notes,
            'seller_notes': self.seller_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class TransactionAuditLog(db.Model):
    __tablename__ = 'transaction_audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    actor_role = db.Column(db.String(20), nullable=True)  # buyer, seller, admin, system
    action = db.Column(db.String(50), nullable=False)  # propose, confirm, handover_seller, handover_buyer, return_buyer, return_seller, complete, dispute, admin_status, cancel, etc.
    from_status = db.Column(db.String(20), nullable=True)
    to_status = db.Column(db.String(20), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    # 'metadata' is reserved by SQLAlchemy's declarative base; use different attribute name
    metadata_json = db.Column('metadata', db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    transaction = db.relationship('Transaction', backref='audit_logs')

    __table_args__ = (
        Index('idx_audit_tx', 'transaction_id'),
        Index('idx_audit_created', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'actor_id': self.actor_id,
            'actor_role': self.actor_role,
            'action': self.action,
            'from_status': self.from_status,
            'to_status': self.to_status,
            'notes': self.notes,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'metadata': self.metadata_json,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


