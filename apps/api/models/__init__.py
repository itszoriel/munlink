"""
MunLink Region 3 - Database Models
Import all models here for Flask-Migrate to detect them
"""
from apps.api import db

# Base model will be imported by other models
Base = db.Model

# Import all models to register them with SQLAlchemy
from .user import User
from .province import Province
from .municipality import Municipality, Barangay
from .marketplace import Item, Transaction
from .document import DocumentType, DocumentRequest
from .issue import IssueCategory, Issue
from .benefit import BenefitProgram, BenefitApplication
from .token_blacklist import TokenBlacklist
from .audit import AuditLog
from .refresh_token import RefreshTokenFamily, RefreshToken
from .notification import NotificationOutbox
from .email_verification_code import EmailVerificationCode
from .password_reset_token import PasswordResetToken
from .admin_audit_log import AdminAuditLog, AuditAction
from .special_status import UserSpecialStatus

__all__ = [
    'User',
    'Province',
    'Municipality',
    'Barangay',
    'Item',
    'Transaction',
    'DocumentType',
    'DocumentRequest',
    'IssueCategory',
    'Issue',
    'BenefitProgram',
    'BenefitApplication',
    'TokenBlacklist',
    'AuditLog',
    'RefreshTokenFamily',
    'RefreshToken',
    'NotificationOutbox',
    'EmailVerificationCode',
    'PasswordResetToken',
    'AdminAuditLog',
    'AuditAction',
    'UserSpecialStatus',
]
