from __future__ import annotations

from io import BytesIO

from flask_jwt_extended import create_access_token

from apps.api import db
from apps.api.app import create_app
from apps.api.config import Config
from apps.api.models.benefit import BenefitApplication, BenefitProgram
from apps.api.models.municipality import Barangay, Municipality
from apps.api.models.notification import NotificationOutbox
from apps.api.models.province import Province
from apps.api.models.user import User


class BenefitsScopeTestConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = False


def _seed_benefits_fixture():
    province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
    muni_iba = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')
    muni_cabangan = Municipality(id=109, name='Cabangan', slug='cabangan', province_id=province.id, psgc_code='037109000')
    brgy_iba_a = Barangay(id=5001, name='Barangay A', slug='barangay-a', municipality_id=muni_iba.id, psgc_code='037112001')
    brgy_iba_b = Barangay(id=5002, name='Barangay B', slug='barangay-b', municipality_id=muni_iba.id, psgc_code='037112002')

    municipal_admin = User(
        username='mun_admin',
        email='mun_admin@example.com',
        password_hash='x',
        first_name='Municipal',
        last_name='Admin',
        role='municipal_admin',
        admin_municipality_id=muni_iba.id,
    )
    barangay_admin = User(
        username='brgy_admin',
        email='brgy_admin@example.com',
        password_hash='x',
        first_name='Barangay',
        last_name='Admin',
        role='barangay_admin',
        admin_municipality_id=muni_iba.id,
        admin_barangay_id=brgy_iba_a.id,
    )
    provincial_admin = User(
        username='prov_admin',
        email='prov_admin@example.com',
        password_hash='x',
        first_name='Provincial',
        last_name='Admin',
        role='provincial_admin',
        admin_municipality_id=muni_iba.id,
    )
    resident_a = User(
        username='resident_a',
        email='resident_a@example.com',
        password_hash='x',
        first_name='Resident',
        last_name='A',
        role='resident',
        email_verified=True,
        admin_verified=True,
        municipality_id=muni_iba.id,
        barangay_id=brgy_iba_a.id,
        notify_email_enabled=True,
        notify_sms_enabled=False,
    )
    resident_b = User(
        username='resident_b',
        email='resident_b@example.com',
        password_hash='x',
        first_name='Resident',
        last_name='B',
        role='resident',
        email_verified=True,
        admin_verified=True,
        municipality_id=muni_iba.id,
        barangay_id=brgy_iba_b.id,
        notify_email_enabled=True,
        notify_sms_enabled=False,
    )

    db.session.add_all([
        province,
        muni_iba,
        muni_cabangan,
        brgy_iba_a,
        brgy_iba_b,
        municipal_admin,
        barangay_admin,
        provincial_admin,
        resident_a,
        resident_b,
    ])
    db.session.flush()

    muni_program = BenefitProgram(
        name='Municipal Aid',
        code='MUNI-AID-001',
        description='Municipality-wide aid',
        program_type='general',
        municipality_id=muni_iba.id,
        barangay_id=None,
        required_documents=['Valid ID'],
        is_active=True,
        is_accepting_applications=True,
    )
    brgy_program_a = BenefitProgram(
        name='Barangay A Aid',
        code='BRGY-AID-001',
        description='Barangay A assistance',
        program_type='general',
        municipality_id=muni_iba.id,
        barangay_id=brgy_iba_a.id,
        required_documents=['Valid ID'],
        is_active=True,
        is_accepting_applications=True,
    )
    brgy_program_b = BenefitProgram(
        name='Barangay B Aid',
        code='BRGY-AID-002',
        description='Barangay B assistance',
        program_type='general',
        municipality_id=muni_iba.id,
        barangay_id=brgy_iba_b.id,
        required_documents=['Valid ID'],
        is_active=True,
        is_accepting_applications=True,
    )
    db.session.add_all([muni_program, brgy_program_a, brgy_program_b])
    db.session.flush()

    muni_app = BenefitApplication(
        application_number='APP-112-100-001',
        user_id=resident_a.id,
        program_id=muni_program.id,
        application_data={},
        supporting_documents=['benefits/doc-initial.pdf'],
        status='pending',
    )
    brgy_app_a = BenefitApplication(
        application_number='APP-112-100-002',
        user_id=resident_a.id,
        program_id=brgy_program_a.id,
        application_data={},
        supporting_documents=['benefits/doc-a.pdf'],
        status='pending',
    )
    brgy_app_b = BenefitApplication(
        application_number='APP-112-100-003',
        user_id=resident_b.id,
        program_id=brgy_program_b.id,
        application_data={},
        supporting_documents=['benefits/doc-b.pdf'],
        status='pending',
    )
    db.session.add_all([muni_app, brgy_app_a, brgy_app_b])
    db.session.commit()

    return {
        'municipal_admin_id': municipal_admin.id,
        'barangay_admin_id': barangay_admin.id,
        'provincial_admin_id': provincial_admin.id,
        'resident_a_id': resident_a.id,
        'resident_b_id': resident_b.id,
        'muni_program_id': muni_program.id,
        'brgy_program_a_id': brgy_program_a.id,
        'muni_app_id': muni_app.id,
        'brgy_app_a_id': brgy_app_a.id,
        'brgy_app_b_id': brgy_app_b.id,
    }


def _auth(role: str, user_id: int):
    token = create_access_token(identity=str(user_id), additional_claims={'role': role})
    return {'Authorization': f'Bearer {token}'}


