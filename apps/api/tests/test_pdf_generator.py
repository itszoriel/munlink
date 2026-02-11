import os
from types import SimpleNamespace
from datetime import datetime, timezone

from apps.api.app import create_app


def test_generate_document_pdf(tmp_path):
    app = create_app()
    app.config['TESTING'] = True
    # Override uploads to a temp dir for test isolation
    app.config['UPLOAD_FOLDER'] = tmp_path / 'uploads'
    (app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)

    # Build minimal fake objects
    municipality = SimpleNamespace(name='Iba', id=1)
    user = SimpleNamespace(first_name='Juan', last_name='Dela Cruz', username='juan')
    request_obj = SimpleNamespace(
        id=123,
        municipality=municipality,
        municipality_id=municipality.id,
        delivery_address='Iba, Zambales',
        purpose='Scholarship',
    created_at=datetime.now(timezone.utc),
    )
    document_type = SimpleNamespace(code='residency', name='Certificate of Residency')

    with app.app_context():
        from apps.api.utils.pdf_generator import generate_document_pdf

        abs_path, rel_path, pdf_bytes = generate_document_pdf(request_obj, document_type, user)

        assert os.path.exists(abs_path)
        assert str(abs_path).endswith('.pdf')
        assert isinstance(rel_path, str) and rel_path.endswith('.pdf')
        assert isinstance(pdf_bytes, bytes) and len(pdf_bytes) > 0


