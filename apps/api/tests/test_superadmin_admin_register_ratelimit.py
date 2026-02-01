from apps.api.app import create_app
from apps.api.config import Config
from flask_jwt_extended import create_access_token


class RateLimitConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = True
    ADMIN_SECRET_KEY = 'test-admin-secret'


def test_admin_register_rate_limit_keys_by_superadmin_identity():
    """
    /api/auth/admin/register should:
    - stay strict for unauth usage (keyed by IP)
    - allow superadmin-authenticated bursts keyed by superadmin identity
    - return JSON on 429
    """
    app = create_app(RateLimitConfig)
    client = app.test_client()

    headers = {
        'X-Forwarded-For': '203.0.113.9',  # stable, unique IP for test
    }

    # Secret-only requests are strict: 3 per hour
    for _ in range(3):
        resp = client.post('/api/auth/admin/register', json={'admin_secret': 'test-admin-secret'}, headers=headers)
        assert resp.status_code == 400  # missing required fields, but should count toward the limit

    resp = client.post('/api/auth/admin/register', json={'admin_secret': 'test-admin-secret'}, headers=headers)
    assert resp.status_code == 429
    assert resp.is_json
    assert (resp.get_json() or {}).get('error')

    # Superadmin-authenticated request should not be blocked by the exhausted IP bucket
    with app.app_context():
        token = create_access_token(identity='999', additional_claims={'role': 'superadmin'})

    resp = client.post(
        '/api/auth/admin/register',
        json={'admin_secret': 'test-admin-secret'},
        headers={**headers, 'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 400
