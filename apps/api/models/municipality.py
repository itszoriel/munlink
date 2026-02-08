"""Municipality and Barangay models."""
from datetime import datetime
from apps.api.utils.time import utc_now
try:
    from apps.api import db
except ImportError:
    from apps.api import db

class Municipality(db.Model):
    __tablename__ = 'municipalities'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    
    # Foreign Key to Province
    province_id = db.Column(db.Integer, db.ForeignKey('provinces.id'), nullable=False)
    
    # PSGC Code (Philippine Standard Geographic Code)
    psgc_code = db.Column(db.String(20), unique=True, nullable=False)
    
    # Contact Information
    contact_email = db.Column(db.String(120), nullable=True)
    contact_phone = db.Column(db.String(15), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    
    # Assets
    logo_url = db.Column(db.String(255), nullable=True)
    flag_url = db.Column(db.String(255), nullable=True)
    trademark_image_url = db.Column(db.String(255), nullable=True)
    
    # Metadata
    description = db.Column(db.Text, nullable=True)
    population = db.Column(db.Integer, nullable=True)
    land_area = db.Column(db.Float, nullable=True)  # in square kilometers
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    
    # Relationships
    barangays = db.relationship('Barangay', backref='municipality', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Municipality {self.name}>'
    
    def to_dict(self, include_barangays=False, include_province=False):
        """Convert municipality to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'province_id': self.province_id,
            'province_name': self.province.name if self.province else None,
            'psgc_code': self.psgc_code,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'address': self.address,
            'logo_url': self.logo_url,
            'flag_url': self.flag_url,
            'trademark_image_url': self.trademark_image_url,
            'description': self.description,
            'population': self.population,
            'land_area': self.land_area,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        
        if include_barangays:
            data['barangays'] = [b.to_dict() for b in self.barangays.all()]
        
        if include_province and self.province:
            data['province'] = self.province.to_dict()
        
        return data


class Barangay(db.Model):
    __tablename__ = 'barangays'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(100), nullable=False)
    
    # Foreign Key
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=False)
    
    # PSGC Code
    psgc_code = db.Column(db.String(20), unique=True, nullable=False)
    
    # Contact Information
    contact_email = db.Column(db.String(120), nullable=True)
    contact_phone = db.Column(db.String(15), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    
    # Metadata
    population = db.Column(db.Integer, nullable=True)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    
    # Unique constraint for name within municipality
    __table_args__ = (
        db.UniqueConstraint('municipality_id', 'name', name='uq_municipality_barangay_name'),
    )
    
    def __repr__(self):
        return f'<Barangay {self.name}, {self.municipality.name}>'
    
    def to_dict(self):
        """Convert barangay to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'municipality_id': self.municipality_id,
            'psgc_code': self.psgc_code,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'address': self.address,
            'population': self.population,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

