from apps.api.app import create_app
from apps.api.config import Config
from apps.api import db
from apps.api.models.user import User
from flask_jwt_extended import create_access_token


class RateLimitConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = True
    ADMIN_SECRET_KEY = 'test-admin-secret'


def test_admin_register_requires_authenticated_superadmin():
    """/api/auth/admin/register must be inaccessible without superadmin auth."""
    app = create_app(RateLimitConfig)
    client = app.test_client()

    headers = {
        'X-Forwarded-For': '203.0.113.9',  # stable, unique IP for test
    }

    # Unauthenticated request must fail fast.
    resp = client.post('/api/auth/admin/register', json={}, headers=headers)
    assert resp.status_code in (401, 422)

    # With authenticated superadmin, request is accepted for validation flow.
    with app.app_context():
        db.create_all()
        superadmin = User(
            username='root',
            email='root@example.com',
            password_hash='test',
            first_name='Root',
            last_name='Admin',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
        )
        db.session.add(superadmin)
        db.session.commit()
        token = create_access_token(identity=str(superadmin.id), additional_claims={'role': 'superadmin'})

    resp = client.post('/api/auth/admin/register', json={}, headers={**headers, 'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400
