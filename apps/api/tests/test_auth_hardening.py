import bcrypt

from flask_jwt_extended import create_access_token

from apps.api import db
from apps.api.app import create_app
from apps.api.config import Config
from apps.api.models.email_verification_code import EmailVerificationCode
from apps.api.models.user import User


class AuthHardeningConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = False


def _pw_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def test_admin_login_rejects_superadmin_account():
    app = create_app(AuthHardeningConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        superadmin = User(
            username='root_admin',
            email='root_admin@example.com',
            password_hash=_pw_hash('StrongPass123!'),
            first_name='Root',
            last_name='Admin',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
            is_active=True,
        )
        db.session.add(superadmin)
        db.session.commit()

    resp = client.post('/api/auth/admin/login', json={
        'email': 'root_admin@example.com',
        'password': 'StrongPass123!',
    })
    assert resp.status_code == 403
    body = resp.get_json() or {}
    assert body.get('code') == 'SUPERADMIN_2FA_REQUIRED'


def test_admin_register_disallows_superadmin_role_creation():
    app = create_app(AuthHardeningConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        actor = User(
            username='existing_super',
            email='existing_super@example.com',
            password_hash=_pw_hash('StrongPass123!'),
            first_name='Existing',
            last_name='Super',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
            is_active=True,
        )
        db.session.add(actor)
        db.session.commit()
        token = create_access_token(identity=str(actor.id), additional_claims={'role': 'superadmin'})

    resp = client.post(
        '/api/auth/admin/register',
        json={
            'username': 'new_super',
            'email': 'new_super@example.com',
            'password': 'StrongPass123!',
            'first_name': 'New',
            'last_name': 'Super',
            'admin_role': 'superadmin',
        },
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 400
    assert 'Invalid admin role' in (resp.get_json() or {}).get('error', '')


def test_superadmin_verify_2fa_response_excludes_refresh_token_body():
    app = create_app(AuthHardeningConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        superadmin = User(
            username='verify_super',
            email='verify_super@example.com',
            password_hash=_pw_hash('StrongPass123!'),
            first_name='Verify',
            last_name='Super',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
            is_active=True,
        )
        db.session.add(superadmin)
        db.session.commit()

        verification = EmailVerificationCode.create_for_user(
            user_id=superadmin.id,
            purpose='2fa_login',
            expiry_minutes=10,
        )
        session_id = verification.session_id
        code = verification.code

    resp = client.post('/api/auth/superadmin/verify-2fa', json={
        'session_id': session_id,
        'code': code,
    })
    assert resp.status_code == 200
    body = resp.get_json() or {}
    assert 'access_token' in body
    assert 'refresh_token' not in body


def test_public_upload_route_blocks_sensitive_categories():
    app = create_app(AuthHardeningConfig)
    client = app.test_client()

    blocked = client.get('/uploads/generated_docs/example.pdf')
    assert blocked.status_code == 403

    allowed_category = client.get('/uploads/profiles/example.png')
    assert allowed_category.status_code in (200, 404)
