"""API Routes - Import all blueprints here."""

from .auth import auth_bp
from .provinces import provinces_bp
from .municipalities import municipalities_bp
from .marketplace import marketplace_bp
from .announcements import announcements_bp
from .documents import documents_bp
from .issues import issues_bp
from .benefits import benefits_bp

__all__ = [
    'auth_bp',
    'provinces_bp',
    'municipalities_bp',
    'marketplace_bp',
    'announcements_bp',
    'documents_bp',
    'issues_bp',
    'benefits_bp',
]
