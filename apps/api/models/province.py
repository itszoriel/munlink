"""Province model for Region 3 (Central Luzon)."""
from datetime import datetime
try:
    from __init__ import db
except ImportError:
    from __init__ import db


class Province(db.Model):
    __tablename__ = 'provinces'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    
    # PSGC Code (Philippine Standard Geographic Code)
    psgc_code = db.Column(db.String(20), unique=True, nullable=False)
    
    # Region Information
    region_code = db.Column(db.String(10), nullable=False, default='03')  # Region 3
    region_name = db.Column(db.String(100), nullable=False, default='Central Luzon')
    
    # Contact Information
    contact_email = db.Column(db.String(120), nullable=True)
    contact_phone = db.Column(db.String(15), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    
    # Assets
    logo_url = db.Column(db.String(255), nullable=True)
    seal_url = db.Column(db.String(255), nullable=True)
    
    # Metadata
    description = db.Column(db.Text, nullable=True)
    population = db.Column(db.Integer, nullable=True)
    land_area = db.Column(db.Float, nullable=True)  # in square kilometers
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    municipalities = db.relationship('Municipality', backref='province', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Province {self.name}>'
    
    def to_dict(self, include_municipalities=False):
        """Convert province to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'psgc_code': self.psgc_code,
            'region_code': self.region_code,
            'region_name': self.region_name,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'address': self.address,
            'logo_url': self.logo_url,
            'seal_url': self.seal_url,
            'description': self.description,
            'population': self.population,
            'land_area': self.land_area,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        
        if include_municipalities:
            data['municipalities'] = [m.to_dict() for m in self.municipalities.all()]
        
        return data

