"""
Barangay admin document scope tests.

Goal: Barangay admin can process document requests only within their barangay,
and cannot see or update other barangays' requests even inside same municipality.
"""
from apps.api.app import create_app
from apps.api.config import Config
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.user import User
from apps.api.models.document import DocumentRequest, DocumentType
from flask_jwt_extended import create_access_token


class BarangayDocConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = False


def _seed_common():
    province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
    muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')
    brgy1 = Barangay(id=2001, name='Barangay Uno', slug='barangay-uno', municipality_id=muni.id, psgc_code='037112001')
    brgy2 = Barangay(id=2002, name='Barangay Dos', slug='barangay-dos', municipality_id=muni.id, psgc_code='037112002')
    doctype = DocumentType(
        id=1,
        name='Barangay Clearance',
        code='BCL',
        description='Test',
        authority_level='barangay',
        municipality_id=muni.id,
        requirements=[],
        supports_physical=True,
        supports_digital=False,
    )
    return province, muni, brgy1, brgy2, doctype


def test_barangay_admin_lists_only_their_barangay():
    app = create_app(BarangayDocConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        province, muni, brgy1, brgy2, doctype = _seed_common()
        resident = User(
            username='resident1',
            email='resident1@example.com',
            password_hash='test',
            first_name='Res',
            last_name='One',
            role='resident',
            municipality_id=muni.id,
            barangay_id=brgy1.id,
        )
        # Admin for brgy1
        brgy_admin = User(
            username='brgy_admin',
            email='brgy_admin@example.com',
            password_hash='test',
            first_name='Brgy',
            last_name='Admin',
            role='barangay_admin',
            admin_municipality_id=muni.id,
            admin_barangay_id=brgy1.id,
            permissions=['residents:approve'],
        )

        db.session.add_all([province, muni, brgy1, brgy2, doctype, resident, brgy_admin])
        db.session.flush()

        req1 = DocumentRequest(
            request_number='REQ-1',
            user_id=resident.id,
            document_type_id=doctype.id,
            municipality_id=muni.id,
            barangay_id=brgy1.id,
            delivery_method='physical',
            purpose='Clearance',
            status='pending',
        )
        req2 = DocumentRequest(
            request_number='REQ-2',
            user_id=resident.id,
            document_type_id=doctype.id,
            municipality_id=muni.id,
            barangay_id=brgy2.id,
            delivery_method='physical',
            purpose='Clearance',
            status='pending',
        )

        db.session.add_all([req1, req2])
        db.session.commit()

        token = create_access_token(identity=str(brgy_admin.id), additional_claims={'role': 'barangay_admin'})

        resp = client.get(
            '/api/admin/documents/requests',
            headers={'Authorization': f'Bearer {token}'}
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['pagination']['total'] == 1
        assert data['requests'][0]['barangay_id'] == brgy1.id


def test_barangay_admin_can_update_only_own_barangay_request():
    app = create_app(BarangayDocConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        province, muni, brgy1, brgy2, doctype = _seed_common()
        resident = User(
            username='resident2',
            email='resident2@example.com',
            password_hash='test',
            first_name='Res',
            last_name='Two',
            role='resident',
            municipality_id=muni.id,
            barangay_id=brgy1.id,
        )
        brgy_admin = User(
            username='brgy_admin2',
            email='brgy_admin2@example.com',
            password_hash='test',
            first_name='Brgy',
            last_name='Admin2',
            role='barangay_admin',
            admin_municipality_id=muni.id,
            admin_barangay_id=brgy1.id,
            permissions=['residents:approve'],
        )

        db.session.add_all([province, muni, brgy1, brgy2, doctype, resident, brgy_admin])
        db.session.flush()
        req_own = DocumentRequest(
            request_number='REQ-3',
            user_id=resident.id,
            document_type_id=doctype.id,
            municipality_id=muni.id,
            barangay_id=brgy1.id,
            delivery_method='physical',
            purpose='Clearance',
            status='pending',
        )
        req_other = DocumentRequest(
            request_number='REQ-4',
            user_id=resident.id,
            document_type_id=doctype.id,
            municipality_id=muni.id,
            barangay_id=brgy2.id,
            delivery_method='physical',
            purpose='Clearance',
            status='pending',
        )

        db.session.add_all([req_own, req_other])
        db.session.commit()

        token = create_access_token(identity=str(brgy_admin.id), additional_claims={'role': 'barangay_admin'})

        # Should succeed on own barangay request
        resp = client.put(
            f'/api/admin/documents/requests/{req_own.id}/status',
            json={'status': 'barangay_approved'},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert resp.status_code == 200

        # Should be forbidden on other barangay
        resp = client.put(
            f'/api/admin/documents/requests/{req_other.id}/status',
            json={'status': 'barangay_approved'},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert resp.status_code == 403


def test_barangay_admin_cannot_process_municipal_docs_without_barangay_clearance():
    app = create_app(BarangayDocConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        province, muni, brgy1, brgy2, _ = _seed_common()
        muni_doc = DocumentType(
            id=2,
            name='Business Permit',
            code='BP',
            description='Municipal doc',
            authority_level='municipal',
            municipality_id=muni.id,
            requirements=[],
            supports_physical=True,
            supports_digital=True,
        )
        resident = User(
            username='resident3',
            email='resident3@example.com',
            password_hash='test',
            first_name='Res',
            last_name='Three',
            role='resident',
            municipality_id=muni.id,
            barangay_id=brgy1.id,
        )
        brgy_admin = User(
            username='brgy_admin3',
            email='brgy_admin3@example.com',
            password_hash='test',
            first_name='Brgy',
            last_name='Admin3',
            role='barangay_admin',
            admin_municipality_id=muni.id,
            admin_barangay_id=brgy1.id,
            permissions=['residents:approve'],
        )
        muni_admin = User(
            username='muni_admin',
            email='muni_admin@example.com',
            password_hash='test',
            first_name='Muni',
            last_name='Admin',
            role='municipal_admin',
            admin_municipality_id=muni.id,
            permissions=['residents:approve'],
        )

        db.session.add_all([province, muni, brgy1, brgy2, muni_doc, resident, brgy_admin, muni_admin])
        db.session.flush()

        req = DocumentRequest(
            request_number='REQ-5',
            user_id=resident.id,
            document_type_id=muni_doc.id,
            municipality_id=muni.id,
            barangay_id=brgy1.id,
            delivery_method='physical',
            purpose='Permit',
            status='pending',
        )
        db.session.add(req)
        db.session.commit()

        brgy_token = create_access_token(identity=str(brgy_admin.id), additional_claims={'role': 'barangay_admin'})
        muni_token = create_access_token(identity=str(muni_admin.id), additional_claims={'role': 'municipal_admin'})

        # Barangay admin cannot jump to processing for municipal authority docs
        resp = client.put(
            f'/api/admin/documents/requests/{req.id}/status',
            json={'status': 'processing'},
            headers={'Authorization': f'Bearer {brgy_token}'}
        )
        assert resp.status_code in (400, 403)

        # Barangay admin can mark barangay_approved
        resp = client.put(
            f'/api/admin/documents/requests/{req.id}/status',
            json={'status': 'barangay_approved'},
            headers={'Authorization': f'Bearer {brgy_token}'}
        )
        assert resp.status_code == 200

        # Municipal admin can now approve and process
        resp = client.put(
            f'/api/admin/documents/requests/{req.id}/status',
            json={'status': 'approved'},
            headers={'Authorization': f'Bearer {muni_token}'}
        )
        assert resp.status_code == 200

        resp = client.put(
            f'/api/admin/documents/requests/{req.id}/status',
            json={'status': 'processing'},
            headers={'Authorization': f'Bearer {muni_token}'}
        )
        assert resp.status_code == 200


def test_barangay_admin_can_finish_barangay_authority_requests():
    app = create_app(BarangayDocConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        province, muni, brgy1, brgy2, doctype = _seed_common()
        resident = User(
            username='resident4',
            email='resident4@example.com',
            password_hash='test',
            first_name='Res',
            last_name='Four',
            role='resident',
            municipality_id=muni.id,
            barangay_id=brgy1.id,
        )
        brgy_admin = User(
            username='brgy_admin4',
            email='brgy_admin4@example.com',
            password_hash='test',
            first_name='Brgy',
            last_name='Admin4',
            role='barangay_admin',
            admin_municipality_id=muni.id,
            admin_barangay_id=brgy1.id,
            permissions=['residents:approve'],
        )

        db.session.add_all([province, muni, brgy1, brgy2, doctype, resident, brgy_admin])
        db.session.flush()

        req = DocumentRequest(
            request_number='REQ-6',
            user_id=resident.id,
            document_type_id=doctype.id,
            municipality_id=muni.id,
            barangay_id=brgy1.id,
            delivery_method='physical',
            purpose='Barangay clearance',
            status='pending',
        )
        db.session.add(req)
        db.session.commit()

        token = create_access_token(identity=str(brgy_admin.id), additional_claims={'role': 'barangay_admin'})

        for status in ['barangay_processing', 'barangay_approved', 'processing', 'ready', 'completed']:
            resp = client.put(
                f'/api/admin/documents/requests/{req.id}/status',
                json={'status': status},
                headers={'Authorization': f'Bearer {token}'}
            )
            assert resp.status_code == 200, f"{status} failed"
