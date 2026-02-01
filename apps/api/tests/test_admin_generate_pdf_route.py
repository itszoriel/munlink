from apps.api.app import create_app


def test_generate_pdf_route_requires_auth():
    app = create_app()
    app.config['TESTING'] = True
    client = app.test_client()

    resp = client.post('/api/admin/documents/requests/1/generate-pdf')
    # Flask-JWT-Extended typically returns 401 for missing Authorization header
    assert resp.status_code in (401, 422)


