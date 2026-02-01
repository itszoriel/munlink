from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy import text

from apps.api.app import create_app
from apps.api.config import Config
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality
from apps.api.models.user import User
from apps.api.models.audit import AuditLog


class FKTestConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = False


def _enable_sqlite_fk():
    try:
        db.session.execute(text('PRAGMA foreign_keys = ON'))
    except OperationalError:
        pass


def test_audit_log_enforces_foreign_keys():
    """AuditLog should respect FK constraints for user and municipality."""
    app = create_app(FKTestConfig)
    with app.app_context():
        db.create_all()
        _enable_sqlite_fk()

        prov = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni = Municipality(id=112, name='Iba', slug='iba', province_id=prov.id, psgc_code='037112000')
        user = User(
            username='tester',
            email='test@example.com',
            password_hash='hash',
            first_name='Test',
            last_name='User',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni.id,
        )
        db.session.add_all([prov, muni, user])
        db.session.commit()

        log = AuditLog(
            user_id=user.id,
            municipality_id=muni.id,
            entity_type='document_request',
            entity_id=1,
            action='create',
            actor_role='admin',
        )
        db.session.add(log)
        db.session.commit()

        # Invalid municipality should raise FK violation when enforcement is on
        bad_log = AuditLog(
            user_id=user.id,
            municipality_id=9999,
            entity_type='document_request',
            entity_id=2,
            action='create',
            actor_role='admin',
        )
        db.session.add(bad_log)
        try:
            db.session.commit()
            raised = False
        except IntegrityError:
            db.session.rollback()
            raised = True

        assert raised, "Foreign key constraint on municipality_id should be enforced"
