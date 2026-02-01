from apps.api.app import app as flask_app


def test_handover_endpoints_require_auth():
    client = flask_app.test_client()
    # Without auth token should be 401
    resp = client.post('/api/marketplace/transactions/1/handover-seller')
    assert resp.status_code in (401, 422)
    resp = client.post('/api/marketplace/transactions/1/handover-buyer')
    assert resp.status_code in (401, 422)


def test_audit_endpoint_requires_auth():
    client = flask_app.test_client()
    resp = client.get('/api/marketplace/transactions/1/audit')
    assert resp.status_code in (401, 422)