def test_benefit_applications_are_scoped_by_admin_role():
    app = create_app(BenefitsScopeTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        ids = _seed_benefits_fixture()

        municipal_headers = _auth('municipal_admin', ids['municipal_admin_id'])
        barangay_headers = _auth('barangay_admin', ids['barangay_admin_id'])
        provincial_headers = _auth('provincial_admin', ids['provincial_admin_id'])

        resp = client.get('/api/admin/benefits/applications', headers=municipal_headers)
        assert resp.status_code == 200
        municipal_app_ids = {a['id'] for a in (resp.get_json() or {}).get('applications', [])}
        assert ids['muni_app_id'] in municipal_app_ids
        assert ids['brgy_app_a_id'] not in municipal_app_ids
        assert ids['brgy_app_b_id'] not in municipal_app_ids

        resp = client.get('/api/admin/benefits/applications', headers=barangay_headers)
        assert resp.status_code == 200
        barangay_app_ids = {a['id'] for a in (resp.get_json() or {}).get('applications', [])}
        assert ids['brgy_app_a_id'] in barangay_app_ids
        assert ids['muni_app_id'] not in barangay_app_ids
        assert ids['brgy_app_b_id'] not in barangay_app_ids

        resp = client.get('/api/admin/benefits/applications', headers=provincial_headers)
        assert resp.status_code == 403


def test_resident_cannot_apply_to_other_barangay_program():
    app = create_app(BenefitsScopeTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        ids = _seed_benefits_fixture()

        resident_b_headers = _auth('resident', ids['resident_b_id'])
        resident_a_headers = _auth('resident', ids['resident_a_id'])

        forbidden = client.post(
            '/api/benefits/applications',
            json={'program_id': ids['brgy_program_a_id']},
            headers=resident_b_headers,
        )
        assert forbidden.status_code == 403
        assert 'barangay' in (forbidden.get_json() or {}).get('error', '').lower()

        allowed = client.post(
            '/api/benefits/applications',
            json={'program_id': ids['brgy_program_a_id']},
            headers=resident_a_headers,
        )
        assert allowed.status_code == 201


def test_approved_benefit_application_queues_program_specific_notification(monkeypatch):
    app = create_app(BenefitsScopeTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        ids = _seed_benefits_fixture()

        monkeypatch.setattr('apps.api.routes.admin.flush_pending_notifications', lambda *args, **kwargs: None)

        headers = _auth('municipal_admin', ids['municipal_admin_id'])
        resp = client.put(
            f"/api/admin/benefits/applications/{ids['muni_app_id']}/status",
            json={'status': 'approved'},
            headers=headers,
        )
        assert resp.status_code == 200

        outbox = NotificationOutbox.query.filter_by(
            resident_id=ids['resident_a_id'],
            event_type='benefit_application_status',
            channel='email',
            entity_id=ids['muni_app_id'],
        ).first()
        assert outbox is not None
        subject = (outbox.payload or {}).get('subject', '')
        assert 'Municipal Aid' in subject
        assert 'Registration' not in subject


def test_upload_supporting_documents_reassigns_and_persists(monkeypatch):
    app = create_app(BenefitsScopeTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        ids = _seed_benefits_fixture()

        monkeypatch.setattr(
            'apps.api.routes.benefits.save_benefit_document',
            lambda file, application_id, municipality_slug: f"benefits/{application_id}/{file.filename}",
        )

        headers = _auth('resident', ids['resident_a_id'])
        resp = client.post(
            f"/api/benefits/applications/{ids['muni_app_id']}/upload",
            data={
                'file': [
                    (BytesIO(b'first-file'), 'first.pdf'),
                    (BytesIO(b'second-file'), 'second.pdf'),
                ]
            },
            headers=headers,
            content_type='multipart/form-data',
        )
        assert resp.status_code == 200

        refreshed = db.session.get(BenefitApplication, ids['muni_app_id'])
        assert isinstance(refreshed.supporting_documents, list)
        assert 'benefits/doc-initial.pdf' in refreshed.supporting_documents
        assert f"benefits/{ids['muni_app_id']}/first.pdf" in refreshed.supporting_documents
        assert f"benefits/{ids['muni_app_id']}/second.pdf" in refreshed.supporting_documents


def test_resubmit_requires_complete_documents_before_resetting_status():
    app = create_app(BenefitsScopeTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        ids = _seed_benefits_fixture()

        benefit_app = db.session.get(BenefitApplication, ids['muni_app_id'])
        benefit_program = db.session.get(BenefitProgram, ids['muni_program_id'])
        benefit_program.required_documents = ['Valid ID', 'Proof of Residency']
        benefit_app.status = 'rejected'
        benefit_app.rejection_reason = 'Missing required documents'
        benefit_app.supporting_documents = ['benefits/doc-initial.pdf']
        db.session.commit()

        headers = _auth('resident', ids['resident_a_id'])
        blocked = client.post(f"/api/benefits/applications/{ids['muni_app_id']}/resubmit", headers=headers)
        assert blocked.status_code == 400
        assert 'upload 1 more required document' in ((blocked.get_json() or {}).get('error', '').lower())

        benefit_app.supporting_documents = ['benefits/doc-initial.pdf', 'benefits/doc-second.pdf']
        db.session.commit()

        allowed = client.post(f"/api/benefits/applications/{ids['muni_app_id']}/resubmit", headers=headers)
        assert allowed.status_code == 200
        refreshed = db.session.get(BenefitApplication, ids['muni_app_id'])
        assert refreshed.status == 'pending'
        assert refreshed.rejection_reason is None
