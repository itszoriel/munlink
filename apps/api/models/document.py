"""Document request and management models."""
from datetime import datetime
from apps.api.utils.time import utc_now
try:
    from apps.api import db
except ImportError:
    from apps.api import db
from sqlalchemy import Index

class DocumentType(db.Model):
    __tablename__ = 'document_types'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Issuing Authority
    authority_level = db.Column(db.String(20), nullable=False)  # municipal, barangay
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=True)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    
    # Requirements
    requirements = db.Column(db.JSON, nullable=True)  # List of required fields/documents
    
    # Pricing
    fee = db.Column(db.Numeric(10, 2), default=0.00)

    # Fee tiers for business types (JSON): {"big_business": 300, "small_business": 150, "banca_tricycle": 100}
    fee_tiers = db.Column(db.JSON, nullable=True)

    # Exemption rules for special statuses (JSON):
    # {"student": {"requires_purpose": "educational"}, "pwd": true, "senior": true}
    exemption_rules = db.Column(db.JSON, nullable=True)

    # Processing Time
    processing_days = db.Column(db.Integer, default=3)
    
    # Delivery Options
    supports_physical = db.Column(db.Boolean, default=True)
    supports_digital = db.Column(db.Boolean, default=True)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    
    # Relationships
    requests = db.relationship('DocumentRequest', backref='document_type', lazy='dynamic')
    __table_args__ = (
        Index('idx_document_type_authority_level', 'authority_level'),
        Index('idx_document_type_municipality', 'municipality_id'),
        Index('idx_document_type_barangay', 'barangay_id'),
    )
    
    def __repr__(self):
        return f'<DocumentType {self.name}>'
    
    def to_dict(self):
        """Convert document type to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'authority_level': self.authority_level,
            'municipality_id': self.municipality_id,
            'barangay_id': self.barangay_id,
            'requirements': self.requirements,
            'fee': float(self.fee) if self.fee else 0.00,
            'fee_tiers': self.fee_tiers,
            'exemption_rules': self.exemption_rules,
            'processing_days': self.processing_days,
            'supports_physical': self.supports_physical,
            'supports_digital': self.supports_digital,
            'is_active': self.is_active,
        }


class DocumentRequest(db.Model):
    __tablename__ = 'document_requests'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Request Number (unique identifier for tracking)
    request_number = db.Column(db.String(50), unique=True, nullable=False)
    
    # Requester Information
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Document Information
    document_type_id = db.Column(db.Integer, db.ForeignKey('document_types.id'), nullable=False)
    
    # Location
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=False)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    
    # Delivery Method
    delivery_method = db.Column(db.String(20), nullable=False)  # physical, digital
    delivery_address = db.Column(db.String(200), nullable=True)  # for physical delivery
    
    # Request Details
    purpose = db.Column(db.String(200), nullable=False)
    additional_notes = db.Column(db.Text, nullable=True)

    # Enhanced request fields
    purpose_type = db.Column(db.String(50), nullable=True)  # educational, employment, legal, personal, business, travel, other
    purpose_other = db.Column(db.String(200), nullable=True)  # Custom purpose if purpose_type is 'other'
    civil_status = db.Column(db.String(30), nullable=True)  # single, married, widowed, separated, divorced
    business_type = db.Column(db.String(50), nullable=True)  # big_business, small_business, banca_tricycle

    # Fee tracking
    original_fee = db.Column(db.Numeric(10, 2), nullable=True)  # Base fee before exemptions
    applied_exemption = db.Column(db.String(30), nullable=True)  # student, pwd, senior, or null
    final_fee = db.Column(db.Numeric(10, 2), nullable=True)  # Fee after exemptions

    # Payment fields
    payment_status = db.Column(db.String(20), nullable=True)  # pending, paid, waived
    payment_intent_id = db.Column(db.String(100), nullable=True)  # Stripe PaymentIntent ID
    paid_at = db.Column(db.DateTime, nullable=True)
    payment_method = db.Column(db.String(20), nullable=True)  # stripe, manual_qr

    # Manual QR payment fields
    manual_payment_status = db.Column(db.String(30), nullable=True)  # not_started, proof_uploaded, id_sent, submitted, approved, rejected
    manual_payment_proof_path = db.Column(db.String(255), nullable=True)
    manual_payment_id_hash = db.Column(db.String(255), nullable=True)
    manual_payment_id_last4 = db.Column(db.String(10), nullable=True)
    manual_payment_id_sent_at = db.Column(db.DateTime, nullable=True)
    manual_payment_submitted_at = db.Column(db.DateTime, nullable=True)
    manual_reviewed_by = db.Column(db.Integer, nullable=True)
    manual_reviewed_at = db.Column(db.DateTime, nullable=True)
    manual_review_notes = db.Column(db.Text, nullable=True)

    # Office payment verification fields (for pickup documents)
    office_payment_code_hash = db.Column(db.String(255), nullable=True)  # Hashed 6-digit code
    office_payment_status = db.Column(db.String(50), nullable=True)  # not_started, code_sent, verified
    office_payment_verified_at = db.Column(db.DateTime, nullable=True)
    office_payment_verified_by = db.Column(db.Integer, nullable=True)  # Admin user ID who verified

    # Supporting Documents (JSON array of file paths)
    supporting_documents = db.Column(db.JSON, nullable=True)
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, processing, ready, completed, rejected, cancelled
    
    # Admin Notes
    admin_notes = db.Column(db.Text, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    
    # QR Code for validation
    qr_code = db.Column(db.String(255), nullable=True)
    qr_data = db.Column(db.JSON, nullable=True)
    
    # Generated Document
    document_file = db.Column(db.String(255), nullable=True)
    
    # Audit trail (stored as JSON/TEXT for SQLite compatibility)
    resident_input = db.Column(db.JSON, nullable=True)
    admin_edited_content = db.Column(db.JSON, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    approved_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    ready_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='document_requests')
    municipality = db.relationship('Municipality', backref='document_requests')
    barangay = db.relationship('Barangay', backref='document_requests')
    
    # Indexes
    __table_args__ = (
        Index('idx_doc_request_user', 'user_id'),
        Index('idx_doc_request_municipality', 'municipality_id'),
        Index('idx_doc_request_status', 'status'),
        Index('idx_doc_request_number', 'request_number'),
        Index('idx_doc_request_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f'<DocumentRequest {self.request_number}>'
    
    def to_dict(self, include_user=False, include_audit=False, include_storage_paths=False):
        """Convert document request to dictionary."""
        data = {
            'id': self.id,
            'request_number': self.request_number,
            'user_id': self.user_id,
            'document_type_id': self.document_type_id,
            'municipality_id': self.municipality_id,
            'barangay_id': self.barangay_id,
            'delivery_method': self.delivery_method,
            'delivery_address': self.delivery_address,
            'purpose': self.purpose,
            'additional_notes': self.additional_notes,
            'purpose_type': self.purpose_type,
            'purpose_other': self.purpose_other,
            'civil_status': self.civil_status,
            'business_type': self.business_type,
            'original_fee': float(self.original_fee) if self.original_fee else None,
            'applied_exemption': self.applied_exemption,
            'final_fee': float(self.final_fee) if self.final_fee else None,
            'payment_status': self.payment_status,
            'payment_intent_id': self.payment_intent_id,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'payment_method': self.payment_method,
            'manual_payment_status': self.manual_payment_status,
            # Never expose raw storage paths by default.
            'manual_payment_proof_path': self.manual_payment_proof_path if include_storage_paths else (True if self.manual_payment_proof_path else None),
            'has_manual_payment_proof': bool(self.manual_payment_proof_path),
            'manual_payment_id_last4': self.manual_payment_id_last4,
            'manual_payment_id_sent_at': self.manual_payment_id_sent_at.isoformat() if self.manual_payment_id_sent_at else None,
            'manual_payment_submitted_at': self.manual_payment_submitted_at.isoformat() if self.manual_payment_submitted_at else None,
            'manual_reviewed_by': self.manual_reviewed_by,
            'manual_reviewed_at': self.manual_reviewed_at.isoformat() if self.manual_reviewed_at else None,
            'manual_review_notes': self.manual_review_notes,
            'office_payment_status': self.office_payment_status,
            'office_payment_verified_at': self.office_payment_verified_at.isoformat() if self.office_payment_verified_at else None,
            'office_payment_verified_by': self.office_payment_verified_by,
            'supporting_documents': self.supporting_documents,
            'status': self.status,
            'admin_notes': self.admin_notes,
            'rejection_reason': self.rejection_reason,
            'qr_code': self.qr_code if include_storage_paths else (True if self.qr_code else None),
            'has_qr_code': bool(self.qr_code),
            'document_file': self.document_file if include_storage_paths else (True if self.document_file else None),
            'has_document_file': bool(self.document_file),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'ready_at': self.ready_at.isoformat() if self.ready_at else None,
        }
        
        if include_user and self.user:
            data['user'] = self.user.to_dict()
        
        if self.document_type:
            data['document_type'] = self.document_type.to_dict()
        
        if include_audit:
            # Ensure JSON-serializable fallback
            try:
                data['resident_input'] = self.resident_input
            except Exception:
                data['resident_input'] = None
            try:
                data['admin_edited_content'] = self.admin_edited_content
            except Exception:
                data['admin_edited_content'] = None
        
        return data

