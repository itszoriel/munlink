"""
Role-scoping tests for resident verification endpoints.

Goal: Provincial/barangay/superadmin should NOT be able to verify residents.
Only municipal_admin within the same municipality may approve.
"""
from apps.api.app import create_app
from apps.api.config import Config
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality
from apps.api.models.user import User
from flask_jwt_extended import create_access_token


class VerifyRoleTestConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = False


def _bootstrap_users():
    province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
    muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')

    resident = User(
        username='resident',
        email='resident@example.com',
        password_hash='test',
        first_name='John',
        last_name='Doe',
        role='resident',
        municipality_id=muni.id,
    )

    municipal_admin = User(
        username='mun_admin',
        email='mun_admin@example.com',
        password_hash='test',
        first_name='Mun',
        last_name='Admin',
        role='municipal_admin',
        admin_municipality_id=muni.id,
        permissions=['residents:approve'],
    )

    provincial_admin = User(
        username='prov_admin',
        email='prov_admin@example.com',
        password_hash='test',
        first_name='Prov',
        last_name='Admin',
        role='provincial_admin',
        admin_municipality_id=muni.id,  # even if scoped, should be blocked
        permissions=['residents:approve'],
    )

    return province, muni, resident, municipal_admin, provincial_admin


def test_only_municipal_admin_can_verify():
    app = create_app(VerifyRoleTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        province, muni, resident, municipal_admin, provincial_admin = _bootstrap_users()
        db.session.add_all([province, muni, resident, municipal_admin, provincial_admin])
        db.session.commit()

        resident_id = resident.id

        muni_token = create_access_token(identity=str(municipal_admin.id), additional_claims={'role': 'municipal_admin'})
        prov_token = create_access_token(identity=str(provincial_admin.id), additional_claims={'role': 'provincial_admin'})

        # Provincial admin should be blocked
        resp = client.post(
            f'/api/admin/users/{resident_id}/verify',
            headers={'Authorization': f'Bearer {prov_token}'},
        )
        assert resp.status_code == 403
        assert b'Only municipal admins can verify residents' in resp.data

        # Municipal admin should succeed
        resp = client.post(
            f'/api/admin/users/{resident_id}/verify',
            headers={'Authorization': f'Bearer {muni_token}'},
        )
        assert resp.status_code == 200

        db.session.refresh(resident)
        assert resident.admin_verified is True
